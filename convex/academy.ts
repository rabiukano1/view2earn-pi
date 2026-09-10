import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { scoreGate } from "@view2earn/core";
import { getNum } from "./rewardsConfig";
import { appendLedger } from "./lib/ledger";
import { awardXP } from "./xp";

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

// Fetch all published courses and lessons, flattening them into a sequential "level" list.
async function getDynamicLessons(ctx: any, ecosystem: "PI" | "SIDRA") {
  // If ecosystem is SIDRA, we currently don't have Sidra Knowledge Center content, 
  // so we return empty.
  if (ecosystem === "SIDRA") return [];

  const courses = await ctx.db
    .query("courses")
    .withIndex("by_status", (q: any) => q.eq("status", "PUBLISHED"))
    .collect();
  
  courses.sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_status", (q: any) => q.eq("status", "PUBLISHED"))
    .collect();

  const questions = await ctx.db
    .query("quizQuestions")
    .withIndex("by_status", (q: any) => q.eq("status", "PUBLISHED"))
    .collect();

  // Map courses to their lessons
  const linearLessons = [];
  let level = 1;

  for (const course of courses) {
    const courseLessons = lessons
      .filter((l: any) => l.courseId === course._id)
      .sort((a: any, b: any) => a.lessonNumber - b.lessonNumber);

    for (const lesson of courseLessons) {
      const lessonQuestions = questions
        .filter((q: any) => q.lessonId === lesson._id)
        .sort((a: any, b: any) => a._creationTime - b._creationTime);

      linearLessons.push({
        _id: lesson._id,
        level: level++,
        title: `${course.shortTitle}: ${lesson.title}`,
        body: `${lesson.what}\n\n${lesson.why}\n\n${lesson.how}`,
        quiz: lessonQuestions.map((q: any) => ({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      });
    }
  }

  return linearLessons;
}

export const getAcademy = query({
  args: { userId: v.id("users"), ecosystem: ecosystemArg },
  handler: async (ctx, { userId, ecosystem }) => {
    await requireUser(ctx, userId);
    const { max, passed } = await maxPassed(ctx, userId, ecosystem);
    
    const lessons = await getDynamicLessons(ctx, ecosystem);

    // Level N unlocks once N-1 is passed; level 1 is always open.
    return lessons.map((l) => ({
      level: l.level,
      title: l.title,
      body: l.body,
      locked: l.level > max + 1,
      passed: passed.has(l.level),
      // Answers/explanations are withheld until the user submits.
      quiz: l.quiz.map((q: any) => ({ question: q.question, options: q.options })),
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
    const { economy } = await requireUserAndEconomy(ctx, userId);
    
    const lessons = await getDynamicLessons(ctx, ecosystem);
    const lesson = lessons.find(l => l.level === level);
    
    if (!lesson) throw new Error("Unknown lesson");

    const { max, passed } = await maxPassed(ctx, userId, ecosystem);
    if (level > max + 1) throw new Error("Level is locked — pass the previous level first");

    const { score, total, passed: didPass } = scoreGate(lesson.quiz, answers);

    let pointsEarned = 0;
    if (didPass && !passed.has(level)) {
      await ctx.db.insert("academyProgress", {
        userId,
        ecosystem,
        level,
        passedAt: Date.now(),
      });
      pointsEarned = await getNum(ctx, "academyLevelPoints");
      await appendLedger(
        ctx,
        userId,
        economy,
        pointsEarned,
        "ACADEMY_LEVEL",
        `${ecosystem}:${level}`,
      );

      const academyXp = (await getNum(ctx, "academyXp")) || 200;
      await awardXP(ctx, {
        userId,
        amount: academyXp,
        source: "LESSON",
        sourceId: `${ecosystem}:${level}`,
      });
    }

    return {
      score,
      total,
      passed: didPass,
      pointsEarned,
      // Reveal answers now so the screen can show what was right/wrong.
      review: lesson.quiz.map((q: any, i: number) => ({
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        selected: answers[i],
      })),
    };
  },
});
