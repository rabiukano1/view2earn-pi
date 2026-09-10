import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { getJSON, getNum } from "./rewardsConfig";
import { appendLedger } from "./lib/ledger";

// Wheel sector order must match SvgSpinWheel TEN_WHEEL_PRIZES exactly
const WHEEL_PTS = [10, 25, 50, -1, 100, 15, -2, -3, 0, 35] as const;
const WHEEL_DEFAULT_WEIGHTS: Record<number, number> = {
  10: 24, 25: 13, 50: 9, [-1]: 1.5, 100: 2, 15: 18, [-2]: 0.5, [-3]: 0.5, 0: 30, 35: 4,
};

function buildWheelPrizes(configPrizes: { pts: number; weight: number }[]): { pts: number; weight: number }[] {
  const w = new Map(configPrizes.map((p) => [p.pts, p.weight]));
  return (WHEEL_PTS as readonly number[]).map((pts) => ({
    pts,
    weight: w.get(pts) ?? WHEEL_DEFAULT_WEIGHTS[pts] ?? 1,
  }));
}

function weightedPickIndex(prizes: { pts: number; weight: number }[]): number {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    if (r < prizes[i].weight) return i;
    r -= prizes[i].weight;
  }
  return prizes.length - 1;
}

// Nigeria is UTC+1 (West Africa Time, no DST). A "day" begins at 00:00
// Africa/Lagos and the spin balance resets once per day at that midnight.
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const LAGOS_OFFSET_MS = 1 * HOUR_MS; // +01:00

// Epoch ms of the start of the current day in Nigerian time.
function nigerianDayStart(now: number): number {
  return Math.floor((now + LAGOS_OFFSET_MS) / DAY_MS) * DAY_MS - LAGOS_OFFSET_MS;
}

// Number of full top-up slots (each `windowMs` long) that have opened since the
// Nigerian midnight. The first slot (00:00–03:00) already counts as 1, so at
// 01:00 → 1 slot, 04:00 → 2, 07:00 → 3 (with a 3-hour window).
function slotsSinceMidnight(now: number, dayStart: number, windowMs: number): number {
  return Math.floor((now - dayStart) / windowMs) + 1;
}

// Total spins granted so far today = slots opened × spins-per-slot. This is
// deterministic from the clock, so the balance grows every window and resets
// automatically to slot 1 at the next Nigerian midnight.
function grantedToday(now: number, spinsPerWindow: number, windowMs: number): number {
  const dayStart = nigerianDayStart(now);
  return slotsSinceMidnight(now, dayStart, windowMs) * spinsPerWindow;
}

// Compute the remaining balance for a record. `spinsUsed` only counts when the
// record is still on the same Nigerian day; otherwise the day has reset.
function resolveBalance(
  record: { windowStart?: number; spinsUsedInWindow?: number; bonusSpins?: number } | null,
  now: number,
  spinsPerWindow: number,
  windowMs: number,
): { granted: number; used: number; bonus: number; remaining: number } {
  const dayStart = nigerianDayStart(now);
  const granted = grantedToday(now, spinsPerWindow, windowMs);
  const sameDay = record?.windowStart === dayStart;
  const used = sameDay ? (record?.spinsUsedInWindow ?? 0) : 0;
  const bonus = sameDay ? (record?.bonusSpins ?? 0) : 0;
  return { granted, used, bonus, remaining: Math.max(0, granted - used) + bonus };
}

export const getSpinStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const now = Date.now();
    const spinsPerWindow = await getNum(ctx, "spinsPerWindow");
    const windowHours = await getNum(ctx, "spinWindowHours") || 3;
    const windowMs = windowHours * HOUR_MS;
    const dayStart = nigerianDayStart(now);

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const { granted, used, bonus, remaining } = resolveBalance(
      spinRecord,
      now,
      spinsPerWindow,
      windowMs,
    );

    const adBonusEarned =
      spinRecord?.windowStart === dayStart ? (spinRecord.adBonusEarned ?? 0) : 0;
    const adBonusLimit = await getNum(ctx, "adBonusSpinsPerWindow");

    const nextSlotAt = dayStart + slotsSinceMidnight(now, dayStart, windowMs) * windowMs;
    const nextRefillMs = Math.max(0, nextSlotAt - now);
    const nextResetAt = dayStart + DAY_MS;

    return {
      spinsRemaining: remaining,
      baseSpinsRemaining: Math.max(0, granted - used),
      bonusSpins: bonus,
      adBonusEarned,
      adBonusLimit,
      adBonusRemaining: Math.max(0, adBonusLimit - adBonusEarned),
      nextRefillMs,
      nextRefillAt: nextSlotAt,
      nextResetAt,
      windowTotalMs: windowMs,
      // Additive fields for the Achievements hub (used vs granted today).
      spinsUsedInWindow: used,
      baseSpinsPerWindow: granted,
    };
  },
});

export const spin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUserAndEconomy(ctx, userId);
    const now = Date.now();
    const spinsPerWindow = await getNum(ctx, "spinsPerWindow");
    const windowHours = await getNum(ctx, "spinWindowHours") || 3;
    const windowMs = windowHours * HOUR_MS;
    const dayStart = nigerianDayStart(now);

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const { granted, used, bonus, remaining } = resolveBalance(
      spinRecord,
      now,
      spinsPerWindow,
      windowMs,
    );

    if (remaining <= 0) {
      throw new Error(`No spins left! Come back after the next ${windowHours}-hour top-up or watch an ad for extra spins.`);
    }

    // Consume a bonus spin first if available, else consume today's granted spin.
    let newBonusSpins = bonus;
    let newSpinsUsed = used;

    if (bonus > 0) {
      newBonusSpins = bonus - 1;
    } else {
      newSpinsUsed = used + 1;
    }

    const newAdBonusEarned = spinRecord?.windowStart === dayStart ? (spinRecord.adBonusEarned ?? 0) : 0;

    const configPrizes = await getJSON<{ pts: number; weight: number }[]>(ctx, "spinPrizes");
    const wheelPrizes = buildWheelPrizes(configPrizes);
    const prizeIndex = weightedPickIndex(wheelPrizes);
    const pts = wheelPrizes[prizeIndex].pts;

    // Do NOT credit bonus-spins for negative pts here — that happens on claimSpin
    // so the user only gets the reward after the wheel animation finishes.

    if (spinRecord) {
      await ctx.db.patch(spinRecord._id, {
        windowStart: dayStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins,
        adBonusEarned: newAdBonusEarned,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        windowStart: dayStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins,
        adBonusEarned: 0,
      });
    }

    // Create pending spin — points/bonus are only credited when claimSpin is called
    // after the 4.2s wheel animation, so the wheel number and the reward match.
    const pendingId = await ctx.db.insert("pendingSpins", {
      userId,
      pts,
      prizeIndex,
      claimed: false,
      createdAt: now,
    });

    return { spinId: pendingId, pts, prizeIndex, spinsRemaining: remaining - 1 };
  },
});

export const claimSpin = mutation({
  args: { userId: v.id("users"), spinId: v.id("pendingSpins"), doubled: v.optional(v.boolean()) },
  handler: async (ctx, { userId, spinId, doubled }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const pending = await ctx.db.get(spinId);
    if (!pending || pending.userId !== userId) throw new Error("Spin not found");
    if (pending.claimed) throw new Error("Already claimed");
    const pts = pending.pts;
    const isDoubled = doubled === true && pts > 0;
    const creditPts = isDoubled ? pts * 2 : pts;

    await ctx.db.patch(spinId, { claimed: true });

    // Negative pts means bonus spins — credit them now (after animation).
    if (pts < 0) {
      const now = Date.now();
      const dayStart = nigerianDayStart(now);
      const spinRecord = await ctx.db
        .query("dailySpins")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const extra = Math.abs(pts);
      if (spinRecord) {
        await ctx.db.patch(spinRecord._id, {
          bonusSpins: (spinRecord.bonusSpins ?? 0) + extra,
        });
      } else {
        await ctx.db.insert("dailySpins", {
          userId,
          windowStart: dayStart,
          spinsUsedInWindow: 0,
          bonusSpins: extra,
          adBonusEarned: 0,
        });
      }
      return { pts, prizeIndex: pending.prizeIndex, credited: 0, doubled: false, bonusSpins: extra };
    }

    if (creditPts > 0) {
      await appendLedger(ctx, userId, economy, creditPts, "SPIN_WHEEL", `spin-${pending.createdAt}${isDoubled ? "-2x" : ""}`);

      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (wallet) {
        const newPoints =
          economy === "pi-browser"
            ? (wallet.piBrowserPointsBalance ?? 0) + creditPts
            : wallet.pointsBalance + creditPts;
        await ctx.db.patch(
          wallet._id,
          economy === "pi-browser"
            ? { piBrowserPointsBalance: newPoints }
            : { pointsBalance: newPoints },
        );

        await ctx.db.insert("walletTransactions", {
          userId,
          type: "earn_points",
          pointsDelta: creditPts,
          piproDelta: 0,
          pointsBalanceAfter: newPoints,
          piproBalanceAfter: wallet.piproBalance,
          note: `Spin Wheel Prize (+${creditPts} PTS${isDoubled ? " 2x" : ""}, ${economy})`,
        });
      }
    }

    return { pts, prizeIndex: pending.prizeIndex, credited: creditPts, doubled: isDoubled, bonusSpins: 0 };
  },
});

export const earnBonusSpin = mutation({
  args: { userId: v.id("users"), amount: v.optional(v.number()) },
  handler: async (ctx, { userId, amount }) => {
    await requireUser(ctx, userId);
    const now = Date.now();
    const dayStart = nigerianDayStart(now);
    const windowHours = await getNum(ctx, "spinWindowHours") || 3;
    const addCount = Math.max(1, amount ?? 1);
    const adBonusLimit = await getNum(ctx, "adBonusSpinsPerWindow");

    const spinRecord = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const sameDay = spinRecord?.windowStart === dayStart;
    const earnedInWindow = sameDay ? (spinRecord?.adBonusEarned ?? 0) : 0;

    // Cap bonus spins earned from ads to adBonusSpinsPerWindow per day.
    if (earnedInWindow + addCount > adBonusLimit) {
      throw new Error(
        `Bonus spin limit reached — ${adBonusLimit} per day. Try again after midnight!`,
      );
    }

    if (spinRecord) {
      const currentBonus = spinRecord.bonusSpins ?? 0;
      await ctx.db.patch(spinRecord._id, {
        windowStart: dayStart,
        bonusSpins: currentBonus + addCount,
        adBonusEarned: earnedInWindow + addCount,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        windowStart: dayStart,
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
      spinsPerWindow: windowHours,
    };
  },
});
