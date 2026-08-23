import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { requireAdmin } from "./admin";
import { enforceRateLimit } from "./lib/ratelimit";
import { getNum } from "./rewardsConfig";
import { appendLedger } from "./lib/ledger";
import { awardXP } from "./xp";

// ─── Built-In High Quality Question Banks (Fallback & Seed) ─────────────────────

const BUILT_IN_QUESTIONS = {
  PI: [
    {
      question: "What is the consensus algorithm used by the Pi Network blockchain?",
      questionHa: "Wanne tsarin yarjejeniya (consensus) blockchain na Pi Network yake amfani da shi?",
      options: ["Proof of Work (PoW)", "Stellar Consensus Protocol (SCP)", "Proof of Stake (PoS)", "Proof of Authority (PoA)"],
      optionsHa: ["Proof of Work (PoW)", "Stellar Consensus Protocol (SCP)", "Proof of Stake (PoS)", "Proof of Authority (PoA)"],
      correctIndex: 1,
      explanation: "Pi Network builds on the Stellar Consensus Protocol (SCP) to enable eco-friendly mobile mining.",
      explanationHa: "Pi Network yana gina ne akan Stellar Consensus Protocol (SCP) don ba da damar hakar kudin dijital a wayar salula cikin sauki.",
    },
    {
      question: "What is the primary role of Security Circles in Pi Network?",
      questionHa: "Menene babban aikin Security Circles a cikin Pi Network?",
      options: ["Increase transaction fees", "Build global trust graphs to secure consensus", "Mine Bitcoin simultaneously", "Store private keys on cloud"],
      optionsHa: ["Karin kudin hada-hada", "Gina amintacciyar hanyar tabbatar da tsaro a duniya", "Hakar Bitcoin a lokaci guda", "Ajiye lambobin sirri a gajimare"],
      correctIndex: 1,
      explanation: "Security circles consist of 3-5 trusted members that form a global trust graph for consensus.",
      explanationHa: "Security Circles sun kunshi mutane 3-5 amintattu don tabbatar da tsaron hanyar hada-hada a duniya.",
    },
    {
      question: "What utility does Pi Browser provide in the Pi ecosystem?",
      questionHa: "Wanne amfani Pi Browser yake da shi a cikin tsarin Pi?",
      options: ["Only plays videos", "Web3 browser for Pi apps, Pi Wallet, and Pi KYC", "A photo editor", "Mining bitcoin"],
      optionsHa: ["Kallon bidiyo kawai", "Babban dakin Web3 na bude manhajojin Pi, Pi Wallet da Pi KYC", "Gyara hotuna", "Hakar bitcoin"],
      correctIndex: 1,
      explanation: "Pi Browser is the Web3 gateway containing Pi Apps, Pi Wallet, and the native Pi KYC solution.",
      explanationHa: "Pi Browser shine kofar Web3 da ke dauke da aikace-aikacen Pi, Pi Wallet da kuma Pi KYC.",
    },
    {
      question: "What is the total maximum supply cap of Pi tokens?",
      questionHa: "Menene adadin duka kudaden Pi da za a fitar a duniya?",
      options: ["21 Million", "100 Billion", "500 Billion", "Unlimited"],
      optionsHa: ["Miliyan 21", "Biliyan 100", "Biliyan 500", "Babu iyaka"],
      correctIndex: 1,
      explanation: "The total supply of Pi is capped at 100 billion tokens for community, core team, and ecosystem reserves.",
      explanationHa: "Adadin kudin Pi an tsara shi a kan biliyan 100 ga al'umma da masu bunkasa manhaja da asusun ajiya.",
    },
    {
      question: "How often do Pi Network users need to ping the app to confirm active presence?",
      questionHa: "Kowane bayan wane lokaci ne ake bukatar danna alamar walƙiya a Pi?",
      options: ["Every 1 hour", "Every 24 hours", "Once a week", "Every 12 hours"],
      optionsHa: ["Kowace awa 1", "Kowace awa 24", "Sau daya a mako", "Kowace awa 12"],
      correctIndex: 1,
      explanation: "Mining sessions last 24 hours, requiring users to press the lightning button daily.",
      explanationHa: "Zaman hakar kudi yana daukar awa 24, wanda ke bukatar danna alamar walƙiya kullum don tabbatar da cewa kana nan.",
    },
  ],
  SIDRA: [
    {
      question: "What makes Sidra Chain distinct as a digital currency platform?",
      questionHa: "Menene ya bambanta Sidra Chain a matsayin tsarin kudin dijital?",
      options: ["It is a meme token", "First Shariah-compliant decentralized financial platform", "Uses Proof of Work", "Has 50% inflation"],
      optionsHa: ["Kudin barkwanci ne (meme)", "Manhajar DeFi ta farko mai bin tsarin Shari'ar Musulunci", "Yana amfani da Proof of Work", "Yana da hauhawar farashi da kashi 50%"],
      correctIndex: 1,
      explanation: "Sidra Chain is designed specifically to provide Islamic Shariah-compliant DeFi services.",
      explanationHa: "Sidra Chain an gina shi ne musamman don bayar da tsarin hada-hadar kudi na DeFi bisa koyarwar Musulunci.",
    },
    {
      question: "What is the primary verification method used by Sidra Chain users?",
      questionHa: "Wace hanya ce mafi mahimmanci wajen tantance masu amfani da Sidra Chain?",
      options: ["Face ID only", "P2P Face-to-Face & Document Verification", "Phone number only", "No verification required"],
      optionsHa: ["Hoton fuska kawai", "Tantancewar P2P ido-da-ido da takardun shaida", "Lambar waya kawai", "Babu bukatar tantancewa"],
      correctIndex: 1,
      explanation: "Sidra KYC uses document verification paired with Peer-to-Peer (P2P) confirmation.",
      explanationHa: "Tantancewar Sidra KYC tana amfani da takardun shaida tare da tabbatarwar abokan harka (P2P).",
    },
    {
      question: "Which backing mechanism does Sidra Chain aim to leverage for stability?",
      questionHa: "Wane tsari Sidra Chain yake amfani da shi don daidaita kima?",
      options: ["Unbacked algorithmic minting", "Asset-backed and gold-backed Shariah principles", "US Dollar peg only", "No asset backing"],
      optionsHa: ["Kirkirar kudi marar tushe", "Kaddarori da zinare bisa ka'idojin Shari'a", "Dala kadai", "Babu wata kaddara"],
      correctIndex: 1,
      explanation: "Sidra Chain focuses on asset-backed stability aligned with Islamic ethical finance.",
      explanationHa: "Sidra Chain yana mai da hankali ne kan kaddarori da zinare don tabbatar da kwanciyar hankali da adalci a hada-hada.",
    },
    {
      question: "What is the purpose of Sidra Chain P2P verification?",
      questionHa: "Menene manufar tantancewar P2P a Sidra Chain?",
      options: ["Pay gas fees", "Confirm real human identity between validated community members", "Mine tokens faster", "Trade NFTs"],
      optionsHa: ["Biyan kudin gas", "Tabbatar da cewa ainihin mutum ne ba na'ura ba ta hanyar abokan harka", "Hakar kudi da sauri", "Kasuwancin NFT"],
      correctIndex: 1,
      explanation: "P2P verification ensures one real human per account by having verified peers confirm identity.",
      explanationHa: "Tantancewar P2P tana tabbatar da cewa kowane asusu na ainihin mutum ne ta hanyar tabbatarwar abokin harka.",
    },
    {
      question: "What ethical financial principle guides Sidra Chain transactions?",
      questionHa: "Wace ka'idar kudi ta addinin Musulunci ce ke jagorantar hada-hadar Sidra Chain?",
      options: ["Riba (usury/interest) prohibition", "High interest lending", "Unregulated gambling", "Hidden transaction fees"],
      optionsHa: ["Haramcin Riba da caca", "Bada rancen kudi da kudin ruwa", "Wasan caca ba tare da tsari ba", "Boyayyen kudin hada-hada"],
      correctIndex: 0,
      explanation: "Sidra Chain operates under Shariah rules prohibiting Riba (interest) and speculative gambling.",
      explanationHa: "Sidra Chain yana aiki ne a karkashin dokokin Shari'a da suka haramta riba da caca.",
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
        questionHa: q.questionHa,
        options: q.options,
        optionsHa: q.optionsHa,
        explanation: q.explanation,
        explanationHa: q.explanationHa,
        courseTitle: "General Knowledge",
        lessonTitle: null,
        topic: "Basics",
        difficultyLabel: "EASY",
      }));
    }

    // All active published questions from the Knowledge Center & Question Bank
    const pool = allQuestions.filter(
      (q) => q.status === "PUBLISHED" || q.status === undefined || !q.status
    );

    const activeBank = pool.length > 0 ? pool : allQuestions;

    const [courses, lessons] = await Promise.all([
      ctx.db.query("courses").collect(),
      ctx.db.query("lessons").collect(),
    ]);

    const courseMap = new Map<string, any>(courses.map((c) => [c._id, c]));
    const lessonMap = new Map<string, any>(lessons.map((l) => [l._id, l]));

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

    const chosen: typeof activeBank = [];
    const seed = `${userId}:${ecosystem}:${day}`;
    const pick = (group: typeof activeBank, n: number) => {
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
        const group = activeBank.filter((q) => courseMap.get(q.courseId!)?.key === p.courseKey);
        if (group.length > 0) pick(group, p.count);
      }
      if (chosen.length < qCount) {
        pick(activeBank.filter((q) => !seen.has(q._id)), qCount - chosen.length);
      }
    } else {
      pick(activeBank, qCount);
    }

    // Last resort: allow repeats only if the bank is genuinely too small.
    if (chosen.length < qCount && activeBank.length > 0) {
      let i = 0;
      while (chosen.length < qCount && i < activeBank.length * 3) {
        chosen.push(activeBank[i % activeBank.length]);
        i++;
      }
    }

    return chosen.slice(0, qCount).map((q) => {
      const course = q.courseId ? courseMap.get(q.courseId) : null;
      const lesson = q.lessonId ? lessonMap.get(q.lessonId) : null;
      return {
        _id: q._id,
        question: q.question,
        questionHa: q.questionHa ?? null,
        options: q.options,
        optionsHa: q.optionsHa ?? null,
        topic: q.topic ?? course?.shortTitle ?? null,
        difficultyLabel: q.difficultyLabel ?? "EASY",
        courseKey: course?.key ?? null,
        courseTitle: course?.title ?? course?.shortTitle ?? null,
        lessonTitle: lesson?.title ?? null,
        sourceUrl: q.sourceUrl ?? null,
      };
    });
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
      explanationHa?: string;
      courseId?: any;
      lessonId?: any;
    }> = [];

    for (const answer of args.answers) {
      let meta: { correctIndex: number; explanation: string; explanationHa?: string; courseId?: any; lessonId?: any };

      if (answer.questionId.startsWith("builtin-")) {
        // Built-in question lookup
        const parts = answer.questionId.split("-");
        const eco = parts[1] as "PI" | "SIDRA";
        const idx = Number(parts[2]);
        const bq = BUILT_IN_QUESTIONS[eco]?.[idx];
        meta = {
          correctIndex: bq?.correctIndex ?? -1,
          explanation: bq?.explanation ?? "",
          explanationHa: bq?.explanationHa ?? "",
        };
      } else {
        const question = await ctx.db.get(answer.questionId as any);
        if (question && "correctIndex" in question) {
          const q = question as any;
          meta = {
            correctIndex: q.correctIndex,
            explanation: q.explanation ?? "",
            explanationHa: q.explanationHa ?? "",
            courseId: q.courseId,
            lessonId: q.lessonId,
          };
        } else {
          meta = { correctIndex: -1, explanation: "", explanationHa: "" };
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
      explanationHa: m.explanationHa || m.explanation,
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

// ─── Admin Quiz & Knowledge Center Question Management ───────────────────────

export const adminListQuestions = query({
  args: {
    token: v.string(),
    ecosystem: v.optional(v.union(v.literal("PI"), v.literal("SIDRA"))),
  },
  handler: async (ctx, { token, ecosystem }) => {
    requireAdmin(token);
    const [all, courses, lessons] = await Promise.all([
      ctx.db.query("quizQuestions").collect(),
      ctx.db.query("courses").collect(),
      ctx.db.query("lessons").collect(),
    ]);

    const courseMap = new Map<string, any>(courses.map((c) => [c._id, c]));
    const lessonMap = new Map<string, any>(lessons.map((l) => [l._id, l]));

    let filtered = all;
    if (ecosystem) {
      filtered = filtered.filter((q) => q.ecosystem === ecosystem);
    }

    return filtered.map((q) => ({
      ...q,
      courseTitle: q.courseId ? courseMap.get(q.courseId)?.shortTitle || courseMap.get(q.courseId)?.title || null : null,
      lessonTitle: q.lessonId ? lessonMap.get(q.lessonId)?.title || null : null,
    }));
  },
});

export const adminCreateQuestion = mutation({
  args: {
    token: v.string(),
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    category: v.optional(v.string()),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    explanation: v.string(),
    difficulty: v.optional(v.number()),
    questionHa: v.optional(v.string()),
    optionsHa: v.optional(v.array(v.string())),
    explanationHa: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    topic: v.optional(v.string()),
    difficultyLabel: v.optional(v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD"))),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...fields }) => {
    requireAdmin(token);
    const now = Date.now();
    return await ctx.db.insert("quizQuestions", {
      category: fields.category || "general",
      difficulty: fields.difficulty || 1,
      difficultyLabel: fields.difficultyLabel || "EASY",
      status: "PUBLISHED",
      contentVersion: 1,
      lastReviewedAt: now,
      ...fields,
    });
  },
});

export const adminUpdateQuestion = mutation({
  args: {
    token: v.string(),
    questionId: v.id("quizQuestions"),
    question: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctIndex: v.optional(v.number()),
    explanation: v.optional(v.string()),
    difficulty: v.optional(v.number()),
    questionHa: v.optional(v.string()),
    optionsHa: v.optional(v.array(v.string())),
    explanationHa: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    topic: v.optional(v.string()),
    difficultyLabel: v.optional(v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD"))),
    sourceUrl: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("DRAFT"),
        v.literal("REVIEW"),
        v.literal("PUBLISHED"),
        v.literal("NEEDS_REVIEW"),
        v.literal("OUTDATED"),
        v.literal("ARCHIVED"),
      ),
    ),
  },
  handler: async (ctx, { token, questionId, ...fields }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(questionId);
    if (!existing) throw new Error("Question not found");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    patch.lastReviewedAt = Date.now();
    patch.contentVersion = (existing.contentVersion ?? 1) + 1;

    await ctx.db.patch(questionId, patch);
    return questionId;
  },
});

export const adminDeleteQuestion = mutation({
  args: {
    token: v.string(),
    questionId: v.id("quizQuestions"),
  },
  handler: async (ctx, { token, questionId }) => {
    requireAdmin(token);
    await ctx.db.delete(questionId);
    return { success: true };
  },
});

