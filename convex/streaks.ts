import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";

// Growing rewards across a 7-day cycle (plan §7.11b). Day 7 is the big one;
// the cycle repeats while the streak keeps climbing.
const SCHEDULE = [10, 15, 20, 25, 30, 40, 75];

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
    await requireUser(ctx, userId);
    const row = await ctx.db
      .query("streaks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const today = dayNumber(Date.now());
    const current = row?.current ?? 0;
    const lastDay = row?.lastDay ?? null;
    const checkedInToday = lastDay === today;
    const eff = effectiveStreak(current, lastDay, today);
    const cycleDay = ((eff - 1) % 7) + 1; // 1..7 position in the reward cycle

    return {
      current: checkedInToday ? current : current, // display streak so far
      longest: row?.longest ?? 0,
      checkedInToday,
      canCheckIn: !checkedInToday,
      cycleDay,
      todayReward: SCHEDULE[cycleDay - 1],
      schedule: SCHEDULE,
    };
  },
});

export const checkIn = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const today = dayNumber(Date.now());
    const row = await ctx.db
      .query("streaks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (row && row.lastDay === today) {
      throw new Error("Already checked in today — come back tomorrow!");
    }

    const streak = effectiveStreak(row?.current ?? 0, row?.lastDay ?? null, today);
    const longest = Math.max(row?.longest ?? 0, streak);
    const reward = SCHEDULE[((streak - 1) % 7)];

    if (row) {
      await ctx.db.patch(row._id, { current: streak, longest, lastDay: today });
    } else {
      await ctx.db.insert("streaks", { userId, current: streak, longest, lastDay: today });
    }

    // Append-only points ledger (plan §6), same pattern as rewards/tasks.
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const balanceAfter = (last?.balanceAfter ?? 0) + reward;
    await ctx.db.insert("pointsLedger", {
      userId,
      delta: reward,
      reason: "DAILY_CHECKIN",
      refId: `day-${today}`,
      balanceAfter,
    });

    return { reward, current: streak, longest };
  },
});
