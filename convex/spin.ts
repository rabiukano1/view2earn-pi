import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { getJSON, getNum } from "./rewardsConfig";

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

    if (spinRecord && spinRecord.windowStart === currentWindowStart) {
      spinsUsedInWindow = spinRecord.spinsUsedInWindow ?? 0;
    }

    const baseSpinsRemaining = Math.max(0, baseSpins - spinsUsedInWindow);
    const spinsRemaining = baseSpinsRemaining + bonusSpins;

    return {
      spinsRemaining,
      baseSpinsRemaining,
      bonusSpins,
      nextRefillMs,
      nextRefillAt,
    };
  },
});

export const spin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
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

    if (spinRecord && spinRecord.windowStart === currentWindowStart) {
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

    if (spinRecord) {
      await ctx.db.patch(spinRecord._id, {
        windowStart: currentWindowStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        windowStart: currentWindowStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins,
      });
    }

    const prizes = await getJSON<{ pts: number; weight: number }[]>(ctx, "spinPrizes");
    const pts = weightedPick(prizes);

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    await ctx.db.insert("pointsLedger", {
      userId,
      delta: pts,
      reason: "SPIN_WHEEL",
      refId: `spin-${now}`,
      balanceAfter: (last?.balanceAfter ?? 0) + pts,
    });

    // Also sync user's app wallet points balance
    if (pts > 0) {
      let wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (wallet) {
        const newPoints = wallet.pointsBalance + pts;
        await ctx.db.patch(wallet._id, { pointsBalance: newPoints });

        await ctx.db.insert("walletTransactions", {
          userId,
          type: "earn_points",
          pointsDelta: pts,
          piproDelta: 0,
          pointsBalanceAfter: newPoints,
          piproBalanceAfter: wallet.piproBalance,
          note: `Spin Wheel Prize (+${pts} PTS)`,
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
    const addCount = amount ?? 1;

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (spinRecord) {
      const currentBonus = spinRecord.bonusSpins ?? 0;
      await ctx.db.patch(spinRecord._id, {
        bonusSpins: currentBonus + addCount,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        windowStart: currentWindowStart,
        spinsUsedInWindow: 0,
        bonusSpins: addCount,
      });
    }

    return { success: true, added: addCount };
  },
});
