import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";

export const listAvailable = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const providers = await ctx.db
      .query("providers")
      .filter((q) => q.and(
        q.eq(q.field("kind"), "SURVEY"),
        q.eq(q.field("enabled"), true),
      ))
      .collect();
    return providers.map((p) => ({
      id: p._id,
      name: p.name,
      platform: p.platform,
    }));
  },
});

export const recordCompletion = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    amount: v.number(),
    txId: v.string(),
  },
  handler: async (ctx, args) => {
    // Providers retry postbacks — credit each transaction exactly once.
    const refId = `${args.provider}:${args.txId}`;
    const existing = await ctx.db
      .query("pointsLedger")
      .withIndex("by_refId", (q) => q.eq("refId", refId))
      .first();
    if (existing) return; // already credited this txId

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    const balanceAfter = (last?.balanceAfter ?? 0) + args.amount;
    await ctx.db.insert("pointsLedger", {
      userId: args.userId,
      delta: args.amount,
      reason: "SURVEY_COMPLETED",
      refId,
      balanceAfter,
    });
  },
});
