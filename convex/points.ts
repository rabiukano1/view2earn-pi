import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/guards";

export const balance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const last = await ctx.db.query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return last?.balanceAfter ?? 0;
  },
});

export const credit = mutation({
  args: {
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
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

export const history = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const items = await ctx.db.query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
    return items;
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
