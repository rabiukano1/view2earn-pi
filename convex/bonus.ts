import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";

// Daily mystery box (plan §7.11b): unlocks after 3 tasks in a day, one open
// per day, random bonus. Weighted toward smaller rewards.
const TASKS_NEEDED = 3;
const PRIZES: { pts: number; weight: number }[] = [
  { pts: 10, weight: 30 },
  { pts: 20, weight: 25 },
  { pts: 30, weight: 20 },
  { pts: 50, weight: 15 },
  { pts: 100, weight: 8 },
  { pts: 250, weight: 2 },
];

function dayNumber(ms: number): number {
  return Math.floor(ms / 86400000);
}

async function tasksToday(ctx: any, userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const since = start.getTime();
  const mine = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  return mine.filter(
    (v: any) =>
      v.state !== "CANCELLED" && v.state !== "REJECTED" && v._creationTime >= since,
  ).length;
}

function pickPrize(): number {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    if (r < p.weight) return p.pts;
    r -= p.weight;
  }
  return PRIZES[0].pts;
}

export const getBoxStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const today = dayNumber(Date.now());
    const box = await ctx.db
      .query("dailyBoxes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const done = await tasksToday(ctx, userId);
    return {
      tasksToday: Math.min(done, TASKS_NEEDED),
      needed: TASKS_NEEDED,
      openedToday: box?.lastDay === today,
      eligible: done >= TASKS_NEEDED && box?.lastDay !== today,
    };
  },
});

export const openBox = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const today = dayNumber(Date.now());

    const box = await ctx.db
      .query("dailyBoxes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (box?.lastDay === today) {
      throw new Error("You've already opened today's box. Come back tomorrow!");
    }
    if ((await tasksToday(ctx, userId)) < TASKS_NEEDED) {
      throw new Error(`Complete ${TASKS_NEEDED} tasks today to unlock the box.`);
    }

    const reward = pickPrize();
    if (box) {
      await ctx.db.patch(box._id, { lastDay: today });
    } else {
      await ctx.db.insert("dailyBoxes", { userId, lastDay: today });
    }

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const balanceAfter = (last?.balanceAfter ?? 0) + reward;
    await ctx.db.insert("pointsLedger", {
      userId,
      delta: reward,
      reason: "MYSTERY_BOX",
      refId: `box-${today}`,
      balanceAfter,
    });

    return { reward };
  },
});
