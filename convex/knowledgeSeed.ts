import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { SOURCES, COURSES, LAST_CHECKED_AT } from "./knowledgeContent";

// Phase 2 seed for the Pi Pioneer Knowledge Center (learn-pi.md).
//
// Idempotent: re-running only upserts; it never deletes content. Content lives
// in convex/knowledgeContent.ts so it can be reviewed/extended without touching
// schema. Question rows reuse the centralized quizQuestions bank and add
// Knowledge Center metadata (courseId/lessonId/topic/difficultyLabel/source/
// status/versioning) so the legacy daily quiz and the Knowledge Center share
// one question pool.

const STATUS = "PUBLISHED" as const;
const VERSION = 1;

const DIFFICULTY_NUM = { EASY: 1, MEDIUM: 2, HARD: 3 } as const;

export const seedKnowledgeCenter = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const now = Date.now();
    const counts = { sources: 0, courses: 0, lessons: 0, questions: 0 };

    // ─── Sources ────────────────────────────────────────────────────────────
    for (const s of SOURCES) {
      const existing = await ctx.db
        .query("sources")
        .withIndex("by_sourceId", (q) => q.eq("sourceId", s.sourceId))
        .unique();
      const fields = {
        title: s.title,
        officialUrl: s.officialUrl,
        publisher: s.publisher,
        lastChecked: LAST_CHECKED_AT,
        version: s.version,
        relevantSection: s.relevantSection,
        status: "ACTIVE" as const,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, fields);
      } else {
        await ctx.db.insert("sources", {
          sourceId: s.sourceId,
          ...fields,
          publicationDate:
            s.sourceId === "whitepaper" ? Date.UTC(2019, 2, 14) : undefined,
          createdAt: now,
        });
        counts.sources++;
      }
    }

    // ─── Courses, Lessons, Questions ───────────────────────────────────────
    for (const course of COURSES) {
      const existingCourse = await ctx.db
        .query("courses")
        .withIndex("by_key", (q) => q.eq("key", course.key))
        .unique();
      const courseFields = {
        title: course.title,
        shortTitle: course.shortTitle,
        description: course.description,
        sortOrder: course.sortOrder,
        status: STATUS,
        contentVersion: VERSION,
        updatedAt: now,
        lastReviewedAt: LAST_CHECKED_AT,
      };
      const courseDocId = existingCourse
        ? existingCourse._id
        : await ctx.db.insert("courses", {
            key: course.key,
            ...courseFields,
            createdAt: now,
          });
      if (existingCourse) {
        await ctx.db.patch(existingCourse._id, courseFields);
      } else {
        counts.courses++;
      }

      for (const lesson of course.lessons) {
        const existingLesson = await ctx.db
          .query("lessons")
          .withIndex("by_course", (q) => q.eq("courseId", courseDocId))
          .filter((q) => q.eq(q.field("lessonNumber"), lesson.number))
          .first();
        let lessonId = existingLesson?._id;
        const lessonFields = {
          lessonNumber: lesson.number,
          title: lesson.title,
          what: lesson.what,
          why: lesson.why,
          how: lesson.how,
          example: lesson.example,
          important: lesson.important,
          commonMistake: lesson.commonMistake,
          officialSource: lesson.officialSource,
          status: STATUS,
          contentVersion: VERSION,
          updatedAt: now,
          lastReviewedAt: LAST_CHECKED_AT,
        };
        if (lessonId) {
          await ctx.db.patch(lessonId, lessonFields);
        } else {
          lessonId = await ctx.db.insert("lessons", {
            courseId: courseDocId,
            ...lessonFields,
            createdAt: now,
          });
          counts.lessons++;
        }

        const sourceUrl = SOURCES.find((s) => s.sourceId === course.sourceId)
          ?.officialUrl;

        for (const q of lesson.questions) {
          const existingQ = await ctx.db
            .query("quizQuestions")
            .withIndex("by_ecosystem", (query) => query.eq("ecosystem", "PI"))
            .filter((query) => query.eq(query.field("question"), q.question))
            .first();
          const qFields = {
            ecosystem: "PI" as const,
            category: course.key,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            difficulty: DIFFICULTY_NUM[q.difficulty],
            courseId: courseDocId,
            lessonId,
            topic: q.topic,
            difficultyLabel: q.difficulty,
            sourceId: q.sourceId,
            sourceUrl,
            sourceDate: LAST_CHECKED_AT,
            status: STATUS,
            lastReviewedAt: LAST_CHECKED_AT,
            contentVersion: VERSION,
          };
          if (existingQ) {
            // Re-link existing question into the Knowledge Center graph.
            if (force || !existingQ.courseId) {
              await ctx.db.patch(existingQ._id, {
                courseId: courseDocId,
                lessonId,
                topic: q.topic,
                difficultyLabel: q.difficulty,
                sourceId: q.sourceId,
                sourceUrl,
                sourceDate: LAST_CHECKED_AT,
                status: STATUS,
                lastReviewedAt: LAST_CHECKED_AT,
                contentVersion: VERSION,
              });
            }
          } else {
            await ctx.db.insert("quizQuestions", qFields);
            counts.questions++;
          }
        }
      }
    }

    // ─── Default Daily Quiz settings (learn-pi.md §8/§9) ─────────────────────
    // Seeded once so admins can then edit them from the dashboard without a
    // developer. Existing rows (possibly admin-customized) are left untouched.
    const existingSettings = await ctx.db.query("quizSettings").first();
    if (!existingSettings) {
      await ctx.db.insert("quizSettings", {
        mode: "MIXED",
        questionsPerQuiz: 5,
        distribution: [
          { courseKey: "pi-introduction", count: 1 },
          { courseKey: "pi-mining", count: 1 },
          { courseKey: "pi-tokenomics", count: 1 },
          { courseKey: "pi-kyc", count: 1 },
          { courseKey: "pi-mainnet", count: 1 },
        ],
        schedule: [
          { day: 0, courseKey: "MIXED" },
          { day: 1, courseKey: "pi-introduction" },
          { day: 2, courseKey: "pi-mining" },
          { day: 3, courseKey: "pi-kyc" },
          { day: 4, courseKey: "pi-mainnet" },
          { day: 5, courseKey: "pi-wallet" },
          { day: 6, courseKey: "pi-migration" },
        ],
        updatedAt: now,
      });
    }

    return `Knowledge Center seeded/verified — ${counts.sources} new sources, ${counts.courses} new courses, ${counts.lessons} new lessons, ${counts.questions} new questions`;
  },
});
