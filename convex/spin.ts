import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { SPIN_PRIZES, pickSpinIndex } from "@view2earn/core";

// Daily spin wheel (plan §7.11b): one free spin per day, weighted prize.
// Prize table + weighting live in @view2earn/core, shared with the screen.

function dayNumber(ms: number): number {
  return Math.floor(ms / 86400000);
}

export const getSpinStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const spin = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return { spunToday: spin?.lastDay === dayNumber(Date.now()) };
  },
});

export const spin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const today = dayNumber(Date.now());

    const spin = await ctx.db
      .query("dailySpins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (spin?.lastDay === today) {
      throw new Error("You've already spun today. Come back tomorrow!");
    }

    const index = pickSpinIndex();
    const pts = SPIN_PRIZES[index].pts;

    if (spin) {
      await ctx.db.patch(spin._id, { lastDay: today });
    } else {
      await ctx.db.insert("dailySpins", { userId, lastDay: today });
    }

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    await ctx.db.insert("pointsLedger", {
      userId,
      delta: pts,
      reason: "SPIN_WHEEL",
      refId: `spin-${today}`,
      balanceAfter: (last?.balanceAfter ?? 0) + pts,
    });

    return { index, pts };
  },
});
