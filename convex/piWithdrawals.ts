import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";

// Points-to-Pi A2U (App-to-User) withdrawal system.
// Converts earned user points into real Pi sent directly to the user's linked Pi wallet.
//
// Default exchange rate: 1000 points = 1 Pi (configurable via platformSettings).
// Minimum withdrawal: 100 points = 0.1 Pi.
// Daily cap: 3 withdrawals / 24h per user (enforced via ratelimit.ts).

const DEFAULT_POINTS_PER_PI = 1000;
const MIN_POINTS_WITHDRAWAL = 100; // 0.1 Pi

export const getWithdrawalRate = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "POINTS_PER_PI"))
      .first();

    const pointsPerPi = setting ? parseFloat(setting.value) : DEFAULT_POINTS_PER_PI;

    return {
      pointsPerPi,
      minPoints: MIN_POINTS_WITHDRAWAL,
      minPi: MIN_POINTS_WITHDRAWAL / pointsPerPi,
    };
  },
});

export const listMyWithdrawals = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const rows = await ctx.db
      .query("piWithdrawals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return rows;
  },
});

// Mutation: initiate points-to-Pi withdrawal request
export const requestPiWithdrawal = mutation({
  args: {
    userId: v.id("users"),
    pointsToRedeem: v.number(),
  },
  handler: async (ctx, { userId, pointsToRedeem }) => {
    await requireUser(ctx, userId);
    await enforceRateLimit(ctx, userId, "withdraw");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.ecosystem !== "PI") {
      throw new Error("Pi wallet withdrawals are for Pi Network accounts only");
    }

    if (!user.piWalletAddress) {
      throw new Error("No linked Pi wallet address. Sign in with Pi to link your wallet.");
    }

    if (pointsToRedeem < MIN_POINTS_WITHDRAWAL) {
      throw new Error(`Minimum withdrawal is ${MIN_POINTS_WITHDRAWAL} points`);
    }

    // Read current rate
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "POINTS_PER_PI"))
      .first();
    const pointsPerPi = setting ? parseFloat(setting.value) : DEFAULT_POINTS_PER_PI;
    const piAmount = Math.round((pointsToRedeem / pointsPerPi) * 10000) / 10000;

    // Deduct points from ledger
    await ctx.runMutation(internal.points.creditHelper, {
      userId,
      delta: -pointsToRedeem,
      reason: `PI_WITHDRAWAL: ${piAmount} Pi to ${user.piWalletAddress.slice(0, 6)}…`,
    });

    const withdrawalId = await ctx.db.insert("piWithdrawals", {
      userId,
      pointsSpent: pointsToRedeem,
      piAmount,
      walletAddress: user.piWalletAddress,
      status: "processing",
    });

    // Schedule background A2U payout execution (Node runtime, see piWithdrawalsPayout.ts)
    await ctx.scheduler.runAfter(0, internal.piWithdrawalsPayout.processA2UPayout, {
      withdrawalId,
    });

    return { withdrawalId, piAmount };
  },
});

// Internal helper to update withdrawal record
export const updateWithdrawalStatus = internalMutation({
  args: {
    withdrawalId: v.id("piWithdrawals"),
    status: v.string(),
    paymentId: v.optional(v.string()),
    txid: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, { withdrawalId, status, paymentId, txid, failureReason }) => {
    await ctx.db.patch(withdrawalId, {
      status,
      ...(paymentId ? { paymentId } : {}),
      ...(txid ? { txid } : {}),
      ...(failureReason ? { failureReason } : {}),
    });
  },
});

// Internal queries for action worker
export const getWithdrawalByIdInternal = internalQuery({
  args: { withdrawalId: v.id("piWithdrawals") },
  handler: async (ctx, { withdrawalId }) => {
    return ctx.db.get(withdrawalId);
  },
});

export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db.get(userId);
  },
});
