// Learn Pi / Learn Sidra academy (plan §7.11b).
// Leveled guides with a quiz gate per level: read the guide, pass the gate to
// unlock the next level and earn points + a badge. Content is static (no DB /
// no admin editing needed), so it lives here next to the pure gate logic.

import type { Ecosystem } from "./types";

export type AcademyQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type AcademyLesson = {
  level: number; // 1-based; must complete level N to unlock N+1
  title: string;
  body: string;
  quiz: AcademyQuestion[];
};

export const ACADEMY_PASS_RATIO = 0.7; // share of gate questions needed to pass
export const ACADEMY_LEVEL_POINTS = 10; // awarded once, first time a level is passed

export const ACADEMY: Record<Ecosystem, AcademyLesson[]> = {
  PI: [
    {
      level: 1,
      title: "Pi Basics",
      body: "Pi Network lets you mine the Pi cryptocurrency from your phone by tapping a button once a day. It does not run the mining in the background, so it uses no extra battery or data — the daily tap just confirms you are a real, active member. Pi aims to build a currency and ecosystem owned by everyday people rather than early speculators.",
      quiz: [
        {
          question: "How often do you tap to keep mining Pi?",
          options: ["Once a day", "Every hour", "Continuously in the background", "Once a week"],
          correctIndex: 0,
          explanation: "One tap every 24 hours confirms you are active; it does not run in the background.",
        },
        {
          question: "Why does Pi mining not drain your battery?",
          options: [
            "It does no background computation — the tap just marks you active",
            "It only runs while charging",
            "It uses a special low-power chip",
            "It mines on Pi's servers using your password",
          ],
          correctIndex: 0,
          explanation: "There is no real background mining on the phone; the daily tap is a presence check.",
        },
      ],
    },
    {
      level: 2,
      title: "Your Pi Wallet",
      body: "Your Pi wallet is secured by a secret passphrase (seed phrase). Whoever holds that phrase controls the wallet and all its Pi — Pi cannot recover it for you if you lose it. Never type your passphrase into a website or share it with anyone claiming to be support. Store it offline, and treat it like the only key to a safe.",
      quiz: [
        {
          question: "What happens if someone else gets your wallet passphrase?",
          options: [
            "They get full control of your wallet and Pi",
            "Nothing, it is only a username",
            "They can see your balance but not move it",
            "Pi support blocks them automatically",
          ],
          correctIndex: 0,
          explanation: "The passphrase is full control. Anyone who has it can take everything.",
        },
        {
          question: "Where should you keep your passphrase?",
          options: [
            "Offline and private, never typed into random sites",
            "In a public group chat for backup",
            "Emailed to Pi support",
            "In your social media bio",
          ],
          correctIndex: 0,
          explanation: "Keep it offline and private. No legitimate support will ever ask for it.",
        },
      ],
    },
    {
      level: 3,
      title: "KYC & Mainnet",
      body: "To move your Pi to the live (Mainnet) blockchain, you must pass KYC — a one-time identity check that proves each account is a unique real person, which protects the currency from fake accounts. After KYC, your mined Pi migrates to Mainnet where it can be used across Pi ecosystem apps. Only complete KYC through the official Pi app, never a link someone sends you.",
      quiz: [
        {
          question: "What is the main purpose of Pi KYC?",
          options: [
            "Prove each account is a unique real person",
            "Increase your mining speed",
            "Give Pi permission to sell your data",
            "Unlock a bigger phone screen",
          ],
          correctIndex: 0,
          explanation: "KYC keeps the network free of fake accounts by verifying real, unique humans.",
        },
        {
          question: "Where should you complete KYC?",
          options: [
            "Only in the official Pi app",
            "Any link a friend sends",
            "A third-party website that promises free Pi",
            "By replying to a support email with your ID",
          ],
          correctIndex: 0,
          explanation: "Use only the official app; KYC links from others are a common scam.",
        },
      ],
    },
  ],
  SIDRA: [
    {
      level: 1,
      title: "Sidra Basics",
      body: "Sidra Chain is a blockchain built around Islamic (Shariah-compliant) finance principles. Its native token is commonly called SIDRA. The goal is to offer ethical, interest-free financial tools that follow Shariah rules while still using modern blockchain technology for transparency and security.",
      quiz: [
        {
          question: "What set of principles is Sidra Chain designed around?",
          options: [
            "Islamic (Shariah-compliant) finance",
            "High-frequency derivatives trading",
            "Interest-based lending",
            "Fractional reserve banking",
          ],
          correctIndex: 0,
          explanation: "Sidra Chain is built to comply with Islamic finance principles.",
        },
        {
          question: "What is Sidra Chain's native token commonly called?",
          options: ["SIDRA", "SDA", "SDR", "SID"],
          correctIndex: 0,
          explanation: "The native token is commonly referred to as SIDRA.",
        },
      ],
    },
    {
      level: 2,
      title: "Your Sidra Wallet",
      body: "Like any blockchain wallet, your Sidra wallet is protected by private keys / a seed phrase that only you should ever see. Losing them means losing access; sharing them means losing your funds. Back up your recovery phrase offline, and be alert to fake 'support' accounts asking you to verify or reveal it — no real service needs your seed phrase.",
      quiz: [
        {
          question: "Who should ever see your wallet's seed phrase?",
          options: ["Only you", "Support staff", "Anyone in your referral team", "The app developer"],
          correctIndex: 0,
          explanation: "A seed phrase is for your eyes only; sharing it hands over your funds.",
        },
        {
          question: "How should you back up your recovery phrase?",
          options: [
            "Written down and stored offline",
            "Screenshotted and posted publicly",
            "Sent to a support chat",
            "Saved as your account password hint",
          ],
          correctIndex: 0,
          explanation: "Offline backup keeps it out of reach of hackers and scam 'support'.",
        },
      ],
    },
    {
      level: 3,
      title: "Shariah Principles",
      body: "Shariah-compliant finance avoids riba (interest), excessive uncertainty, and investment in prohibited activities. Instead it favors real, asset-backed value and fair, transparent risk-sharing between parties. Understanding this is key to trusting how a chain like Sidra structures its financial products differently from conventional interest-based systems.",
      quiz: [
        {
          question: "What does Shariah-compliant finance specifically avoid?",
          options: [
            "Riba (interest)",
            "Using any technology",
            "Saving money",
            "Owning assets",
          ],
          correctIndex: 0,
          explanation: "Riba (interest) is prohibited; the system favors asset-backed, risk-sharing value.",
        },
        {
          question: "What does Shariah-compliant finance favor instead of interest?",
          options: [
            "Real, asset-backed value and shared risk",
            "Guaranteed fixed returns with no risk",
            "Hidden fees",
            "Lending at the highest possible rate",
          ],
          correctIndex: 0,
          explanation: "It emphasizes real assets and fair, transparent risk-sharing.",
        },
      ],
    },
  ],
};

export function getLesson(ecosystem: Ecosystem, level: number): AcademyLesson | undefined {
  return ACADEMY[ecosystem].find((l) => l.level === level);
}

// Score a gate attempt. `answers` is the selected option index per question, in
// lesson order; a missing/wrong answer just counts as incorrect.
export function scoreGate(
  lesson: AcademyLesson,
  answers: number[],
): { score: number; total: number; passed: boolean } {
  const total = lesson.quiz.length;
  let score = 0;
  lesson.quiz.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score++;
  });
  return { score, total, passed: total > 0 && score / total >= ACADEMY_PASS_RATIO };
}
