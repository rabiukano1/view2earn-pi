import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requireUserAndEconomy } from "./lib/guards";

// Points ledger, economy-aware (ONE user, TWO economies).
//
// Economy is DERIVED server-side from the user's identity anchor, never from a
// client argument. The Android app (email/Telegram-anchored users) reads and
// writes only the "android" economy; the Pi Browser (Pi-anchored users) reads
// and writes only the "pi-browser" economy. A malicious client cannot flip
// economies because the economy comes from the user row, not the request.

// Read the caller's own-economy balance. The economy is derived server-side.
export const balance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", userId).eq("economy", economy),
      )
      .order("desc")
      .first();
    return last?.balanceAfter ?? 0;
  },
});

export const history = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const items = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", userId).eq("economy", economy),
      )
      .order("desc")
      .take(limit ?? 50);
    return items;
  },
});

// Wallet dashboard summary: lifetime + trailing-7-day earned/spent totals for
// the caller's own economy only (never mixes the two economies).
export const summary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const items = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", userId).eq("economy", economy),
      )
      .collect();

    const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let totalEarned = 0;
    let totalSpent = 0;
    let weekEarned = 0;
    let weekSpent = 0;

    for (const it of items) {
      const delta = it.delta;
      if (delta >= 0) totalEarned += delta;
      else totalSpent += -delta;
      if (it._creationTime >= weekCutoff) {
        if (delta >= 0) weekEarned += delta;
        else weekSpent += -delta;
      }
    }

    return {
      totalEarned,
      totalSpent,
      weekEarned,
      weekSpent,
      balance: items.length > 0 ? items[0].balanceAfter : 0,
      count: items.length,
      economy,
    };
  },
});

// Economy-aware credit/debit helper. The caller passes the economy explicitly —
// internal mutations resolve it themselves (server-side) and NEVER accept it
// from an untrusted client. Deducting past zero throws, so a ledger can never
// be driven negative by a cross-economy or spoofed request.
export const creditHelper = internalMutation({
  args: {
    userId: v.id("users"),
    economy: v.union(v.literal("android"), v.literal("pi-browser")),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", args.userId).eq("economy", args.economy),
      )
      .order("desc")
      .first();
    const balanceAfter = (last?.balanceAfter ?? 0) + args.delta;
    if (balanceAfter < 0) throw new Error("Insufficient points");
    await ctx.db.insert("pointsLedger", {
      userId: args.userId,
      economy: args.economy,
      delta: args.delta,
      reason: args.reason,
      refId: args.refId,
      balanceAfter,
    });
    return balanceAfter;
  },
});
