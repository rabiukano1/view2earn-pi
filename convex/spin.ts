import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { deriveEconomy, requireUser, requireUserAndSurface } from "./lib/guards";
import type { Surface } from "./lib/guards";
import { getJSON, getNum } from "./rewardsConfig";
import { appendLedger, economyOfUser, lastBalance } from "./lib/ledger";
import { consumeRewardedAd } from "./piAds";

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
  record: { windowStart?: number; spinsUsedInWindow?: number; bonusSpins?: number; extraSpins?: number } | null,
  now: number,
  spinsPerWindow: number,
  windowMs: number,
): { granted: number; used: number; bonus: number; extra: number; remaining: number } {
  const dayStart = nigerianDayStart(now);
  const granted = grantedToday(now, spinsPerWindow, windowMs);
  const sameDay = record?.windowStart === dayStart;
  const used = sameDay ? (record?.spinsUsedInWindow ?? 0) : 0;
  const bonus = sameDay ? (record?.bonusSpins ?? 0) : 0;
  const extra = record?.extraSpins ?? 0; // admin-granted: survives midnight
  return { granted, used, bonus, extra, remaining: Math.max(0, granted - used) + bonus + extra };
}

/** Admin: add (+) or remove (−) spins on one surface. Added spins go to
 *  extraSpins (never reset). Removal takes extra → today's bonus → today's free
 *  spins and stops at 0. Returns the change actually applied. */
export async function adminAdjustSpins(
  ctx: MutationCtx,
  userId: Id<"users">,
  economy: Surface,
  delta: number,
): Promise<number> {
  const rec = await getSpinRecord(ctx, userId, economy);
  if (delta > 0) {
    if (rec) await ctx.db.patch(rec._id, { extraSpins: (rec.extraSpins ?? 0) + delta });
    else await ctx.db.insert("dailySpins", { userId, economy, extraSpins: delta });
    return delta;
  }
  if (!rec) return 0;
  const now = Date.now();
  const dayStart = nigerianDayStart(now);
  const windowMs = ((await getNum(ctx, "spinWindowHours", economy)) || 3) * HOUR_MS;
  const spinsPerWindow = await getNum(ctx, "spinsPerWindow", economy);
  const { granted, used, bonus, extra } = resolveBalance(rec, now, spinsPerWindow, windowMs);
  let left = -delta;
  const fromExtra = Math.min(extra, left); left -= fromExtra;
  const fromBonus = Math.min(bonus, left); left -= fromBonus;
  const fromFree = Math.min(Math.max(0, granted - used), left);
  const removed = fromExtra + fromBonus + fromFree;
  if (!removed) return 0;
  await ctx.db.patch(rec._id, {
    windowStart: dayStart,
    extraSpins: extra - fromExtra,
    bonusSpins: bonus - fromBonus,
    spinsUsedInWindow: used + fromFree,
    adBonusEarned: rec.windowStart === dayStart ? (rec.adBonusEarned ?? 0) : 0,
  });
  return -removed;
}

// Shared points credit: ledger row + wallet balance mirror + wallet history.
// Used by spin() (immediate base credit), claimSpin() (2x extra / legacy
// rows) and the stale-pending recovery sweep so all paths stay identical.
async function creditSpinPoints(
  ctx: MutationCtx,
  userId: Id<"users">,
  economy: Surface,
  pts: number,
  reason: string,
  refId: string,
  note: string,
): Promise<number> {
  const balanceAfter = await appendLedger(ctx, userId, economy, pts, reason, refId);

  const wallet = await ctx.db
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
      note,
    });
  }

  return balanceAfter;
}

// Spin record for (user, surface). A legacy row without `economy` belongs to
// the user's home economy and is adopted (stamped) the first time that surface
// touches it, so accumulated bonus spins are not lost.
async function getSpinRecord(ctx: QueryCtx | MutationCtx, userId: Id<"users">, economy: Surface) {
  const scoped = await ctx.db
    .query("dailySpins")
    .withIndex("by_user_economy", (q) => q.eq("userId", userId).eq("economy", economy))
    .unique();
  if (scoped) return scoped;
  const user = await ctx.db.get(userId);
  if (!user || deriveEconomy(user) !== economy) return null;
  const legacy = await ctx.db
    .query("dailySpins")
    .withIndex("by_user_economy", (q) => q.eq("userId", userId).eq("economy", undefined))
    .unique();
  if (legacy && "scheduler" in ctx) {
    await (ctx as MutationCtx).db.patch(legacy._id, { economy });
  }
  return legacy;
}

export const getSpinStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { economy } = await requireUserAndSurface(ctx, userId);
    const now = Date.now();
    const spinsPerWindow = await getNum(ctx, "spinsPerWindow", economy);
    const windowHours = await getNum(ctx, "spinWindowHours", economy) || 3;
    const windowMs = windowHours * HOUR_MS;
    const dayStart = nigerianDayStart(now);

    const spinRecord = await getSpinRecord(ctx, userId, economy);

    const { granted, used, bonus, extra, remaining } = resolveBalance(
      spinRecord,
      now,
      spinsPerWindow,
      windowMs,
    );

    const adBonusEarned =
      spinRecord?.windowStart === dayStart ? (spinRecord.adBonusEarned ?? 0) : 0;
    const adBonusLimit = await getNum(ctx, "adBonusSpinsPerWindow", economy);

    const nextSlotAt = dayStart + slotsSinceMidnight(now, dayStart, windowMs) * windowMs;
    const nextRefillMs = Math.max(0, nextSlotAt - now);
    const nextResetAt = dayStart + DAY_MS;

    return {
      spinsRemaining: remaining,
      baseSpinsRemaining: Math.max(0, granted - used),
      bonusSpins: bonus,
      extraSpins: extra,
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
    const { economy } = await requireUserAndSurface(ctx, userId);
    const now = Date.now();
    const spinsPerWindow = await getNum(ctx, "spinsPerWindow", economy);
    const windowHours = await getNum(ctx, "spinWindowHours", economy) || 3;
    const windowMs = windowHours * HOUR_MS;
    const dayStart = nigerianDayStart(now);

    const spinRecord = await getSpinRecord(ctx, userId, economy);

    const { granted, used, bonus, extra, remaining } = resolveBalance(
      spinRecord,
      now,
      spinsPerWindow,
      windowMs,
    );

    if (remaining <= 0) {
      throw new Error(`No spins left! Come back after the next ${windowHours}-hour top-up or watch an ad for extra spins.`);
    }

    // Consume a bonus spin first, then today's granted spins, and admin-granted
    // extra spins last (they don't expire, so keep them longest).
    let newBonusSpins = bonus;
    let newSpinsUsed = used;
    let newExtraSpins = extra;

    if (bonus > 0) {
      newBonusSpins = bonus - 1;
    } else if (granted - used > 0) {
      newSpinsUsed = used + 1;
    } else {
      newExtraSpins = extra - 1;
    }

    const newAdBonusEarned = spinRecord?.windowStart === dayStart ? (spinRecord.adBonusEarned ?? 0) : 0;

    const configPrizes = await getJSON<{ pts: number; weight: number }[]>(ctx, "spinPrizes");
    const wheelPrizes = buildWheelPrizes(configPrizes);
    const prizeIndex = weightedPickIndex(wheelPrizes);
    const pts = wheelPrizes[prizeIndex].pts;

    // Bonus-spin prizes (negative pts) are added to bonusSpins right away —
    // there is no "double" option for them, so there is nothing left to wait for.
    const bonusSpinsToAdd = pts < 0 ? Math.abs(pts) : 0;

    if (spinRecord) {
      await ctx.db.patch(spinRecord._id, {
        windowStart: dayStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins + bonusSpinsToAdd,
        extraSpins: newExtraSpins,
        adBonusEarned: newAdBonusEarned,
      });
    } else {
      await ctx.db.insert("dailySpins", {
        userId,
        economy,
        windowStart: dayStart,
        spinsUsedInWindow: newSpinsUsed,
        bonusSpins: newBonusSpins + bonusSpinsToAdd,
        adBonusEarned: 0,
      });
    }

    // Points are NOT credited here: the wheel is still spinning on the client,
    // and crediting now makes the balance jump before the wheel stops.
    // The prize is reserved on this row and paid by:
    //   claimSpin()          - the normal path, once the animation finishes
    //   applySpinDouble()    - the watch-ad-to-double path (pays pts * 2)
    //   recoverStalePendingSpins (hourly cron) - the safety net, for a client
    //       that never claims (force-close/app-kill). It pays any uncredited
    //       row older than SPIN_CLOSEOUT_AFTER_MS, so a reward is delayed at
    //       worst, never lost.
    const pendingId = await ctx.db.insert("pendingSpins", {
      userId,
      pts,
      prizeIndex,
      claimed: pts <= 0,
      createdAt: now,
      baseCredited: false,
    });

    const balanceAfter = await lastBalance(ctx, userId, economy);
    return {
      spinId: pendingId,
      pts,
      prizeIndex,
      spinsRemaining: remaining - 1,
      // Nothing is credited yet — claimSpin() pays after the wheel stops.
      credited: 0,
      balanceAfter,
    };
  },
});

export const claimSpin = mutation({
  args: {
    userId: v.id("users"),
    spinId: v.id("pendingSpins"),
    doubled: v.optional(v.boolean()),
    adId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, spinId, doubled, adId }) => {
    const { economy } = await requireUserAndSurface(ctx, userId);
    // Pi Ad Network 2x: verify the rewarded adId before paying the double.
    if (doubled && adId) await consumeRewardedAd(ctx, userId, adId);
    const pending = await ctx.db.get(spinId);
    if (!pending || pending.userId !== userId) throw new Error("Spin not found");
    const pts = pending.pts;
    const isDoubled = doubled === true && pts > 0;

    // Idempotent: spin() already finalizes bonus-spin / no-bonus rows, and a
    // double-tap can resend a claim. Report the settled state, never re-credit.
    if (pending.claimed) {
      return {
        pts,
        prizeIndex: pending.prizeIndex,
        credited: pts > 0 ? (isDoubled ? pts * 2 : pts) : 0,
        doubled: isDoubled,
        bonusSpins: pts < 0 ? Math.abs(pts) : 0,
        balanceAfter: await lastBalance(ctx, userId, economy),
      };
    }

    // pts <= 0 rows (bonus spins / no-bonus) are fully handled by spin()
    // itself now — this just finalizes the row for an older client that
    // still calls claimSpin() after every spin.
    if (pts <= 0) {
      await ctx.db.patch(spinId, { claimed: true });
      return {
        pts,
        prizeIndex: pending.prizeIndex,
        credited: 0,
        doubled: false,
        bonusSpins: pts < 0 ? Math.abs(pts) : 0,
        balanceAfter: await lastBalance(ctx, userId, economy),
      };
    }

    // Base points were already credited by spin() itself (baseCredited).
    // This call either adds the 2x-double extra, credits the base as a
    // fallback for a legacy pending row that predates that change, or — for
    // a plain (non-doubled) claim on an already-credited row — just reports
    // the amount without crediting again. A plain claim deliberately does
    // NOT mark the row `claimed`, so a later "watch ad to double" tap on the
    // same spin can still succeed.
    const alreadyBased = pending.baseCredited === true;
    let credited = alreadyBased ? pts : 0;

    if (isDoubled) {
      const extra = alreadyBased ? pts : pts * 2;
      if (extra > 0) {
        await creditSpinPoints(
          ctx,
          userId,
          economy,
          extra,
          "SPIN_WHEEL",
          `spin-${spinId}-2x`,
          `Spin Wheel 2x Extra (+${extra} PTS, ${economy})`,
        );
      }
      await ctx.db.patch(spinId, { baseCredited: true, claimed: true });
      await ctx.db.insert("adWatchLogs", { userId, kind: "spin_double", provider: "admob", points: extra, economy, at: Date.now() });
      credited = pts * 2;
    } else if (!alreadyBased) {
      await creditSpinPoints(
        ctx,
        userId,
        economy,
        pts,
        "SPIN_WHEEL",
        `spin-${spinId}`,
        `Spin Wheel Prize (+${pts} PTS, ${economy})`,
      );
      await ctx.db.patch(spinId, { baseCredited: true, claimed: true });
      credited = pts;
    }

    // Same-transaction authoritative balance so the client never depends on
    // subscription timing to show the exact new total.
    const balanceAfter = await lastBalance(ctx, userId, economy);
    return { pts, prizeIndex: pending.prizeIndex, credited, doubled: isDoubled, bonusSpins: 0, balanceAfter };
  },
});

// A spin row stays open (claimed:false) after its base credit so a later
// watch-ad-to-double can still top it up. Only close one out once it is old
// enough that no double can still be in flight for it.
const SPIN_CLOSEOUT_AFTER_MS = 15 * 60 * 1000;

/**
 * Applies the watch-ad "2x" top-up to the user's most recent still-open spin.
 *
 * The build currently on the Play Store calls ads.rewardForAd({ adType:
 * "spin_double_bonus" }) the moment the rewarded ad finishes — that call is the
 * only server-visible proof the ad was actually watched on that build. Crediting
 * from there means the 2x lands without depending on any follow-up call from the
 * app, which is what was silently dropping the double.
 *
 * Idempotent: the row is marked claimed, so a later claimSpin(doubled:true) for
 * the same spin finds nothing left to pay out and cannot double-credit.
 * Returns the number of points credited (0 if there was no eligible spin).
 */
export async function applySpinDouble(
  ctx: MutationCtx,
  userId: Id<"users">,
  economy: Surface,
): Promise<number> {
  const now = Date.now();
  const pendings = await ctx.db
    .query("pendingSpins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  let target: (typeof pendings)[number] | null = null;
  for (const p of pendings) {
    if (p.claimed || p.pts <= 0) continue;
    if (now - p.createdAt > SPIN_CLOSEOUT_AFTER_MS) continue;
    if (!target || p.createdAt > target.createdAt) target = p;
  }
  if (!target) return 0;

  // Base is normally already paid by spin(); a legacy row may still owe it.
  const extra = target.baseCredited === true ? target.pts : target.pts * 2;
  await creditSpinPoints(
    ctx,
    userId,
    economy,
    extra,
    "SPIN_WHEEL",
    `spin-${target._id}-2x`,
    `Spin Wheel 2x Extra (+${extra} PTS, ${economy})`,
  );
  await ctx.db.patch(target._id, { baseCredited: true, claimed: true });
  await ctx.db.insert("adWatchLogs", { userId, kind: "spin_double", provider: "admob", points: extra, economy, at: Date.now() });
  return extra;
}

// Credits legacy unclaimed positive pendings for one user (rows written before
// spin() started crediting base points immediately). Marks them claimed so
// they can never be paid twice. Returns the number of rows recovered.
async function recoverUserPendings(
  ctx: MutationCtx,
  userId: Id<"users">,
  economy: Surface,
  onlyOlderThanMs: number | null,
): Promise<number> {
  const pendings = await ctx.db
    .query("pendingSpins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const now = Date.now();
  let recovered = 0;
  for (const p of pendings) {
    if (p.claimed) continue;
    if (p.baseCredited === true || p.pts <= 0) {
      // Base already paid (by spin() itself) and never doubled — close the row
      // out so it stops showing up in every future unclaimed scan, but only
      // once no watch-ad-to-double can still be in flight for it.
      if (now - p.createdAt > SPIN_CLOSEOUT_AFTER_MS) {
        await ctx.db.patch(p._id, { claimed: true });
      }
      continue;
    }
    if (onlyOlderThanMs !== null && now - p.createdAt < onlyOlderThanMs) continue;
    await creditSpinPoints(
      ctx,
      userId,
      economy,
      p.pts,
      "SPIN_WHEEL",
      `spin-recover-${p._id}`,
      `Spin recovery (+${p.pts} PTS, ${economy})`,
    );
    await ctx.db.patch(p._id, { baseCredited: true, claimed: true });
    recovered++;
  }
  return recovered;
}

/**
 * Client self-heal: call on SpinScreen mount. Instantly pays out any points
 * orphaned by an older client (spin consumed, claim never landed) and reports
 * how many were recovered so the UI can tell the user.
 */
export const syncUnclaimedSpins = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { economy } = await requireUserAndSurface(ctx, userId);
    const recovered = await recoverUserPendings(ctx, userId, economy, null);
    const balanceAfter = await lastBalance(ctx, userId, economy);
    return { recovered, balanceAfter };
  },
});

/**
 * Server safety net (called hourly by cron): recovers points for users on old
 * app versions that never call syncUnclaimedSpins. Only touches pendings
 * older than 15 minutes so live double-or-claim sessions are never disturbed.
 */
export const recoverStalePendingSpins = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Indexed: reads at most 200 rows. The previous .filter() version was a
    // post-read filter and scanned the entire table on every run.
    const stale = await ctx.db
      .query("pendingSpins")
      .withIndex("by_claimed_createdAt", (q) => q.eq("claimed", false))
      .take(200);
    const byUser = new Map<string, typeof stale>();
    for (const p of stale) {
      const list = byUser.get(p.userId) ?? [];
      list.push(p);
      byUser.set(p.userId, list);
    }
    let recovered = 0;
    for (const [userId, rows] of byUser) {
      try {
        const economy = await economyOfUser(ctx, userId as Id<"users">);
        for (const p of rows) {
          if (p.baseCredited === true || p.pts <= 0) {
            // Base already paid and never doubled — close it out so it doesn't
            // keep occupying the 200-row scan window every hour, but only once
            // no watch-ad-to-double can still be in flight for it.
            if (Date.now() - p.createdAt > SPIN_CLOSEOUT_AFTER_MS) {
              await ctx.db.patch(p._id, { claimed: true });
            }
            continue;
          }
          if (Date.now() - p.createdAt < SPIN_CLOSEOUT_AFTER_MS) continue;
          await creditSpinPoints(
            ctx,
            userId as Id<"users">,
            economy,
            p.pts,
            "SPIN_WHEEL",
            `spin-recover-${p._id}`,
            `Spin recovery (+${p.pts} PTS, ${economy})`,
          );
          await ctx.db.patch(p._id, { baseCredited: true, claimed: true });
          recovered++;
        }
      } catch {
        // Deleted/suspended user — skip, retry next run.
      }
    }
    return { scanned: stale.length, recovered };
  },
});

export const earnBonusSpin = mutation({
  args: { userId: v.id("users"), amount: v.optional(v.number()) },
  handler: async (ctx, { userId, amount }) => {
    const { economy } = await requireUserAndSurface(ctx, userId);
    const now = Date.now();
    const dayStart = nigerianDayStart(now);
    const windowHours = await getNum(ctx, "spinWindowHours", economy) || 3;
    const addCount = Math.max(1, amount ?? 1);
    const adBonusLimit = await getNum(ctx, "adBonusSpinsPerWindow", economy);

    const spinRecord = await getSpinRecord(ctx, userId, economy);

    const sameDay = spinRecord?.windowStart === dayStart;
    const earnedInWindow = sameDay ? (spinRecord?.adBonusEarned ?? 0) : 0;

    // Cap bonus spins earned from ads to adBonusSpinsPerWindow per day.
    if (earnedInWindow + addCount > adBonusLimit) {
      throw new Error(
        `Bonus spin limit reached — ${adBonusLimit} per day. Try again after midnight!`,
      );
    }

    await ctx.db.insert("adWatchLogs", { userId, kind: "spin_bonus", provider: "admob", points: 0, economy, at: now });

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
        economy,
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

// Retention for pendingSpins. Settled rows (claimed, past the close-out
// window) are history: their points are already in pointsLedger. Without this
// the table only grows — it reached 43 868 rows (36% of all documents) before
// retention existed.
//
// Batched and self-rescheduling: it drains a backlog in minutes, then does
// almost nothing each day. Bounded by PURGE_OLDER_THAN_MS, so it terminates.
const PURGE_OLDER_THAN_MS = 7 * 24 * 60 * 60 * 1000;
// A mutation is capped at ~1s and a limited number of DB operations, and each
// row costs a read AND a delete. Measured: 200 works, 500 exceeds the limit.
const PURGE_BATCH = 200;

export const purgeSettledSpins = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    const cutoff = Date.now() - PURGE_OLDER_THAN_MS;
    const batch = await ctx.db
      .query("pendingSpins")
      .withIndex("by_claimed_createdAt", (q) =>
        q.eq("claimed", true).lt("createdAt", cutoff),
      )
      .take(PURGE_BATCH);

    if (dryRun) {
      // Report only; nothing is deleted. `more` means another full batch exists.
      // oldestRemaining advances as the purge drains (rows go oldest-first),
      // which is the only progress signal that is not capped by PURGE_BATCH.
      return {
        dryRun: true,
        wouldDelete: batch.length,
        more: batch.length === PURGE_BATCH,
        oldestRemaining: batch[0] ? new Date(batch[0].createdAt).toISOString() : null,
      };
    }

    for (const row of batch) await ctx.db.delete(row._id);

    // Full batch => more to go. Continue immediately: batches are sequential,
    // so this drains a large backlog in minutes instead of hours, then the
    // daily cron finds almost nothing to do.
    if (batch.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.spin.purgeSettledSpins, {});
    }
    return { deleted: batch.length, more: batch.length === PURGE_BATCH };
  },
});
