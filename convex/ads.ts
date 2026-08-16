import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";

/** Query active ad config including admin-configured reward points. */
export const getAdRewardConfig = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);

    // 1. Fetch enabled ADS providers
    const providers = await ctx.db
      .query("providers")
      .filter((q) => q.and(
        q.eq(q.field("kind"), "ADS"),
        q.eq(q.field("enabled"), true),
      ))
      .collect();

    let rewardPoints: number | null = null;

    // 1. Check global platformSettings first (single source of truth)
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
      .unique();
    if (setting?.value) {
      const num = Number(setting.value);
      if (!isNaN(num) && num >= 0) {
        rewardPoints = num;
      }
    }

    // 2. Fall back to first enabled provider's configJson
    if (rewardPoints === null) {
      const activeProvider = providers[0];
      if (activeProvider?.configJson) {
        try {
          const parsed = JSON.parse(activeProvider.configJson);
          if (parsed.rewardPoints !== undefined && parsed.rewardPoints !== null) {
            const num = Number(parsed.rewardPoints);
            if (!isNaN(num) && num >= 0) {
              rewardPoints = num;
            }
          }
        } catch {}
      }
    }

    // 3. Fallback default
    if (rewardPoints === null) {
      rewardPoints = 50;
    }

    return {
      rewardPoints,
      providers: providers.map((p) => ({
        id: p._id,
        name: p.name,
        platform: p.platform,
        configJson: p.configJson,
      })),
    };
  },
});

/** Backward-compatible query alias */
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

/** Reward user for watching an ad. Uses authoritative backend reward points. */
export const rewardForAd = mutation({
  args: {
    userId: v.id("users"),
    provider: v.optional(v.string()),
    adType: v.optional(v.string()),
    rewardAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { economy } = await requireUserAndEconomy(ctx, args.userId);

    // ponytail: basic per-user rate limit — prevents malicious clients from
    // spamming rewardForAd. 30s cooldown is a conservative heuristic;
    // calibrate against real ad SDK callback timing in production.
    const recentReward = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", args.userId).eq("economy", economy),
      )
      .order("desc")
      .first();
    if (
      recentReward &&
      recentReward.reason.startsWith("AD_REWARD_") &&
      Date.now() - recentReward._creationTime < 30_000
    ) {
      const waitMs = 30_000 - (Date.now() - recentReward._creationTime);
      throw new ConvexError({
        code: "AD_REWARD_COOLDOWN",
        message: "Please wait before claiming another ad reward.",
        waitMs,
      });
    }

    let rewardPoints: number | null = null;

    // 1. Check global platformSettings first (single source of truth)
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
      .unique();
    if (setting?.value) {
      const num = Number(setting.value);
      if (!isNaN(num) && num >= 0) {
        rewardPoints = num;
      }
    }

    // 2. Fall back to first enabled provider's configJson
    if (rewardPoints === null) {
      const providers = await ctx.db
        .query("providers")
        .filter((q) => q.and(
          q.eq(q.field("kind"), "ADS"),
          q.eq(q.field("enabled"), true),
        ))
        .collect();

      if (providers[0]?.configJson) {
        try {
          const parsed = JSON.parse(providers[0].configJson);
          if (parsed.rewardPoints !== undefined && parsed.rewardPoints !== null) {
            const num = Number(parsed.rewardPoints);
            if (!isNaN(num) && num >= 0) {
              rewardPoints = num;
            }
          }
        } catch {}
      }
    }

    // 3. Fall back to passed amount or 50
    const finalReward = rewardPoints ?? (args.rewardAmount ?? 50);

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", args.userId).eq("economy", economy),
      )
      .order("desc")
      .first();

    const balanceAfter = (last?.balanceAfter ?? 0) + finalReward;

    await ctx.db.insert("pointsLedger", {
      userId: args.userId,
      economy,
      delta: finalReward,
      reason: `AD_REWARD_${(args.adType ?? "REWARDED_VIDEO").toUpperCase()}`,
      refId: args.provider ?? "admob",
      balanceAfter,
    });

    // Also update the user's app wallet balance for THIS economy. Android
    // economy → wallets.pointsBalance; pi-browser economy → its own mirror so
    // the two balances never mix.
    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (wallet) {
      if (economy === "pi-browser") {
        const piBrowserPoints = (wallet.piBrowserPointsBalance ?? 0) + finalReward;
        await ctx.db.patch(wallet._id, { piBrowserPointsBalance: piBrowserPoints });
      } else {
        const newPoints = wallet.pointsBalance + finalReward;
        await ctx.db.patch(wallet._id, { pointsBalance: newPoints });
      }

      await ctx.db.insert("walletTransactions", {
        userId: args.userId,
        type: "earn_points",
        pointsDelta: finalReward,
        piproDelta: 0,
        pointsBalanceAfter: economy === "pi-browser" ? (wallet.piBrowserPointsBalance ?? 0) + finalReward : wallet.pointsBalance + finalReward,
        piproBalanceAfter: wallet.piproBalance,
        note: `Watched Ad Reward (+${finalReward} PTS, ${economy})`,
      });
    }

    return balanceAfter;
  },
});
