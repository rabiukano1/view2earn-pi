import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";

// ─── Pi Pioneer Knowledge Center (learn-pi.md) ─────────────────────────────
// Read + progress API for the 15 official-source-backed courses. Questions
// come from the ONE centralized quizQuestions bank (answers/explanations are
// withheld until the user submits — the backend grades them, never the client).

const PUBLISHED = "PUBLISHED";

/** Course hub: all published courses with the user's per-course progress. */
export const getKnowledgeCenter = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const [courses, progressRows, lessons] = await Promise.all([
      ctx.db.query("courses").collect(),
      ctx.db
        .query("learningProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("lessons").collect(),
    ]);

    const published = courses
      .filter((c) => c.status === PUBLISHED)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const lessonsByCourse = new Map<string, number>();
    for (const l of lessons) {
      if (l.status !== PUBLISHED) continue;
      lessonsByCourse.set(l.courseId, (lessonsByCourse.get(l.courseId) ?? 0) + 1);
    }
    const progressByCourse = new Map(
      progressRows.map((p) => [p.courseId, p]),
    );

    let totalLessons = 0;
    let totalCompleted = 0;
    const list = published.map((c) => {
      const count = lessonsByCourse.get(c._id) ?? 0;
      const completed = progressByCourse.get(c._id)?.lessonsCompleted.length ?? 0;
      totalLessons += count;
      totalCompleted += completed;
      return {
        _id: c._id,
        key: c.key,
        title: c.title,
        shortTitle: c.shortTitle,
        description: c.description,
        sortOrder: c.sortOrder,
        lessonCount: count,
        lessonsCompleted: completed,
        progressPct: count > 0 ? completed / count : 0,
        quizBest: progressByCourse.get(c._id)?.quizBest ?? null,
      };
    });

    return {
      courses: list,
      overall: {
        lessonsCompleted: totalCompleted,
        totalLessons,
        progressPct: totalLessons > 0 ? totalCompleted / totalLessons : 0,
      },
    };
  },
});

/** One course with its published lessons and per-lesson completion flags. */
export const getCourse = query({
  args: { userId: v.id("users"), courseKey: v.string() },
  handler: async (ctx, { userId, courseKey }) => {
    await requireUser(ctx, userId);
    const course = await ctx.db
      .query("courses")
      .withIndex("by_key", (q) => q.eq("key", courseKey))
      .unique();
    if (!course || course.status !== PUBLISHED) throw new Error("Course not found");

    const [lessons, progress] = await Promise.all([
      ctx.db
        .query("lessons")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .collect(),
      ctx.db
        .query("learningProgress")
        .withIndex("by_user_course", (q) =>
          q.eq("userId", userId).eq("courseId", course._id),
        )
        .unique(),
    ]);

    const ordered = lessons
      .filter((l) => l.status === PUBLISHED)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);

    return {
      course: {
        _id: course._id,
        key: course.key,
        title: course.title,
        shortTitle: course.shortTitle,
        description: course.description,
      },
      lessons: ordered.map((l) => ({
        _id: l._id,
        lessonNumber: l.lessonNumber,
        title: l.title,
        completed: progress?.lessonsCompleted.includes(l._id) ?? false,
      })),
      progress: {
        lessonsCompleted: progress?.lessonsCompleted.length ?? 0,
        totalLessons: ordered.length,
        quizBest: progress?.quizBest ?? null,
      },
    };
  },
});

/** One lesson's full content + its knowledge-check questions (answers hidden). */
export const getLesson = query({
  args: {
    userId: v.id("users"),
    courseKey: v.string(),
    lessonNumber: v.number(),
  },
  handler: async (ctx, { userId, courseKey, lessonNumber }) => {
    await requireUser(ctx, userId);
    const course = await ctx.db
      .query("courses")
      .withIndex("by_key", (q) => q.eq("key", courseKey))
      .unique();
    if (!course || course.status !== PUBLISHED) throw new Error("Course not found");

    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .filter((q) => q.eq(q.field("lessonNumber"), lessonNumber))
      .first();
    if (!lesson || lesson.status !== PUBLISHED) throw new Error("Lesson not found");

    const [questions, progress] = await Promise.all([
      ctx.db
        .query("quizQuestions")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .filter((q) => q.eq(q.field("lessonId"), lesson._id))
        .collect(),
      ctx.db
        .query("learningProgress")
        .withIndex("by_user_course", (q) =>
          q.eq("userId", userId).eq("courseId", course._id),
        )
        .unique(),
    ]);

    const ordered = questions
      .filter((q) => q.status === PUBLISHED)
      .sort((a, b) => a._creationTime - b._creationTime);

    return {
      course: { key: course.key, title: course.title, shortTitle: course.shortTitle },
      lesson: {
        _id: lesson._id,
        lessonNumber: lesson.lessonNumber,
        title: lesson.title,
        what: lesson.what,
        why: lesson.why,
        how: lesson.how,
        example: lesson.example ?? null,
        important: lesson.important ?? null,
        commonMistake: lesson.commonMistake ?? null,
        officialSource: lesson.officialSource ?? null,
      },
      completed: progress?.lessonsCompleted.includes(lesson._id) ?? false,
      // Answers withheld — submitLessonQuiz grades server-side.
      quiz: ordered.map((q) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        topic: q.topic ?? null,
        difficultyLabel: q.difficultyLabel ?? null,
      })),
    };
  },
});

/** Grade a lesson's knowledge check and track learning progress (no points —
 * the Daily Quiz is the only rewarded quiz; §22 keeps education separate). */
export const submitLessonQuiz = mutation({
  args: {
    userId: v.id("users"),
    courseKey: v.string(),
    lessonNumber: v.number(),
    answers: v.array(v.number()),
  },
  handler: async (ctx, { userId, courseKey, lessonNumber, answers }) => {
    await requireUserAndEconomy(ctx, userId);

    const course = await ctx.db
      .query("courses")
      .withIndex("by_key", (q) => q.eq("key", courseKey))
      .unique();
    if (!course) throw new Error("Course not found");

    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .filter((q) => q.eq(q.field("lessonNumber"), lessonNumber))
      .first();
    if (!lesson) throw new Error("Lesson not found");

    const questions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .filter((q) => q.eq(q.field("lessonId"), lesson._id))
      .collect();
    const published = questions.filter((q) => q.status === PUBLISHED);
    if (published.length === 0) throw new Error("This lesson has no questions yet");
    if (answers.length !== published.length) {
      throw new Error("Answer every question first");
    }

    let score = 0;
    const review = published.map((q, i) => {
      const selected = answers[i];
      const correct = selected === q.correctIndex;
      if (correct) score++;
      return {
        correctIndex: q.correctIndex,
        selected,
        explanation: q.explanation,
      };
    });

    const now = Date.now();
    const existing = await ctx.db
      .query("learningProgress")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", course._id),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("learningProgress", {
        userId,
        courseId: course._id,
        lessonsCompleted: [lesson._id],
        quizBest: score,
        questionsAnswered: published.length,
        updatedAt: now,
      });
    } else {
      const done = existing.lessonsCompleted.includes(lesson._id);
      await ctx.db.patch(existing._id, {
        lessonsCompleted: done
          ? existing.lessonsCompleted
          : [...existing.lessonsCompleted, lesson._id],
        quizBest: Math.max(existing.quizBest ?? 0, score),
        questionsAnswered: (existing.questionsAnswered ?? 0) + published.length,
        updatedAt: now,
      });
    }

    return {
      score,
      total: published.length,
      passed: score === published.length,
      review,
      completed: true,
    };
  },
});