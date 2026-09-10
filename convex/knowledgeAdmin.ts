import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./admin";

// ─── Knowledge Center Admin (learn-pi.md §20/§21/§25) ──────────────────────
// Admin-only content management for the Pi Pioneer Knowledge Center: full CRUD
// over sources, courses, lessons and the centralized question bank, plus the
// Daily Quiz settings. Every function is gated by requireAdmin(token) so the
// shared admin secret (ADMIN_PASSWORD) protects it from direct calls.
//
// Content versioning (§21): every edit bumps contentVersion, refreshes
// updatedAt/lastReviewedAt. When an official source changes (URL/version
// edited), all questions linked to that source are marked NEEDS_REVIEW instead
// of silently presenting potentially outdated information.

const COURSE_STATUS = v.union(
  v.literal("DRAFT"),
  v.literal("REVIEW"),
  v.literal("PUBLISHED"),
  v.literal("ARCHIVED"),
);
const LESSON_STATUS = COURSE_STATUS;
const QUESTION_STATUS = v.union(
  v.literal("DRAFT"),
  v.literal("REVIEW"),
  v.literal("PUBLISHED"),
  v.literal("NEEDS_REVIEW"),
  v.literal("OUTDATED"),
  v.literal("ARCHIVED"),
);
const SOURCE_STATUS = v.union(
  v.literal("ACTIVE"),
  v.literal("NEEDS_REVIEW"),
  v.literal("OUTDATED"),
);

// ---------- Sources ----------

export const listSources = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("sources").order("asc").collect();
  },
});

export const createSource = mutation({
  args: {
    token: v.string(),
    sourceId: v.string(),
    title: v.string(),
    officialUrl: v.string(),
    publisher: v.string(),
    publicationDate: v.optional(v.number()),
    version: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    relevantSection: v.optional(v.string()),
  },
  handler: async (ctx, { token, sourceId, ...fields }) => {
    requireAdmin(token);
    const now = Date.now();
    return await ctx.db.insert("sources", {
      sourceId,
      ...fields,
      lastChecked: now,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSource = mutation({
  args: {
    token: v.string(),
    sourceId: v.string(),
    title: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    publisher: v.optional(v.string()),
    publicationDate: v.optional(v.number()),
    version: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    relevantSection: v.optional(v.string()),
  },
  handler: async (ctx, { token, sourceId, ...fields }) => {
    requireAdmin(token);
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique();
    if (!existing) throw new Error("Source not found");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }

    // A changed official URL or version means the source's content may have
    // changed → mark the source AND every question citing it NEEDS_REVIEW (§21).
    const contentChanged =
      fields.officialUrl !== undefined && fields.officialUrl !== existing.officialUrl;
    const versionChanged =
      fields.version !== undefined && fields.version !== existing.version;
    const titleChanged =
      fields.title !== undefined && fields.title !== existing.title;
    const now = Date.now();

    if (contentChanged || versionChanged || titleChanged) {
      patch.status = "NEEDS_REVIEW";
      patch.lastChecked = now;
      const affected = await ctx.db
        .query("quizQuestions")
        .filter((q) => q.eq(q.field("sourceId"), sourceId))
        .collect();
      for (const q of affected) {
        if (q.status === "ARCHIVED") continue;
        await ctx.db.patch(q._id, {
          status: "NEEDS_REVIEW",
          sourceUrl: fields.officialUrl ?? q.sourceUrl,
          contentVersion: (q.contentVersion ?? 1) + 1,
        });
      }
    }
    patch.updatedAt = now;
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

/** Mark a source reviewed → ACTIVE with lastChecked refreshed (§25 checklist). */
export const reviewSource = mutation({
  args: { token: v.string(), sourceId: v.string() },
  handler: async (ctx, { token, sourceId }) => {
    requireAdmin(token);
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique();
    if (!existing) throw new Error("Source not found");
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "ACTIVE",
      lastChecked: now,
      updatedAt: now,
    });
  },
});

export const deleteSource = mutation({
  args: { token: v.string(), sourceId: v.string() },
  handler: async (ctx, { token, sourceId }) => {
    requireAdmin(token);
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique();
    if (!existing) throw new Error("Source not found");
    await ctx.db.delete(existing._id);
  },
});

// ---------- Courses ----------

export const listCourses = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const [courses, lessons, questions] = await Promise.all([
      ctx.db.query("courses").order("asc").collect(),
      ctx.db.query("lessons").collect(),
      ctx.db.query("quizQuestions").collect(),
    ]);
    const lessonsByCourse = new Map<string, number>();
    for (const l of lessons) {
      lessonsByCourse.set(l.courseId, (lessonsByCourse.get(l.courseId) ?? 0) + 1);
    }
    const questionsByCourse = new Map<string, number>();
    for (const q of questions) {
      if (!q.courseId) continue;
      questionsByCourse.set(q.courseId, (questionsByCourse.get(q.courseId) ?? 0) + 1);
    }
    return courses
      .map((c) => ({
        ...c,
        lessonCount: lessonsByCourse.get(c._id) ?? 0,
        questionCount: questionsByCourse.get(c._id) ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const createCourse = mutation({
  args: {
    token: v.string(),
    key: v.string(),
    title: v.string(),
    shortTitle: v.string(),
    description: v.string(),
    sortOrder: v.number(),
  },
  handler: async (ctx, { token, ...fields }) => {
    requireAdmin(token);
    const now = Date.now();
    return await ctx.db.insert("courses", {
      ...fields,
      status: "DRAFT",
      contentVersion: 1,
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: now,
    });
  },
});

export const updateCourse = mutation({
  args: {
    token: v.string(),
    courseId: v.id("courses"),
    key: v.optional(v.string()),
    title: v.optional(v.string()),
    shortTitle: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { token, courseId, ...fields }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(courseId);
    if (!existing) throw new Error("Course not found");
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    const now = Date.now();
    await ctx.db.patch(courseId, {
      ...patch,
      contentVersion: (existing.contentVersion ?? 1) + 1,
      updatedAt: now,
    });
    return courseId;
  },
});

export const setCourseStatus = mutation({
  args: { token: v.string(), courseId: v.id("courses"), status: COURSE_STATUS },
  handler: async (ctx, { token, courseId, status }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(courseId);
    if (!existing) throw new Error("Course not found");
    await ctx.db.patch(courseId, {
      status,
      updatedAt: Date.now(),
      // A publish/review decision counts as a review checkpoint.
      ...(status === "PUBLISHED" ? { lastReviewedAt: Date.now() } : {}),
    });
  },
});

export const deleteCourse = mutation({
  args: { token: v.string(), courseId: v.id("courses") },
  handler: async (ctx, { token, courseId }) => {
    requireAdmin(token);
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const lesson of lessons) {
      const qs = await ctx.db
        .query("quizQuestions")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .filter((q) => q.eq(q.field("lessonId"), lesson._id))
        .collect();
      for (const q of qs) await ctx.db.delete(q._id);
      await ctx.db.delete(lesson._id);
    }
    await ctx.db.delete(courseId);
  },
});

// ---------- Lessons ----------

export const listLessons = query({
  args: { token: v.string(), courseId: v.optional(v.id("courses")) },
  handler: async (ctx, { token, courseId }) => {
    requireAdmin(token);
    const lessons = courseId
      ? await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", courseId))
          .collect()
      : await ctx.db.query("lessons").order("asc").collect();
    return lessons.sort((a, b) => a.lessonNumber - b.lessonNumber);
  },
});

export const createLesson = mutation({
  args: {
    token: v.string(),
    courseId: v.id("courses"),
    lessonNumber: v.number(),
    title: v.string(),
    what: v.string(),
    why: v.string(),
    how: v.string(),
    example: v.optional(v.string()),
    important: v.optional(v.string()),
    commonMistake: v.optional(v.string()),
    officialSource: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...fields }) => {
    requireAdmin(token);
    const now = Date.now();
    return await ctx.db.insert("lessons", {
      ...fields,
      status: "DRAFT",
      contentVersion: 1,
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: now,
    });
  },
});

export const updateLesson = mutation({
  args: {
    token: v.string(),
    lessonId: v.id("lessons"),
    lessonNumber: v.optional(v.number()),
    title: v.optional(v.string()),
    what: v.optional(v.string()),
    why: v.optional(v.string()),
    how: v.optional(v.string()),
    example: v.optional(v.string()),
    important: v.optional(v.string()),
    commonMistake: v.optional(v.string()),
    officialSource: v.optional(v.string()),
  },
  handler: async (ctx, { token, lessonId, ...fields }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(lessonId);
    if (!existing) throw new Error("Lesson not found");
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(lessonId, {
      ...patch,
      contentVersion: (existing.contentVersion ?? 1) + 1,
      updatedAt: Date.now(),
    });
    return lessonId;
  },
});

export const setLessonStatus = mutation({
  args: { token: v.string(), lessonId: v.id("lessons"), status: LESSON_STATUS },
  handler: async (ctx, { token, lessonId, status }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(lessonId);
    if (!existing) throw new Error("Lesson not found");
    await ctx.db.patch(lessonId, {
      status,
      updatedAt: Date.now(),
      ...(status === "PUBLISHED" ? { lastReviewedAt: Date.now() } : {}),
    });
  },
});

export const deleteLesson = mutation({
  args: { token: v.string(), lessonId: v.id("lessons") },
  handler: async (ctx, { token, lessonId }) => {
    requireAdmin(token);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new Error("Lesson not found");
    const qs = await ctx.db
      .query("quizQuestions")
      .filter((q) => q.eq(q.field("lessonId"), lessonId))
      .collect();
    for (const q of qs) await ctx.db.delete(q._id);
    await ctx.db.delete(lessonId);
  },
});

// ---------- Questions ----------

export const listQuestions = query({
  args: {
    token: v.string(),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    status: v.optional(QUESTION_STATUS),
  },
  handler: async (ctx, { token, courseId, lessonId, status }) => {
    requireAdmin(token);
    const [questions, courses] = await Promise.all([
      ctx.db.query("quizQuestions").order("asc").collect(),
      ctx.db.query("courses").collect(),
    ]);
    const courseById = new Map(courses.map((c) => [c._id, c]));

    let rows = questions;
    if (courseId) rows = rows.filter((q) => q.courseId === courseId);
    if (lessonId) rows = rows.filter((q) => q.lessonId === lessonId);
    if (status) rows = rows.filter((q) => q.status === status);

    return rows.map((q) => ({
      ...q,
      courseKey: q.courseId ? courseById.get(q.courseId)?.key ?? null : null,
      courseTitle: q.courseId ? courseById.get(q.courseId)?.shortTitle ?? null : null,
    }));
  },
});

export const createQuestion = mutation({
  args: {
    token: v.string(),
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    explanation: v.string(),
    difficulty: v.number(),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    topic: v.optional(v.string()),
    difficultyLabel: v.optional(
      v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    ),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...fields }) => {
    requireAdmin(token);
    const now = Date.now();
    return await ctx.db.insert("quizQuestions", {
      ...fields,
      status: "DRAFT",
      lastReviewedAt: now,
      contentVersion: 1,
    });
  },
});

export const updateQuestion = mutation({
  args: {
    token: v.string(),
    questionId: v.id("quizQuestions"),
    question: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctIndex: v.optional(v.number()),
    explanation: v.optional(v.string()),
    difficulty: v.optional(v.number()),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    topic: v.optional(v.string()),
    difficultyLabel: v.optional(
      v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    ),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { token, questionId, ...fields }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(questionId);
    if (!existing) throw new Error("Question not found");
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(questionId, {
      ...patch,
      contentVersion: (existing.contentVersion ?? 1) + 1,
    });
    return questionId;
  },
});

/** Publish, disable (ARCHIVED), mark OUTDATED or NEEDS_REVIEW, or send to REVIEW. */
export const setQuestionStatus = mutation({
  args: { token: v.string(), questionId: v.id("quizQuestions"), status: QUESTION_STATUS },
  handler: async (ctx, { token, questionId, status }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(questionId);
    if (!existing) throw new Error("Question not found");
    await ctx.db.patch(questionId, {
      status,
      ...(status === "PUBLISHED" || status === "REVIEW"
        ? { lastReviewedAt: Date.now() }
        : {}),
    });
  },
});

export const deleteQuestion = mutation({
  args: { token: v.string(), questionId: v.id("quizQuestions") },
  handler: async (ctx, { token, questionId }) => {
    requireAdmin(token);
    await ctx.db.delete(questionId);
  },
});

// ---------- Daily Quiz settings ----------

export const getQuizSettings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const settings = await ctx.db.query("quizSettings").first();
    const courses = await ctx.db.query("courses").collect();
    return {
      settings: settings ?? null,
      courses: courses
        .filter((c) => c.status === "PUBLISHED")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({ key: c.key, title: c.shortTitle })),
    };
  },
});

export const updateQuizSettings = mutation({
  args: {
    token: v.string(),
    mode: v.union(v.literal("MIXED"), v.literal("COURSE_OF_THE_DAY")),
    questionsPerQuiz: v.number(),
    distribution: v.array(
      v.object({ courseKey: v.string(), count: v.number() }),
    ),
    schedule: v.array(
      v.object({ day: v.number(), courseKey: v.string() }),
    ),
  },
  handler: async (ctx, { token, ...fields }) => {
    requireAdmin(token);
    if (fields.questionsPerQuiz < 1 || fields.questionsPerQuiz > 20) {
      throw new Error("questionsPerQuiz must be between 1 and 20");
    }
    const existing = await ctx.db.query("quizSettings").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
    } else {
      await ctx.db.insert("quizSettings", { ...fields, updatedAt: now });
    }
  },
});
