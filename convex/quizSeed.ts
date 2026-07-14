import { internalMutation } from "./_generated/server";

// Dev-only question bank so the quiz works before OPENAI_API_KEY is set.
// The AI generator (quiz.generateQuestions) tops this up in production.

const SIDRA_QUESTIONS = [
  {
    question: "What type of financial system is Sidra Chain designed around?",
    options: ["Islamic finance principles", "Derivatives trading", "Fractional reserve banking", "Payday lending"],
    correctIndex: 0,
    explanation: "Sidra Chain is built to comply with Islamic finance principles.",
  },
  {
    question: "What is the native token of Sidra Chain commonly called?",
    options: ["SDA", "SIDRA", "SDR", "SID"],
    correctIndex: 1,
    explanation: "The native token is commonly referred to as SIDRA.",
  },
  {
    question: "What consensus concept do most modern blockchains use to validate transactions?",
    options: ["Manual review", "Consensus mechanisms", "Central approval", "Random selection"],
    correctIndex: 1,
    explanation: "Blockchains rely on consensus mechanisms like PoW or PoS.",
  },
  {
    question: "What is a blockchain wallet used for?",
    options: ["Storing private keys and managing assets", "Mining only", "Browsing websites", "Sending emails"],
    correctIndex: 0,
    explanation: "A wallet manages your keys and lets you hold and transfer assets.",
  },
  {
    question: "Why should you NEVER share your seed phrase?",
    options: ["It gives full control of your wallet", "It slows the network", "It voids staking rewards", "It uses extra data"],
    correctIndex: 0,
    explanation: "Anyone with your seed phrase can take all your funds.",
  },
  {
    question: "What does KYC stand for in crypto onboarding?",
    options: ["Keep Your Coins", "Know Your Customer", "Key Yield Curve", "Known Yearly Cost"],
    correctIndex: 1,
    explanation: "KYC = Know Your Customer, an identity verification process.",
  },
  {
    question: "A block in a blockchain primarily contains…",
    options: ["A batch of transactions", "User passwords", "App source code", "Advertising data"],
    correctIndex: 0,
    explanation: "Blocks bundle validated transactions linked by hashes.",
  },
  {
    question: "What makes blockchain records hard to tamper with?",
    options: ["Cryptographic hashing linking blocks", "Government oversight", "Fast internet", "Cloud backups"],
    correctIndex: 0,
    explanation: "Each block references the previous block's hash — changing history breaks the chain.",
  },
] as const;

const PI_QUESTIONS = [
  {
    question: "How do users primarily mine Pi?",
    options: ["Tapping daily in the mobile app", "GPU rigs", "Data centers", "Buying hash power"],
    correctIndex: 0,
    explanation: "Pi uses mobile-first daily check-in mining.",
  },
  {
    question: "What is Pi Network's KYC used for?",
    options: ["Verifying one account per person", "Raising fees", "Mining faster", "Unlocking ads"],
    correctIndex: 0,
    explanation: "KYC enforces one verified account per human.",
  },
  {
    question: "What consensus protocol family does Pi Network build on?",
    options: ["Stellar Consensus Protocol", "Proof of Work", "Proof of Burn", "Tangle"],
    correctIndex: 0,
    explanation: "Pi is based on the Stellar Consensus Protocol (SCP).",
  },
  {
    question: "What is the Pi Browser used for?",
    options: ["Accessing Pi ecosystem apps", "Mining faster", "Watching videos", "Playing games only"],
    correctIndex: 0,
    explanation: "The Pi Browser hosts Pi ecosystem dApps.",
  },
  {
    question: "In Pi, what is a 'security circle'?",
    options: ["Trusted members boosting network security", "A staking pool", "A password vault", "A support chat"],
    correctIndex: 0,
    explanation: "Security circles are groups of trusted users that strengthen consensus.",
  },
  {
    question: "What does 'mainnet' mean?",
    options: ["The live production blockchain", "A test network", "A wallet app", "A mining pool"],
    correctIndex: 0,
    explanation: "Mainnet is the live blockchain where real transactions settle.",
  },
] as const;

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("quizQuestions").take(1);
    if (existing.length > 0) {
      return "already seeded";
    }
    for (const q of SIDRA_QUESTIONS) {
      await ctx.db.insert("quizQuestions", {
        ecosystem: "SIDRA",
        category: "general",
        difficulty: 1,
        question: q.question,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
    }
    for (const q of PI_QUESTIONS) {
      await ctx.db.insert("quizQuestions", {
        ecosystem: "PI",
        category: "general",
        difficulty: 1,
        question: q.question,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
    }
    return `seeded ${SIDRA_QUESTIONS.length + PI_QUESTIONS.length} questions`;
  },
});
