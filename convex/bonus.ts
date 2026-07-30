import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { getJSON, getNum } from "./rewardsConfig";

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

function pickPrize(prizes: { pts: number; weight: number }[]): number {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) {
    if (r < p.weight) return p.pts;
    r -= p.weight;
  }
  return prizes[0].pts;
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
    const needed = await getNum(ctx, "mysteryBoxTasksNeeded");
    return {
      tasksToday: Math.min(done, needed),
      needed,
      openedToday: box?.lastDay === today,
      eligible: done >= needed && box?.lastDay !== today,
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
    const needed = await getNum(ctx, "mysteryBoxTasksNeeded");
    if (box?.lastDay === today) {
      throw new Error("You've already opened today's box. Come back tomorrow!");
    }
    if ((await tasksToday(ctx, userId)) < needed) {
      throw new Error(`Complete ${needed} tasks today to unlock the box.`);
    }

    const prizes = await getJSON<{ pts: number; weight: number }[]>(ctx, "mysteryBoxPrizes");
    const reward = pickPrize(prizes);
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
