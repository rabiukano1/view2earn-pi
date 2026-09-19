import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndSurface } from "./lib/guards";
import { applySpinDouble } from "./spin";
import { consumeRewardedAd } from "./piAds";

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
      rewardPoints = 0;
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
    piAdId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { economy } = await requireUserAndSurface(ctx, args.userId);
    // Pi Ad Network: verify adId against the Platform API (+ replay-protect)
    // before crediting anything. Native AdMob callers don't send piAdId.
    if (args.piAdId) await consumeRewardedAd(ctx, args.userId, args.piAdId);
    const normalizedAdType = args.adType?.trim().toLowerCase() ?? "";

    // Spin rewards never take the generic flat-reward path below — that would
    // credit a flat adRewardPoints instead of the actual wheel prize.
    const isSpinRelatedAd =
      normalizedAdType.includes("spin") || normalizedAdType.includes("double");

    if (isSpinRelatedAd) {
      // The build on the Play Store fires this the instant the rewarded ad
      // finishes, and it is the only server-visible proof that the 2x ad was
      // actually watched on that build — so the top-up is credited here rather
      // than dropped. applySpinDouble marks the spin claimed, so the
      // claimSpin(doubled:true) that same flow sends next cannot pay it twice.
      // Bonus-spin ads ("spin_bonus_spin") are granted by spin.earnBonusSpin
      // and must stay a no-op here.
      if (normalizedAdType.includes("double")) {
        await applySpinDouble(ctx, args.userId, economy);
      }
      const last0 = await ctx.db
        .query("pointsLedger")
        .withIndex("by_user_economy", (q) =>
          q.eq("userId", args.userId).eq("economy", economy),
        )
        .order("desc")
        .first();
      return last0?.balanceAfter ?? 0;
    }

    // Per-adType rate limit — global AD_REWARD_* cooldown blocked spin bonus→double in <30s
    const currentReason = `AD_REWARD_${(normalizedAdType || "REWARDED_VIDEO").toUpperCase()}`;
    const recentReward = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", args.userId).eq("economy", economy),
      )
      .order("desc")
      .first();
    // only throttle same adType; different types (bonus-spin vs double) don't block each other
    // 10s is enough to stop spam while allowing normal spin→double flow (~12-15s apart)
    if (recentReward && recentReward.reason === currentReason && Date.now() - recentReward._creationTime < 10_000) {
      const waitMs = 10_000 - (Date.now() - recentReward._creationTime);
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

    // 3. Generic ad rewards must come from server config only.
    // Do not accept a client-supplied rewardAmount here, because that can stack
    // a flat ad reward on top of a separate spin/double payout and create a
    // duplicate credit like the +50 issue.
    const finalReward = rewardPoints ?? 0;
    await ctx.db.insert("adWatchLogs", {
      userId: args.userId,
      kind: "rewarded",
      provider: args.piAdId ? "pi-ads" : (args.provider ?? "admob"),
      points: finalReward,
      economy,
      at: Date.now(),
    });

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
