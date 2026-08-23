import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserAndEconomy } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";
import { appendLedger } from "./lib/ledger";

export const donatePoints = mutation({
  args: {
    userId: v.id("users"),
    points: v.number(),
    memo: v.optional(v.string()),
  },
  handler: async (ctx, { userId, points, memo }) => {
    const { user, economy } = await requireUserAndEconomy(ctx, userId);

    if (points < 10) {
      throw new Error("Minimum donation is 10 points");
    }
    const cleanPoints = Math.floor(points);

    await enforceRateLimit(ctx, userId, "donate");

    const memoText = memo?.trim() || "Community Growth Contribution";

    // Deduct points safely through the authoritative ledger
    await appendLedger(ctx, userId, economy, -cleanPoints, "COMMUNITY_DONATION");

    const displayName = user.name || user.email?.split("@")[0] || "Community Supporter";

    const donationId = await ctx.db.insert("pointDonations", {
      userId,
      points: cleanPoints,
      memo: memoText,
      displayName,
    });

    return {
      success: true,
      donationId,
      donatedPoints: cleanPoints,
    };
  },
});

export const getCommunityPoolStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("pointDonations").collect();
    let totalPoints = 0;
    const uniqueDonors = new Set<string>();

    for (const d of all) {
      totalPoints += d.points;
      uniqueDonors.add(d.userId);
    }

    return {
      totalPoints,
      totalDonors: uniqueDonors.size,
      totalCount: all.length,
    };
  },
});

export const listTopDonors = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("pointDonations").collect();
    const map = new Map<string, { userId: string; displayName: string; totalPoints: number; count: number }>();

    for (const d of all) {
      const existing = map.get(d.userId);
      if (existing) {
        existing.totalPoints += d.points;
        existing.count += 1;
      } else {
        map.set(d.userId, {
          userId: d.userId,
          displayName: d.displayName || "Community Supporter",
          totalPoints: d.points,
          count: 1,
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10);
  },
});

export const listMyDonations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("pointDonations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
