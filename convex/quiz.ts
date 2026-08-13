import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";
import { getNum } from "./rewardsConfig";
import { appendLedger } from "./lib/ledger";

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

/** Returns 5 quiz questions for the daily challenge, auto-seeding if empty. */
export const getDailyQuiz = query({
  args: { userId: v.id("users"), ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")) },
  handler: async (ctx, { userId, ecosystem }) => {
    await requireUser(ctx, userId);
    let allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_ecosystem", (q) => q.eq("ecosystem", ecosystem))
      .collect();

    // Auto-seed if database doesn't have enough questions yet
    if (allQuestions.length === 0) {
      const list = BUILT_IN_QUESTIONS[ecosystem];
      return list.map((q, idx) => ({
        _id: `builtin-${ecosystem}-${idx}` as any,
        question: q.question,
        options: q.options,
      }));
    }

    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
    }));
  },
});

/** Submit quiz answers, credit points, and sync with app wallet. */
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

    for (const answer of args.answers) {
      let correctIndex = -1;

      if (answer.questionId.startsWith("builtin-")) {
        // Built-in question lookup
        const parts = answer.questionId.split("-");
        const eco = parts[1] as "PI" | "SIDRA";
        const idx = Number(parts[2]);
        if (BUILT_IN_QUESTIONS[eco]?.[idx]) {
          correctIndex = BUILT_IN_QUESTIONS[eco][idx].correctIndex;
        }
      } else {
        const question = await ctx.db.get(answer.questionId as any);
        if (question && "correctIndex" in question) {
          correctIndex = (question as any).correctIndex;
        }
      }

      questionIds.push(answer.questionId);
      if (answer.selectedIndex === correctIndex) {
        score++;
      }
    }

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

    return { score, total, pointsEarned };
  },
});

/** Action to trigger AI generation of questions or seed questions. */
export const triggerQuestionGeneration = action({
  args: { ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")) },
  handler: async (ctx, { ecosystem }) => {
    await ctx.runAction(internal.quiz.generateQuestions, { ecosystem, count: 10 });
  },
});
