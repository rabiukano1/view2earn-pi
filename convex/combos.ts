import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { getNum } from "./rewardsConfig";

function dayNumber(ms: number): number {
  return Math.floor(ms / 86400000);
}

async function legsToday(ctx: any, userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const since = start.getTime();

  const vers = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const active = vers.filter(
    (x: any) => x.state !== "CANCELLED" && x.state !== "REJECTED" && x._creationTime >= since,
  );
  const social = active.some((x: any) => x.platform === "facebook" || x.platform === "tiktok");
  const telegram = active.some((x: any) => x.platform === "telegram");

  const quizzes = await ctx.db
    .query("quizResults")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const quiz = quizzes.some((x: any) => x._creationTime >= since);

  return { social, telegram, quiz };
}

export const getComboStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const today = dayNumber(Date.now());
    const combo = await ctx.db
      .query("combos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const legs = await legsToday(ctx, userId);
    const allDone = legs.social && legs.telegram && legs.quiz;
    const reward = await getNum(ctx, "comboBonus");
    return {
      ...legs,
      allDone,
      claimedToday: combo?.lastDay === today,
      canClaim: allDone && combo?.lastDay !== today,
      reward,
    };
  },
});

export const claimCombo = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const today = dayNumber(Date.now());

    const combo = await ctx.db
      .query("combos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (combo?.lastDay === today) {
      throw new Error("Combo bonus already claimed today.");
    }
    const legs = await legsToday(ctx, userId);
    if (!(legs.social && legs.telegram && legs.quiz)) {
      throw new Error("Finish all three today to claim the combo.");
    }

    const reward = await getNum(ctx, "comboBonus");

    if (combo) {
      await ctx.db.patch(combo._id, { lastDay: today });
    } else {
      await ctx.db.insert("combos", { userId, lastDay: today });
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
      reason: "COMBO_BONUS",
      refId: `combo-${today}`,
      balanceAfter,
    });

    return { reward };
  },
});
