import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";

export const generateQuestions = internalAction({
  args: { ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")), count: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.quiz.getCachedCount, {
      ecosystem: args.ecosystem,
    });
    if (existing >= 20) return;

    const topic = args.ecosystem === "PI" ? "Pi Network blockchain" : "Sidra Chain blockchain";
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "system",
            content: `Generate ${args.count} multiple-choice quiz questions about ${topic}. Return JSON array: [{ "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." }]`,
          }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) return;
      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return;

      const questions = JSON.parse(
        content.replace(/```json/g, "").replace(/```/g, "").trim(),
      ) as Array<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
      }>;

      for (const q of questions) {
        await ctx.runMutation(internal.quiz.insertQuestion, {
          ecosystem: args.ecosystem,
          category: "general",
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: 1,
        });
      }
    } catch {
      // silently fail — quiz generator is best-effort
    }
  },
});

export const getCachedCount = internalQuery({
  args: { ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")) },
  handler: async (ctx, { ecosystem }) => {
    const questions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_ecosystem", (q) => q.eq("ecosystem", ecosystem))
      .collect();
    return questions.length;
  },
});

export const insertQuestion = internalMutation({
  args: {
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    explanation: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("quizQuestions", args);
  },
});

export const getDailyQuiz = query({
  args: { userId: v.id("users"), ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")) },
  handler: async (ctx, { userId, ecosystem }) => {
    await requireUser(ctx, userId);
    const allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_ecosystem", (q) => q.eq("ecosystem", ecosystem))
      .collect();
    const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
    }));
  },
});

export const submitQuiz = mutation({
  args: {
    userId: v.id("users"),
    answers: v.array(v.object({
      questionId: v.id("quizQuestions"),
      selectedIndex: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.userId);
    await enforceRateLimit(ctx, args.userId, "quiz");
    let score = 0;
    const questionIds: string[] = [];

    for (const answer of args.answers) {
      const question = await ctx.db.get(answer.questionId);
      if (!question) continue;
      questionIds.push(answer.questionId);
      if (answer.selectedIndex === question.correctIndex) {
        score++;
      }
    }

    const total = args.answers.length;
    const pointsEarned = score * 3;

    await ctx.db.insert("quizResults", {
      userId: args.userId,
      score,
      total,
      questionIds: questionIds as any,
    });

    if (pointsEarned > 0) {
      const last = await ctx.db
        .query("pointsLedger")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .first();
      const balanceAfter = (last?.balanceAfter ?? 0) + pointsEarned;
      await ctx.db.insert("pointsLedger", {
        userId: args.userId,
        delta: pointsEarned,
        reason: "QUIZ_CORRECT",
        balanceAfter,
      });
    }

    return { score, total, pointsEarned };
  },
});
