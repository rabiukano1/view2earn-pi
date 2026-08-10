import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/guards";

export const balance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const last = await ctx.db.query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return last?.balanceAfter ?? 0;
  },
});

export const history = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    await requireUser(ctx, userId);
    const items = await ctx.db.query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
    return items;
  },
});

// Wallet dashboard summary: lifetime + trailing-7-day earned/spent totals, so
// the wallet can render stat cards without scanning the whole ledger per row.
export const summary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const items = await ctx.db.query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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
    };
  },
});

export const creditHelper = internalMutation({
  args: {
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const last = await ctx.db.query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    const balanceAfter = (last?.balanceAfter ?? 0) + args.delta;
    if (balanceAfter < 0) throw new Error("Insufficient points");
    await ctx.db.insert("pointsLedger", {
      userId: args.userId,
      delta: args.delta,
      reason: args.reason,
      refId: args.refId,
      balanceAfter,
    });
    return balanceAfter;
  },
});
