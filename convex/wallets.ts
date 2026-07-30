import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { isEvmAddress, isSolanaAddress } from "@view2earn/core";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Helper for MUTATIONS to get or create a wallet document in DB. */
async function getOrCreateWalletDoc(ctx: any, userId: any) {
  const existing = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("wallets", {
    userId,
    pointsBalance: 0,
    piproBalance: 0,
  });
  return await ctx.db.get(id);
}

async function getCurrentRate(ctx: any): Promise<number> {
  const rate = await ctx.db.query("exchangeRates").order("desc").first();
  if (!rate) throw new Error("Exchange rate not configured. Contact admin.");
  return rate.pointsPerPipro;
}

async function recordWalletTx(
  ctx: any,
  userId: any,
  type: string,
  pointsDelta: number,
  piproDelta: number,
  pointsBalanceAfter: number,
  piproBalanceAfter: number,
  note?: string,
) {
  await ctx.db.insert("walletTransactions", {
    userId,
    type,
    pointsDelta,
    piproDelta,
    pointsBalanceAfter,
    piproBalanceAfter,
    note,
  });
}

// ─── Public Queries ─────────────────────────────────────────────────────────

/** Returns the user's wallet balances (read-only query). Synced with pointsLedger. */
export const getOrCreateWallet = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const existing = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .unique();

    const lastLedger = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .first();

    const ledgerPoints = lastLedger?.balanceAfter ?? 0;
    const walletPoints = existing?.pointsBalance ?? 0;
    const pointsBalance = Math.max(ledgerPoints, walletPoints);

    return {
      _id: existing?._id ?? null,
      pointsBalance,
      piproBalance: existing?.piproBalance ?? 0,
    };
  },
});

/** Returns the current global exchange rate (points per 1 pipro). */
export const getExchangeRate = query({
  args: {},
  handler: async (ctx) => {
    const rate = await ctx.db.query("exchangeRates").order("desc").first();
    return rate ? { pointsPerPipro: rate.pointsPerPipro, updatedAt: rate.updatedAt } : null;
  },
});

/** Returns the platform Solana deposit address from platformSettings. */
export const getPlatformDepositAddress = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "platformSolanaAddress"))
      .unique();
    return setting?.value ?? null;
  },
});

/** Returns paginated wallet transaction history for the authenticated user. */
export const getWalletHistory = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    await requireUser(ctx, userId);
    return await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
  },
});

/** Returns deposit history for the authenticated user. */
export const getDepositHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    return await ctx.db
      .query("piproDeposits")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

// ─── User Mutations ─────────────────────────────────────────────────────────

/** Swap points → pipro at the current global rate. Instant. */
export const swapPointsToPipro = mutation({
  args: { userId: v.id("users"), pointsAmount: v.number() },
  handler: async (ctx, { userId, pointsAmount }) => {
    await requireUser(ctx, userId);
    if (pointsAmount <= 0) throw new Error("Amount must be positive");

    const rate = await getCurrentRate(ctx);
    const piproReceived = pointsAmount / rate;

    const wallet = await getOrCreateWalletDoc(ctx, userId);
    if (wallet.pointsBalance < pointsAmount) {
      throw new Error("Insufficient points balance");
    }

    const newPoints = wallet.pointsBalance - pointsAmount;
    const newPipro = wallet.piproBalance + piproReceived;

    await ctx.db.patch(wallet._id, {
      pointsBalance: newPoints,
      piproBalance: newPipro,
    });

    await recordWalletTx(
      ctx, userId, "swap_points_to_pipro",
      -pointsAmount, piproReceived, newPoints, newPipro,
      `Swapped ${pointsAmount} pts → ${piproReceived.toFixed(4)} PIPRO @ rate ${rate}`,
    );

    return { pointsBalance: newPoints, piproBalance: newPipro };
  },
});

/** Swap pipro → points at the current global rate. Instant. */
export const swapPiproToPoints = mutation({
  args: { userId: v.id("users"), piproAmount: v.number() },
  handler: async (ctx, { userId, piproAmount }) => {
    await requireUser(ctx, userId);
    if (piproAmount <= 0) throw new Error("Amount must be positive");

    const rate = await getCurrentRate(ctx);
    const pointsReceived = piproAmount * rate;

    const wallet = await getOrCreateWalletDoc(ctx, userId);
    if (wallet.piproBalance < piproAmount) {
      throw new Error("Insufficient PIPRO balance");
    }

    const newPoints = wallet.pointsBalance + pointsReceived;
    const newPipro = wallet.piproBalance - piproAmount;

    await ctx.db.patch(wallet._id, {
      pointsBalance: newPoints,
      piproBalance: newPipro,
    });

    await recordWalletTx(
      ctx, userId, "swap_pipro_to_points",
      pointsReceived, -piproAmount, newPoints, newPipro,
      `Swapped ${piproAmount} PIPRO → ${pointsReceived.toFixed(0)} pts @ rate ${rate}`,
    );

    return { pointsBalance: newPoints, piproBalance: newPipro };
  },
});

/** User submits a Solana tx signature for deposit verification.
 *  Creates a "pending" deposit row — backend verifies on-chain before crediting. */
export const submitPiproDeposit = mutation({
  args: {
    userId: v.id("users"),
    txSignature: v.string(),
    fromAddress: v.string(),
  },
  handler: async (ctx, { userId, txSignature, fromAddress }) => {
    await requireUser(ctx, userId);
    if (!txSignature.trim()) throw new Error("Transaction signature required");

    // Dedup: check if this tx was already submitted
    const existing = await ctx.db
      .query("piproDeposits")
      .withIndex("by_txSignature", (q: any) => q.eq("txSignature", txSignature))
      .unique();
    if (existing) throw new Error("This transaction has already been submitted");

    const id = await ctx.db.insert("piproDeposits", {
      userId,
      txSignature: txSignature.trim(),
      amount: 0, // will be filled after verification
      fromAddress: fromAddress.trim(),
      status: "pending",
    });

    return { depositId: id, status: "pending" };
  },
});

// ─── Payout Wallet Addresses (external, user-provided) ─────────────────────

/** Set the user's payout wallet addresses (where token rewards get sent). We only
 *  ever store public addresses — no seed phrase, no private key, no custody.
 *  Addresses are validated server-side; an empty string clears one. */
export const setPayoutWallet = mutation({
  args: {
    userId: v.id("users"),
    evm: v.optional(v.string()),
    solana: v.optional(v.string()),
  },
  handler: async (ctx, { userId, evm, solana }) => {
    await requireUser(ctx, userId);
    const patch: { payoutEvm?: string; payoutSolana?: string } = {};

    if (evm !== undefined) {
      const e = evm.trim();
      if (e && !isEvmAddress(e)) throw new Error("That doesn't look like a valid EVM address");
      patch.payoutEvm = e;
    }
    if (solana !== undefined) {
      const s = solana.trim();
      if (s && !isSolanaAddress(s)) throw new Error("That doesn't look like a valid Solana address");
      patch.payoutSolana = s;
    }

    if (Object.keys(patch).length) await ctx.db.patch(userId, patch);
  },
});

// ─── Internal Mutations (backend only — NOT callable by users) ──────────────

/** Confirm a deposit after on-chain verification. Credits the wallet. */
export const confirmDeposit = internalMutation({
  args: {
    depositId: v.id("piproDeposits"),
    amount: v.number(),
  },
  handler: async (ctx, { depositId, amount }) => {
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status === "confirmed") return; // idempotent

    await ctx.db.patch(depositId, {
      status: "confirmed",
      amount,
      confirmedAt: Date.now(),
    });

    const wallet = await getOrCreateWalletDoc(ctx, deposit.userId);
    const newPipro = wallet.piproBalance + amount;

    await ctx.db.patch(wallet._id, { piproBalance: newPipro });

    await recordWalletTx(
      ctx, deposit.userId, "deposit_pipro",
      0, amount, wallet.pointsBalance, newPipro,
      `Deposit confirmed: ${amount} PIPRO (tx: ${deposit.txSignature.slice(0, 12)}…)`,
    );
  },
});

/** Reject a deposit if on-chain verification fails. */
export const rejectDeposit = internalMutation({
  args: {
    depositId: v.id("piproDeposits"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { depositId, reason }) => {
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");

    await ctx.db.patch(depositId, {
      status: "failed",
    });
  },
});

/** Internal: credit points to a user's wallet (called by tasks, ads, referrals etc.) */
export const creditPointsInternal = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { userId, amount, reason }) => {
    const wallet = await getOrCreateWalletDoc(ctx, userId);
    const newPoints = wallet.pointsBalance + amount;
    await ctx.db.patch(wallet._id, { pointsBalance: newPoints });

    await recordWalletTx(
      ctx, userId, "earn_points",
      amount, 0, newPoints, wallet.piproBalance,
      reason,
    );
  },
});

// ─── Internal Queries (for HTTP handlers) ───────────────────────────────────

/** Look up a deposit by ID (used by the HTTP verify-deposit endpoint). */
export const getDepositById = internalQuery({
  args: { depositId: v.id("piproDeposits") },
  handler: async (ctx, { depositId }) => {
    return await ctx.db.get(depositId);
  },
});

/** Get the platform Solana address from settings (internal, no auth needed). */
export const getPlatformAddressInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "platformSolanaAddress"))
      .unique();
    return setting?.value ?? null;
  },
});
