import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/guards";
import { appendLedger } from "./lib/ledger";
import { getNum, getSetting } from "./rewardsConfig";

// Database side of anchor.ts (which runs in Node and can't hold queries).

const CURSOR_KEY = "anchorPaymentsCursor";
const MEMO_COUNTER_KEY = "stellarMemoNext";

async function settingRow(ctx: any, key: string) {
  return ctx.db.query("platformSettings").withIndex("by_key", (q: any) => q.eq("key", key)).unique();
}

async function putSetting(ctx: any, key: string, value: string) {
  const row = await settingRow(ctx, key);
  if (row) await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
  else await ctx.db.insert("platformSettings", { key, value, updatedAt: Date.now() });
}

/** Checks the user may deposit and gives them a permanent numeric memo. */
export const prepareDeposit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.accountStatus === "suspended") throw new Error("ACCOUNT_SUSPENDED");
    if ((await getNum(ctx, "anchorPointsPerUnit")) <= 0) throw new Error("Anchor deposits aren't available right now.");

    let memo = user.stellarMemo;
    if (memo === undefined) {
      // Mutations are serializable, so two users can never draw the same number.
      memo = Number((await settingRow(ctx, MEMO_COUNTER_KEY))?.value ?? "1000");
      await putSetting(ctx, MEMO_COUNTER_KEY, String(memo + 1));
      await ctx.db.patch(userId, { stellarMemo: memo });
    }
    return {
      memo,
      domain: await getSetting(ctx, "anchorDomain"),
      assetCode: await getSetting(ctx, "anchorAssetCode"),
    };
  },
});

export const scanConfig = internalQuery({
  args: {},
  handler: async (ctx) => ({
    domain: await getSetting(ctx, "anchorDomain"),
    assetCode: await getSetting(ctx, "anchorAssetCode"),
    pointsPerUnit: await getNum(ctx, "anchorPointsPerUnit"),
    cursor: (await settingRow(ctx, CURSOR_KEY))?.value ?? "",
  }),
});

/** Points for an anchor deposit → wallet pool (like SIDRA; never level-gated). */
export async function creditAnchorDeposit(
  ctx: MutationCtx, userId: Id<"users">, opId: string, txHash: string, amount: number, assetCode: string, points: number,
) {
  if (points <= 0) return;
  const after = await appendLedger(ctx, userId, "wallet", points, "ANCHOR_DEPOSIT", `anchor-${opId}`);
  await ctx.db.insert("walletTransactions", {
    userId,
    type: "deposit_anchor",
    pointsDelta: points,
    piproDelta: 0,
    pointsBalanceAfter: after,
    piproBalanceAfter: 0,
    note: `Anchor deposit: ${amount} ${assetCode} → ${points} PTS (tx: ${txHash.slice(0, 12)}…)`,
  });
}

/** Credits one Horizon page of payments and advances the cursor, atomically.
 *  Idempotent per payment op, so a re-scan can never pay twice. */
export const recordPayments = internalMutation({
  args: {
    payments: v.array(v.object({
      opId: v.string(),
      txHash: v.string(),
      amount: v.number(),
      memo: v.optional(v.number()),
    })),
    cursor: v.string(),
  },
  handler: async (ctx, { payments, cursor }) => {
    const rate = await getNum(ctx, "anchorPointsPerUnit");
    const assetCode = await getSetting(ctx, "anchorAssetCode");
    for (const p of payments) {
      const seen = await ctx.db.query("anchorDeposits").withIndex("by_opId", (q) => q.eq("opId", p.opId)).unique();
      if (seen) continue;
      const user = p.memo === undefined
        ? null
        : await ctx.db.query("users").withIndex("by_stellarMemo", (q) => q.eq("stellarMemo", p.memo)).unique();
      // No/unknown memo: kept as "unmatched" for admin to resolve by hand.
      const points = user ? Math.floor(p.amount * rate) : 0;
      await ctx.db.insert("anchorDeposits", {
        opId: p.opId,
        txHash: p.txHash,
        memo: p.memo,
        userId: user?._id,
        assetCode,
        amount: p.amount,
        pointsCredited: points,
        status: user ? "credited" : "unmatched",
      });
      if (user) await creditAnchorDeposit(ctx, user._id, p.opId, p.txHash, p.amount, assetCode, points);
    }
    await putSetting(ctx, CURSOR_KEY, cursor);
  },
});

export const myAnchorDeposits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    return ctx.db.query("anchorDeposits").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(20);
  },
});

/** Public: the anchor deposit rate, shown to users before they deposit. */
export const depositRate = query({
  args: {},
  handler: async (ctx) => ({
    assetCode: await getSetting(ctx, "anchorAssetCode"),
    pointsPerUnit: await getNum(ctx, "anchorPointsPerUnit"),
  }),
});
