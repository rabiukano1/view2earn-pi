import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { ACADEMY, getLesson, scoreGate } from "@view2earn/core";
import { getNum } from "./rewardsConfig";

const ecosystemArg = v.union(v.literal("PI"), v.literal("SIDRA"));

// Highest level this user has passed in an ecosystem (0 if none).
async function maxPassed(
  ctx: any,
  userId: any,
  ecosystem: "PI" | "SIDRA",
): Promise<{ max: number; passed: Set<number> }> {
  const rows = await ctx.db
    .query("academyProgress")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const passed = new Set<number>();
  let max = 0;
  for (const r of rows) {
    if (r.ecosystem !== ecosystem) continue;
    passed.add(r.level);
    if (r.level > max) max = r.level;
  }
  return { max, passed };
}

export const getAcademy = query({
  args: { userId: v.id("users"), ecosystem: ecosystemArg },
  handler: async (ctx, { userId, ecosystem }) => {
    await requireUser(ctx, userId);
    const { max, passed } = await maxPassed(ctx, userId, ecosystem);
    // Level N unlocks once N-1 is passed; level 1 is always open.
    return ACADEMY[ecosystem].map((l) => ({
      level: l.level,
      title: l.title,
      body: l.body,
      locked: l.level > max + 1,
      passed: passed.has(l.level),
      // Answers/explanations are withheld until the user submits.
      quiz: l.quiz.map((q) => ({ question: q.question, options: q.options })),
    }));
  },
});

export const submitLevel = mutation({
  args: {
    userId: v.id("users"),
    ecosystem: ecosystemArg,
    level: v.number(),
    answers: v.array(v.number()), // selected option index per question, in order
  },
  handler: async (ctx, { userId, ecosystem, level, answers }) => {
    await requireUser(ctx, userId);
    const lesson = getLesson(ecosystem, level);
    if (!lesson) throw new Error("Unknown lesson");

    const { max, passed } = await maxPassed(ctx, userId, ecosystem);
    if (level > max + 1) throw new Error("Level is locked — pass the previous level first");

    const { score, total, passed: didPass } = scoreGate(lesson, answers);

    let pointsEarned = 0;
    if (didPass && !passed.has(level)) {
      await ctx.db.insert("academyProgress", {
        userId,
        ecosystem,
        level,
        passedAt: Date.now(),
      });
      pointsEarned = await getNum(ctx, "academyLevelPoints");
      const last = await ctx.db
        .query("pointsLedger")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
      await ctx.db.insert("pointsLedger", {
        userId,
        delta: pointsEarned,
        reason: "ACADEMY_LEVEL",
        refId: `${ecosystem}:${level}`,
        balanceAfter: (last?.balanceAfter ?? 0) + pointsEarned,
      });
    }

    return {
      score,
      total,
      passed: didPass,
      pointsEarned,
      // Reveal answers now so the screen can show what was right/wrong.
      review: lesson.quiz.map((q, i) => ({
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        selected: answers[i] ?? -1,
      })),
    };
  },
});
