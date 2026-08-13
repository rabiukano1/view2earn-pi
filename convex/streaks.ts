import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOptionalUser, requireUser, requireUserAndEconomy } from "./lib/guards";
import { getJSON, getNum } from "./rewardsConfig";
import { consumeRewardedAd } from "./piAds";
import { appendLedger } from "./lib/ledger";

function dayNumber(ms: number): number {
  return Math.floor(ms / 86400000); // UTC day. TODO(prod): user timezone.
}

// The streak value that today's check-in would produce, given prior state.
function effectiveStreak(current: number, lastDay: number | null, today: number): number {
  if (lastDay === today) return current; // already checked in today
  if (lastDay === today - 1) return current + 1; // consecutive day
  return 1; // first ever, or streak broke
}

export const getStreak = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getOptionalUser(ctx, userId);
    const schedule = await getJSON<number[]>(ctx, "streakSchedule");
    if (!user) {
      return {
        current: 0,
        longest: 0,
        checkedInToday: false,
        canCheckIn: false,
        cycleDay: 1,
        todayReward: schedule[0] ?? 10,
        schedule,
      };
    }
    const row = await ctx.db
      .query("streaks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const today = dayNumber(Date.now());
    const current = row?.current ?? 0;
    const lastDay = row?.lastDay ?? null;
    const checkedInToday = lastDay === today;
    const eff = effectiveStreak(current, lastDay, today);
    const cycleDay = ((eff - 1) % 7) + 1;

    return {
      current: checkedInToday ? current : current,
      longest: row?.longest ?? 0,
      checkedInToday,
      canCheckIn: !checkedInToday,
      cycleDay,
      todayReward: schedule[cycleDay - 1],
      schedule,
    };
  },
});

export const checkIn = mutation({
  args: {
    userId: v.id("users"),
    adId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, adId }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const today = dayNumber(Date.now());
    const row = await ctx.db
      .query("streaks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (row && row.lastDay === today) {
      throw new Error("Already checked in today — come back tomorrow!");
    }

    // Rewarded-ad gate (mirrors Android's StreakCard): the check-in reward is
    // only granted after the ad is verified server-side. Runs before the ledger
    // write so a failed ad rolls the whole transaction back.
    if (adId) await consumeRewardedAd(ctx, userId, adId);

    const streak = effectiveStreak(row?.current ?? 0, row?.lastDay ?? null, today);
    const longest = Math.max(row?.longest ?? 0, streak);
    const schedule = await getJSON<number[]>(ctx, "streakSchedule");
    const reward = schedule[((streak - 1) % 7)];

    if (row) {
      await ctx.db.patch(row._id, { current: streak, longest, lastDay: today });
    } else {
      await ctx.db.insert("streaks", { userId, current: streak, longest, lastDay: today });
    }

    // Append-only points ledger, economy-tagged (server-derived economy).
    await appendLedger(ctx, userId, economy, reward, "DAILY_CHECKIN", `day-${today}`);

    return { reward, current: streak, longest };
  },
});
