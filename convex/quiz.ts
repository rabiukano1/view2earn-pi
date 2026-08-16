import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";
import { getNum } from "./rewardsConfig";
import { appendLedger } from "./lib/ledger";
import { awardXP } from "./xp";

// ─── Built-In High Quality Question Banks (Fallback & Seed) ─────────────────────

const BUILT_IN_QUESTIONS = {
  PI: [
    {
      question: "What is the consensus algorithm used by the Pi Network blockchain?",
      options: ["Proof of Work (PoW)", "Stellar Consensus Protocol (SCP)", "Proof of Stake (PoS)", "Proof of Authority (PoA)"],
      correctIndex: 1,
      explanation: "Pi Network builds on the Stellar Consensus Protocol (SCP) to enable eco-friendly mobile mining.",
    },
    {
      question: "What is the primary role of Security Circles in Pi Network?",
      options: ["Increase transaction fees", "Build global trust graphs to secure consensus", "Mine Bitcoin simultaneously", "Store private keys on cloud"],
      correctIndex: 1,
      explanation: "Security circles consist of 3-5 trusted members that form a global trust graph for consensus.",
    },
    {
      question: "What utility does Pi Browser provide in the Pi ecosystem?",
      options: ["Only plays videos", "Web3 browser for Pi apps, Pi Wallet, and Pi KYC", "A photo editor", "Mining bitcoin"],
      correctIndex: 1,
      explanation: "Pi Browser is the Web3 gateway containing Pi Apps, Pi Wallet, and the native Pi KYC solution.",
    },
    {
      question: "What is the total maximum supply cap of Pi tokens?",
      options: ["21 Million", "100 Billion", "500 Billion", "Unlimited"],
      correctIndex: 1,
      explanation: "The total supply of Pi is capped at 100 billion tokens for community, core team, and ecosystem reserves.",
    },
    {
      question: "How often do Pi Network users need to ping the app to confirm active presence?",
      options: ["Every 1 hour", "Every 24 hours", "Once a week", "Every 12 hours"],
      correctIndex: 1,
      explanation: "Mining sessions last 24 hours, requiring users to press the lightning button daily.",
    },
  ],
  SIDRA: [
    {
      question: "What makes Sidra Chain distinct as a digital currency platform?",
      options: ["It is a meme token", "First Shariah-compliant decentralized financial platform", "Uses Proof of Work", "Has 50% inflation"],
      correctIndex: 1,
      explanation: "Sidra Chain is designed specifically to provide Islamic Shariah-compliant DeFi services.",
    },
    {
      question: "What is the primary verification method used by Sidra Chain users?",
      options: ["Face ID only", "P2P Face-to-Face & Document Verification", "Phone number only", "No verification required"],
      correctIndex: 1,
      explanation: "Sidra KYC uses document verification paired with Peer-to-Peer (P2P) confirmation.",
    },
    {
      question: "Which backing mechanism does Sidra Chain aim to leverage for stability?",
      options: ["Unbacked algorithmic minting", "Asset-backed and gold-backed Shariah principles", "US Dollar peg only", "No asset backing"],
      correctIndex: 1,
      explanation: "Sidra Chain focuses on asset-backed stability aligned with Islamic ethical finance.",
    },
    {
      question: "What is the purpose of Sidra Chain P2P verification?",
      options: ["Pay gas fees", "Confirm real human identity between validated community members", "Mine tokens faster", "Trade NFTs"],
      correctIndex: 1,
      explanation: "P2P verification ensures one real human per account by having verified peers confirm identity.",
    },
    {
      question: "What ethical financial principle guides Sidra Chain transactions?",
      options: ["Riba (usury/interest) prohibition", "High interest lending", "Unregulated gambling", "Hidden transaction fees"],
      correctIndex: 0,
      explanation: "Sidra Chain operates under Shariah rules prohibiting Riba (interest) and speculative gambling.",
    },
  ],
};

// ─── AI Question Generator Action (Gemini 2.0 / OpenAI / Fallback) ─────────────

export const generateQuestions = internalAction({
  args: { ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")), count: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.quiz.getCachedCount, {
      ecosystem: args.ecosystem,
    });
    if (existing >= 20) return;

    const topic = args.ecosystem === "PI" ? "Pi Network cryptocurrency, SCP consensus, Pi Wallet, Pi Browser, and Pi Ecosystem" : "Sidra Chain Islamic DeFi, Shariah-compliant Web3, P2P KYC, and Sidra ecosystem";
    
    // Try Gemini 2.0 Flash first (FREE API KEY)
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }> = [];

    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate ${args.count} multiple-choice quiz questions about ${topic}. Return ONLY valid JSON array with format: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}]`
              }]
            }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            questions = JSON.parse(text.trim());
          }
        }
      } catch {}
    }

    // OpenAI Fallback if Gemini not available or failed
    if (questions.length === 0 && openaiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{
              role: "system",
              content: `Generate ${args.count} multiple-choice questions about ${topic}. Return JSON array: [{ "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." }]`,
            }],
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json() as { choices: Array<{ message: { content: string } }> };
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            questions = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());
          }
        }
      } catch {}
    }

    // Insert generated or fallback questions
    if (questions.length > 0) {
      for (const q of questions) {
        await ctx.runMutation(internal.quiz.insertQuestion, {
          ecosystem: args.ecosystem,
          category: "general",
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? "",
          difficulty: 1,
        });
      }
    } else {
      // Auto-seed built-in questions if AI calls failed or no keys configured
      await ctx.runMutation(internal.quiz.seedBuiltInQuestions, { ecosystem: args.ecosystem });
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

/** Internal: seed built-in question bank for an ecosystem */
export const seedBuiltInQuestions = internalMutation({
  args: { ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")) },
  handler: async (ctx, { ecosystem }) => {
    const list = BUILT_IN_QUESTIONS[ecosystem];
    for (const q of list) {
      const existing = await ctx.db
        .query("quizQuestions")
        .withIndex("by_ecosystem", (query) => query.eq("ecosystem", ecosystem))
        .filter((query) => query.eq(query.field("question"), q.question))
        .first();
      if (!existing) {
        await ctx.db.insert("quizQuestions", {
          ecosystem,
          category: "general",
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: 1,
        });
      }
    }
  },
});

// ─── Public Queries & Mutations ─────────────────────────────────────────────

/** Deterministic PRNG seeded from a string (so a user sees the same quiz all day). */
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable shuffle for a given seed (no Math.random — deterministic per user/day). */
function shuffle<T>(arr: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns the Daily Quiz for the day, auto-seeding if empty.
 *
 * Selection (learn-pi.md §8/§9): reads the quizSettings singleton — MIXED or
 * COURSE_OF_THE_DAY mode, a configurable per-course distribution, and a
 * weekday schedule. It pulls PUBLISHED questions from the centralized bank
 * (Knowledge Center questions first, since they carry course/lesson/source
 * metadata) and avoids repeating questions the user already answered.
 * Answers/explanations stay on the server until submitQuiz grades them. */
export const getDailyQuiz = query({
  args: {
    userId: v.id("users"),
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    day: v.number(), // 0 = Sunday .. 6 = Saturday (passed from client, no wall-clock read)
  },
  handler: async (ctx, { userId, ecosystem, day }) => {
    await requireUser(ctx, userId);

    const allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_ecosystem", (q) => q.eq("ecosystem", ecosystem))
      .collect();

    // Auto-seed if the database doesn't have enough questions yet.
    if (allQuestions.length === 0) {
      const list = BUILT_IN_QUESTIONS[ecosystem];
      return list.map((q, idx) => ({
        _id: `builtin-${ecosystem}-${idx}` as any,
        question: q.question,
        options: q.options,
      }));
    }

    // Published, course-linked questions are the primary bank.
    const bank = allQuestions.filter((q) => q.status === "PUBLISHED" && q.courseId);
    const fallback = allQuestions.filter((q) => q.status === "PUBLISHED" && !q.courseId);
    const pool = bank.length > 0 ? bank : fallback;

    const courses = await ctx.db.query("courses").collect();
    const keyByCourse = new Map<string, string | null>(
      courses.map((c) => [c._id, c.key]),
    );

    const settings = await ctx.db.query("quizSettings").first();
    const qCount = Math.max(1, Math.min(20, settings?.questionsPerQuiz ?? 5));
    const mode = settings?.mode ?? "MIXED";

    // Plan: array of {courseKey, count} or null → take from the whole pool.
    let plan: { courseKey: string; count: number }[] | null = null;
    if (mode === "COURSE_OF_THE_DAY") {
      const scheduled = settings?.schedule?.find((s) => s.day === day);
      const key = scheduled?.courseKey ?? "MIXED";
      if (key !== "MIXED") plan = [{ courseKey: key, count: qCount }];
    }
    if (!plan && (settings?.distribution?.length ?? 0) > 0) {
      plan = settings!.distribution;
    }

    // Recently-seen question ids, so the same question isn't re-served.
    const recentResults = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const seen = new Set<string>();
    for (const r of recentResults.slice(-20)) {
      for (const id of r.questionIds) seen.add(id);
    }

    const chosen: typeof pool = [];
    const seed = `${userId}:${ecosystem}:${day}`;
    const pick = (group: typeof pool, n: number) => {
      const fresh = group.filter((q) => !seen.has(q._id));
      if (fresh.length === 0) return [];
      const picked = shuffle(fresh, seed).slice(0, n);
      for (const q of picked) {
        chosen.push(q);
        seen.add(q._id);
      }
      return picked;
    };

    if (plan) {
      for (const p of plan) {
        if (chosen.length >= qCount) break;
        const group = pool.filter((q) => keyByCourse.get(q.courseId!) === p.courseKey);
        if (group.length > 0) pick(group, p.count);
      }
      if (chosen.length < qCount) {
        pick(pool.filter((q) => !seen.has(q._id)), qCount - chosen.length);
      }
    } else {
      pick(pool, qCount);
    }

    // Last resort: allow repeats only if the bank is genuinely too small.
    if (chosen.length < qCount && pool.length > 0) {
      let i = 0;
      while (chosen.length < qCount && i < pool.length * 3) {
        chosen.push(pool[i % pool.length]);
        i++;
      }
    }

    return chosen.slice(0, qCount).map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      topic: q.topic ?? null,
      difficultyLabel: q.difficultyLabel ?? null,
      courseKey: q.courseId ? (keyByCourse.get(q.courseId) ?? null) : null,
      sourceUrl: q.sourceUrl ?? null,
    }));
  },
});

/** Submit quiz answers, credit points, and sync with app wallet.
 *
 * Grading happens server-side (learn-pi.md §22: the frontend can never award
 * rewards). Returns a per-question review with explanations and learn-more
 * links into the Knowledge Center so a wrong answer points at the lesson. */
export const submitQuiz = mutation({
  args: {
    userId: v.id("users"),
    answers: v.array(v.object({
      questionId: v.string(),
      selectedIndex: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const { economy } = await requireUserAndEconomy(ctx, args.userId);
    await enforceRateLimit(ctx, args.userId, "quiz");
    let score = 0;
    const questionIds: string[] = [];
    const metas: Array<{
      correctIndex: number;
      explanation: string;
      courseId?: any;
      lessonId?: any;
    }> = [];

    for (const answer of args.answers) {
      let meta: { correctIndex: number; explanation: string; courseId?: any; lessonId?: any };

      if (answer.questionId.startsWith("builtin-")) {
        // Built-in question lookup
        const parts = answer.questionId.split("-");
        const eco = parts[1] as "PI" | "SIDRA";
        const idx = Number(parts[2]);
        const bq = BUILT_IN_QUESTIONS[eco]?.[idx];
        meta = {
          correctIndex: bq?.correctIndex ?? -1,
          explanation: bq?.explanation ?? "",
        };
      } else {
        const question = await ctx.db.get(answer.questionId as any);
        if (question && "correctIndex" in question) {
          const q = question as any;
          meta = {
            correctIndex: q.correctIndex,
            explanation: q.explanation ?? "",
            courseId: q.courseId,
            lessonId: q.lessonId,
          };
        } else {
          meta = { correctIndex: -1, explanation: "" };
        }
      }

      questionIds.push(answer.questionId);
      metas.push(meta);
      if (answer.selectedIndex === meta.correctIndex) {
        score++;
      }
    }

    // Resolve learn-more links (course/lesson titles) for the review.
    const courseCache = new Map<any, any>();
    const lessonCache = new Map<any, any>();
    const links: Array<{
      courseKey: string | null;
      courseTitle: string | null;
      lessonNumber: number | null;
      lessonTitle: string | null;
    }> = [];
    for (const m of metas) {
      let courseKey: string | null = null;
      let courseTitle: string | null = null;
      let lessonNumber: number | null = null;
      let lessonTitle: string | null = null;
      if (m.courseId) {
        let c = courseCache.get(m.courseId);
        if (!c) {
          c = await ctx.db.get(m.courseId);
          if (c) courseCache.set(m.courseId, c);
        }
        if (c) {
          courseKey = c.key;
          courseTitle = c.title;
        }
      }
      if (m.lessonId) {
        let l = lessonCache.get(m.lessonId);
        if (!l) {
          l = await ctx.db.get(m.lessonId);
          if (l) lessonCache.set(m.lessonId, l);
        }
        if (l) {
          lessonNumber = l.lessonNumber;
          lessonTitle = l.title;
        }
      }
      links.push({ courseKey, courseTitle, lessonNumber, lessonTitle });
    }

    const review = metas.map((m, i) => ({
      correctIndex: m.correctIndex,
      explanation: m.explanation,
      selected: args.answers[i].selectedIndex,
      ...links[i],
    }));

    const total = args.answers.length;
    const ptsPerCorrect = await getNum(ctx, "quizCorrectPoints");
    const pointsEarned = score * ptsPerCorrect;

    await ctx.db.insert("quizResults", {
      userId: args.userId,
      score,
      total,
      questionIds: questionIds as any,
    });

    if (pointsEarned > 0) {
      await appendLedger(ctx, args.userId, economy, pointsEarned, "QUIZ_CORRECT");

      const xpPerCorrect = (await getNum(ctx, "quizXpPerCorrect")) || 20;
      const xpEarned = score * xpPerCorrect;
      if (xpEarned > 0) {
        const today = Math.floor(Date.now() / 86400000);
        await awardXP(ctx, {
          userId: args.userId,
          amount: xpEarned,
          source: "QUIZ",
          sourceId: `daily_quiz_${today}`,
        });
      }

      // Sync points with user's app wallet
      let wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique();

      if (wallet) {
        const newPoints =
          economy === "pi-browser"
            ? (wallet.piBrowserPointsBalance ?? 0) + pointsEarned
            : wallet.pointsBalance + pointsEarned;
        await ctx.db.patch(
          wallet._id,
          economy === "pi-browser"
            ? { piBrowserPointsBalance: newPoints }
            : { pointsBalance: newPoints },
        );

        await ctx.db.insert("walletTransactions", {
          userId: args.userId,
          type: "earn_points",
          pointsDelta: pointsEarned,
          piproDelta: 0,
          pointsBalanceAfter: newPoints,
          piproBalanceAfter: wallet.piproBalance,
          note: `Daily Quiz Reward (${score}/${total} correct)`,
        });
      }
    }

    return { score, total, pointsEarned, review };
  },
});

/** Action to trigger AI generation of questions or seed questions. */
export const triggerQuestionGeneration = action({
  args: { ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")) },
  handler: async (ctx, { ecosystem }) => {
    await ctx.runAction(internal.quiz.generateQuestions, { ecosystem, count: 10 });
  },
});
