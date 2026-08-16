import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { getJSON, getNum } from "./rewardsConfig";
import { appendLedger } from "./lib/ledger";

function weightedPick(prizes: { pts: number; weight: number }[]): number {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) {
    if (r < p.weight) return p.pts;
    r -= p.weight;
  }
  return prizes[prizes.length - 1].pts;
}

export const getSpinStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const now = Date.now();
    const spinWindowHours = await getNum(ctx, "spinWindowHours");
    const windowMs = spinWindowHours * 60 * 60 * 1000;
    const baseSpins = await getNum(ctx, "baseSpinsPerWindow");
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const nextRefillAt = currentWindowStart + windowMs;
    const nextRefillMs = Math.max(0, nextRefillAt - now);

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let spinsUsedInWindow = 0;
    let bonusSpins = spinRecord?.bonusSpins ?? 0;
    let adBonusEarned = 0;

    if (spinRecord && spinRecord.windowStart === currentWindowStart) {
      spinsUsedInWindow = spinRecord.spinsUsedInWindow ?? 0;
      adBonusEarned = spinRecord.adBonusEarned ?? 0;
    }

    const adBonusLimit = await getNum(ctx, "adBonusSpinsPerWindow");
    const baseSpinsRemaining = Math.max(0, baseSpins - spinsUsedInWindow);
    const spinsRemaining = baseSpinsRemaining + bonusSpins;

    return {
      spinsRemaining,
      baseSpinsRemaining,
      bonusSpins,
      adBonusEarned,
      adBonusLimit,
      adBonusRemaining: Math.max(0, adBonusLimit - adBonusEarned),
      nextRefillMs,
      nextRefillAt,
      windowTotalMs: windowMs,
      // Additive fields so the Achievements hub can render real spin progress
      // (window spins used vs the window budget) without re-deriving it.
      spinsUsedInWindow,
      baseSpinsPerWindow: baseSpins,
    };
  },
});

export const spin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const now = Date.now();
    const spinWindowHours = await getNum(ctx, "spinWindowHours");
    const windowMs = spinWindowHours * 60 * 60 * 1000;
    const baseSpins = await getNum(ctx, "baseSpinsPerWindow");
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let spinsUsedInWindow = 0;
    let bonusSpins = spinRecord?.bonusSpins ?? 0;

    const sameWindow = spinRecord?.windowStart === currentWindowStart;
    if (sameWindow) {
      spinsUsedInWindow = spinRecord.spinsUsedInWindow ?? 0;
    }

    const baseSpinsRemaining = Math.max(0, baseSpins - spinsUsedInWindow);
    const spinsRemaining = baseSpinsRemaining + bonusSpins;

    if (spinsRemaining <= 0) {
      throw new Error("No spins left in this 3-hour window! Watch an ad for extra spins or wait for refill.");
    }

    // Consume bonus spin first if available, else consume base spin
    let newBonusSpins = bonusSpins;
    let newSpinsUsed = spinsUsedInWindow;

    if (bonusSpins > 0) {
      newBonusSpins = bonusSpins - 1;
    } else {
      newSpinsUsed = spinsUsedInWindow + 1;
    }

    // adBonusEarned only counts within the current window — reset when the
    // window rolls over so the ad-earn quota refreshes each window.
    const newAdBonusEarned = sameWindow ? (spinRecord?.adBonusEarned ?? 0) : 0;

    const prizes = await getJSON<{ pts: number; weight: number }[]>(ctx, "spinPrizes");
    const pts = weightedPick(prizes);

    if (pts < 0) {
      newBonusSpins += Math.abs(pts);
    }

    if (spinRecord) {
      await ctx.db.patch(spinRecord._id, {
        windowStart: currentWindowStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins,
        adBonusEarned: newAdBonusEarned,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        windowStart: currentWindowStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins,
        adBonusEarned: 0,
      });
    }

    if (pts > 0) {
      await appendLedger(ctx, userId, economy, pts, "SPIN_WHEEL", `spin-${now}`);
    }

    // Also sync the user's app wallet points balance for this economy.
    if (pts > 0) {
      let wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (wallet) {
        const newPoints =
          economy === "pi-browser"
            ? (wallet.piBrowserPointsBalance ?? 0) + pts
            : wallet.pointsBalance + pts;
        await ctx.db.patch(
          wallet._id,
          economy === "pi-browser"
            ? { piBrowserPointsBalance: newPoints }
            : { pointsBalance: newPoints },
        );

        await ctx.db.insert("walletTransactions", {
          userId,
          type: "earn_points",
          pointsDelta: pts,
          piproDelta: 0,
          pointsBalanceAfter: newPoints,
          piproBalanceAfter: wallet.piproBalance,
          note: `Spin Wheel Prize (+${pts} PTS, ${economy})`,
        });
      }
    }

    const updatedRemaining = spinsRemaining - 1;
    return { pts, spinsRemaining: updatedRemaining };
  },
});

export const earnBonusSpin = mutation({
  args: { userId: v.id("users"), amount: v.optional(v.number()) },
  handler: async (ctx, { userId, amount }) => {
    await requireUser(ctx, userId);
    const now = Date.now();
    const spinWindowHours = await getNum(ctx, "spinWindowHours");
    const windowMs = spinWindowHours * 60 * 60 * 1000;
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const addCount = Math.max(1, amount ?? 1);
    const adBonusLimit = await getNum(ctx, "adBonusSpinsPerWindow");

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const sameWindow = spinRecord?.windowStart === currentWindowStart;
    const earnedInWindow = sameWindow ? (spinRecord?.adBonusEarned ?? 0) : 0;

    // Cap bonus spins earned from ads to adBonusSpinsPerWindow per window.
    if (earnedInWindow + addCount > adBonusLimit) {
      throw new Error(
        `Bonus spin limit reached — ${adBonusLimit} per ${spinWindowHours}-hour window. Try again after refill!`,
      );
    }

    if (spinRecord) {
      const currentBonus = spinRecord.bonusSpins ?? 0;
      await ctx.db.patch(spinRecord._id, {
        windowStart: currentWindowStart,
        bonusSpins: currentBonus + addCount,
        adBonusEarned: earnedInWindow + addCount,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        windowStart: currentWindowStart,
        spinsUsedInWindow: 0,
        bonusSpins: addCount,
        adBonusEarned: addCount,
      });
    }

    return {
      success: true,
      added: addCount,
      adBonusEarned: earnedInWindow + addCount,
      adBonusRemaining: Math.max(0, adBonusLimit - (earnedInWindow + addCount)),
    };
  },
});
