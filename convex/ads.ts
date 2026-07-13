import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/guards";

export const listEnabled = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const providers = await ctx.db
      .query("providers")
      .filter((q) => q.and(
        q.eq(q.field("kind"), "ADS"),
        q.eq(q.field("enabled"), true),
      ))
      .collect();
    return providers.map((p) => ({
      id: p._id,
      name: p.name,
      platform: p.platform,
      configJson: p.configJson,
    }));
  },
});

export const rewardForAd = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    adType: v.string(),
    rewardAmount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    const balanceAfter = (last?.balanceAfter ?? 0) + args.rewardAmount;
    await ctx.db.insert("pointsLedger", {
      userId: args.userId,
      delta: args.rewardAmount,
      reason: `AD_REWARD_${args.adType.toUpperCase()}`,
      refId: args.provider,
      balanceAfter,
    });
    return balanceAfter;
  },
});
