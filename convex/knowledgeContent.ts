// Pi Pioneer Knowledge Center — official-source content (learn-pi.md).
//
// All factual claims are grounded in official Pi Network sources:
//   - Pi Whitepaper  https://minepi.com/white-paper/
//   - Pi Roadmap     https://minepi.com/roadmap
//   - Pi Network     https://minepi.com  (+ official announcements/blog)
//   - Pi Docs        https://docs.minepi.com
//
// Content is deliberately conservative: where Pi's exact numbers or
// procedures can change (migration steps, dates, tokenomics percentages),
// lessons flag that admins must keep them current (status/versioning).
// Nothing here is invented, and no source is a random blog/social post.

import type { Doc } from "./_generated/dataModel";

export type KnowledgeQuestion = {
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceId: string;
};

export type KnowledgeLesson = {
  number: number;
  title: string;
  what: string;
  why: string;
  how: string;
  example?: string;
  important?: string;
  commonMistake?: string;
  officialSource?: string;
  questions: KnowledgeQuestion[];
};

export type KnowledgeCourse = {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  sortOrder: number;
  sourceId: string;
  lessons: KnowledgeLesson[];
};

export type SourceRecord = {
  sourceId: string;
  title: string;
  officialUrl: string;
  publisher: string;
  version?: string;
  relevantSection?: string;
};

const LAST_CHECKED = Date.UTC(2026, 7, 13); // 2026-08-13 (review window)

export const SOURCES: SourceRecord[] = [
  {
    sourceId: "whitepaper",
    title: "Pi Whitepaper",
    officialUrl: "https://minepi.com/white-paper/",
    publisher: "Pi Network Core Team",
    version: "December 2021 Whitepaper (original published March 14, 2019)",
    relevantSection: "Token model, mining mechanism, consensus, distribution",
  },
  {
    sourceId: "roadmap",
    title: "Pi Network Roadmap",
    officialUrl: "https://minepi.com/roadmap",
    publisher: "Pi Network Core Team",
    relevantSection: "Phase history, mining history, wallet/migration history",
  },
  {
    sourceId: "website",
    title: "Pi Network (official site)",
    officialUrl: "https://minepi.com",
    publisher: "Pi Network Core Team",
    relevantSection: "Product overview, Pi Browser, mining app",
  },
  {
    sourceId: "blog",
    title: "Pi Network Blog & Official Announcements",
    officialUrl: "https://minepi.com/blog",
    publisher: "Pi Network Core Team",
    relevantSection: "KYC, Mainnet Checklist, migrations, network status",
  },
  {
    sourceId: "docs",
    title: "Pi Developer Documentation (Pi SDK)",
    officialUrl: "https://docs.minepi.com",
    publisher: "Pi Network Core Team",
    relevantSection: "Pi Apps, SDK, ecosystem payments",
  },
];

// ---------------------------------------------------------------------------
// 15 courses (learn-pi.md §1)
// ---------------------------------------------------------------------------

export const COURSES: KnowledgeCourse[] = [
  {
    key: "pi-introduction",
    title: "01. Pi Network Introduction",
    shortTitle: "Pi Introduction",
    description:
      "What Pi Network is, who created it, and the three phases of its roadmap.",
    sortOrder: 1,
    sourceId: "roadmap",
    lessons: [
      {
        number: 1,
        title: "What is Pi Network?",
        what: "Pi Network is a cryptocurrency project designed to make digital currency accessible to everyday people using mobile phones.",
        why: "Most cryptocurrencies are difficult for ordinary people to access. Pi's mission is to lower that barrier so anyone with a phone can participate.",
        how: "Pioneers mine Pi through the free official app by checking in once a day, then build a network through referrals and security circles.",
        example: "You open the official Pi app and tap the lightning button once a day to mine.",
        important: "Pi Network was officially launched on Pi Day, March 14, 2019, when the original Pi Whitepaper was published.",
        commonMistake:
          "Pi is not mined like Bitcoin — it does not use energy-heavy proof-of-work on phones.",
        officialSource: "Pi Network Roadmap (official launch + history).",
        questions: [
          {
            topic: "Pi introduction",
            difficulty: "EASY",
            question: "When was Pi Network officially launched?",
            options: [
              "March 14, 2019 (Pi Day)",
              "December 28, 2021",
              "February 20, 2025",
              "January 1, 2018",
            ],
            correctIndex: 0,
            explanation:
              "The original Pi Whitepaper was published on Pi Day, March 14, 2019, marking the official launch of Pi Network.",
            sourceId: "roadmap",
          },
          {
            topic: "Pi introduction",
            difficulty: "EASY",
            question: "What is Pi Network's core goal?",
            options: [
              "Make cryptocurrency accessible to everyday people via mobile phones",
              "Replace all government currencies",
              "Mine crypto using powerful computers",
              "Serve only professional traders",
            ],
            correctIndex: 0,
            explanation:
              "Pi's mission is to make cryptocurrency accessible to everyday people through mobile-first, low-cost participation.",
            sourceId: "website",
          },
          {
            topic: "Pi introduction",
            difficulty: "MEDIUM",
            question: "How do Pioneers primarily mine Pi?",
            options: [
              "Checking in once a day in the official app",
              "Running GPU rigs at home",
              "Buying hash power from pools",
              "Operating data centers",
            ],
            correctIndex: 0,
            explanation:
              "Pi uses mobile-first daily check-in mining — no expensive hardware or energy drain.",
            sourceId: "roadmap",
          },
        ],
      },
      {
        number: 2,
        title: "Who created Pi Network?",
        what: "Pi Network was founded by Stanford graduates, including Dr. Nicolas Kokkalis and Dr. Chengdiao Fan.",
        why: "Knowing the team behind a project helps Pioneers evaluate its credibility.",
        how: "The founders lead Pi Network's technology and product direction from the Core Team.",
        example: "Dr. Nicolas Kokkalis (Head of Technology) and Dr. Chengdiao Fan (Head of Product).",
        important:
          "Always check the official website for current information about Pi Network's team and leadership.",
        questions: [
          {
            topic: "Pi founders",
            difficulty: "MEDIUM",
            question: "Pi Network was founded by graduates of which university?",
            options: ["Stanford University", "Harvard University", "MIT", "Oxford University"],
            correctIndex: 0,
            explanation:
              "Pi Network was founded by Stanford graduates including Dr. Nicolas Kokkalis and Dr. Chengdiao Fan.",
            sourceId: "website",
          },
        ],
      },
      {
        number: 3,
        title: "The three phases of Pi",
        what: "Pi follows a three-phase roadmap: Beta (Phase I), Testnet (Phase II), and Mainnet (Phase III).",
        why: "Understanding the phases helps Pioneers know what is live versus what is planned.",
        how: "Phase I (Beta) started in 2019, Phase II (Testnet) began March 14, 2020, and Phase III (Mainnet) began in December 2021.",
        example: "The Enclosed Mainnet launched on December 28, 2021 with a firewall; the Open Network followed on February 20, 2025.",
        important:
          "Phase III is split into Enclosed Network and Open Network — a firewall separated the two.",
        questions: [
          {
            topic: "Pi phases",
            difficulty: "EASY",
            question: "What are the three phases of Pi Network's roadmap?",
            options: [
              "Beta, Testnet, Mainnet",
              "Testnet, Alpha, Mainnet",
              "Beta, Gamma, Mainnet",
              "Alpha, Testnet, Open",
            ],
            correctIndex: 0,
            explanation: "Pi's roadmap has three phases: Beta, Testnet, and Mainnet (Phase III).",
            sourceId: "roadmap",
          },
          {
            topic: "Pi phases",
            difficulty: "MEDIUM",
            question: "When did Pi's Enclosed Mainnet launch?",
            options: [
              "December 28, 2021",
              "March 14, 2019",
              "March 14, 2020",
              "February 20, 2025",
            ],
            correctIndex: 0,
            explanation:
              "The Enclosed Mainnet Pi blockchain launched on December 28, 2021, protected by a firewall.",
            sourceId: "roadmap",
          },
          {
            topic: "Pi phases",
            difficulty: "MEDIUM",
            question: "What did the Enclosed Mainnet firewall prevent?",
            options: [
              "External connectivity, such as transfers to exchanges",
              "All app downloads",
              "Mining in the app",
              "KYC verification",
            ],
            correctIndex: 0,
            explanation:
              "The Enclosed Mainnet was live but the firewall blocked external connectivity until the Open Network period.",
            sourceId: "roadmap",
          },
        ],
      },
    ],
  },

  {
    key: "pi-whitepaper",
    title: "02. Pi Network Whitepaper",
    shortTitle: "Pi Whitepaper",
    description:
      "The official document that explains Pi's design, mining mechanism, consensus, and token model.",
    sortOrder: 2,
    sourceId: "whitepaper",
    lessons: [
      {
        number: 1,
        title: "What the Whitepaper is",
        what: "The Pi Whitepaper is the official document by the Pi Core Team that explains Pi's mission, technical design, and token model.",
        why: "It is the primary source of truth for what Pi is designed to do.",
        how: "The original Whitepaper was published on March 14, 2019, and was updated (e.g., the December 2021 Whitepaper) as the network evolved.",
        example: "The Whitepaper describes mobile mining, the Trust Graph, and the token distribution model.",
        important:
          "The Whitepaper is on Pi's official website (minepi.com/white-paper) — verify information there, not from random posts.",
        questions: [
          {
            topic: "Whitepaper basics",
            difficulty: "EASY",
            question: "Where can you read the official Pi Whitepaper?",
            options: [
              "On Pi Network's official website (minepi.com)",
              "On any random blog",
              "Only inside third-party apps",
              "On social media posts",
            ],
            correctIndex: 0,
            explanation: "The official Pi Whitepaper is published on Pi's official website.",
            sourceId: "whitepaper",
          },
          {
            topic: "Whitepaper basics",
            difficulty: "MEDIUM",
            question: "The original Pi Whitepaper was published on…",
            options: [
              "March 14, 2019",
              "December 28, 2021",
              "March 14, 2020",
              "June 28, 2022",
            ],
            correctIndex: 0,
            explanation:
              "The original Pi Whitepaper was published on Pi Day, March 14, 2019.",
            sourceId: "whitepaper",
          },
        ],
      },
      {
        number: 2,
        title: "Core ideas in the Whitepaper",
        what: "The Whitepaper describes mobile-first mining, a Trust Graph of security circles, a consensus algorithm based on the Stellar Consensus Protocol (SCP), and a utility-driven economy.",
        why: "These ideas define how Pi differs from energy-heavy proof-of-work networks.",
        how: "Instead of burning energy on hashes, Pi's consensus uses cost-effective voting among nodes, weighting nodes with higher trust from the Trust Graph.",
        example: "A security circle of trusted members helps secure the network and boosts your mining rate.",
        important:
          "Pi builds on the Stellar Consensus Protocol family — not proof-of-work.",
        questions: [
          {
            topic: "Whitepaper consensus",
            difficulty: "HARD",
            question: "Which consensus protocol family does Pi build on?",
            options: [
              "Stellar Consensus Protocol (SCP)",
              "Proof of Work",
              "Proof of Burn",
              "Tangle",
            ],
            correctIndex: 0,
            explanation:
              "Pi's consensus algorithm is based on the Stellar Consensus Protocol (SCP) and uses the Trust Graph.",
            sourceId: "whitepaper",
          },
          {
            topic: "Whitepaper consensus",
            difficulty: "HARD",
            question: "What is a 'security circle' in Pi?",
            options: [
              "A trusted group of members that strengthens network security",
              "A staking pool",
              "A password vault",
              "A support chat",
            ],
            correctIndex: 0,
            explanation:
              "Security circles are trusted groups that form Pi's Trust Graph and strengthen consensus.",
            sourceId: "whitepaper",
          },
        ],
      },
    ],
  },

  {
    key: "pi-mining",
    title: "03. Pi Mining Explained",
    shortTitle: "Pi Mining",
    description:
      "How mobile mining works, the check-in model, security circles, and the base mining rate.",
    sortOrder: 3,
    sourceId: "whitepaper",
    lessons: [
      {
        number: 1,
        title: "How mining works",
        what: "Pioneers mine Pi by checking in once every 24 hours while the app is running — no heavy hardware or battery drain.",
        why: "This keeps mining accessible to everyday people and avoids the energy costs of proof-of-work.",
        how: "Mining rewards come from a base rate plus boosts from your security circle and referrals. The system-wide base rate halves each time the network of engaged Pioneers grows by 10x.",
        example: "The original base rate halved every 10x growth, starting at 1,000 Pioneers.",
        important:
          "Pi's mining mechanism was updated in the December 2021 Whitepaper to a dynamic base mining rate.",
        questions: [
          {
            topic: "Mining model",
            difficulty: "EASY",
            question: "How do Pioneers mine Pi?",
            options: [
              "Checking in once a day in the official app",
              "Running ASIC miners",
              "Buying cloud mining contracts",
              "Solving puzzles on a computer",
            ],
            correctIndex: 0,
            explanation:
              "Pi uses mobile-first daily check-in mining — tap once a day, no hardware needed.",
            sourceId: "whitepaper",
          },
          {
            topic: "Base rate",
            difficulty: "HARD",
            question: "In Pi's original mining mechanism, the base rate halved when engaged Pioneers grew by…",
            options: ["10x", "2x", "100x", "1000x"],
            correctIndex: 0,
            explanation:
              "Pi's system-wide base rate halved every time the network of engaged Pioneers grew by a factor of 10.",
            sourceId: "roadmap",
          },
        ],
      },
      {
        number: 2,
        title: "Security circles and referrals",
        what: "Your security circle and referral team boost your mining rate and strengthen the network.",
        why: "They grow Pi's Trust Graph, which improves security and distribution.",
        how: "Add trusted members to your security circle and invite people via your referral code.",
        example: "A larger security circle can increase your mining rate while contributing to network security.",
        commonMistake:
          "Joining many random accounts is not the same as a genuine security circle — Pi relies on trust.",
        questions: [
          {
            topic: "Security circles",
            difficulty: "MEDIUM",
            question: "What is the main purpose of a security circle?",
            options: [
              "Strengthening network security through trusted members",
              "Earning interest on Pi",
              "Storing Pi offline",
              "Buying more mining equipment",
            ],
            correctIndex: 0,
            explanation:
              "Security circles form the Trust Graph that Pi's consensus uses to secure the network.",
            sourceId: "whitepaper",
          },
        ],
      },
    ],
  },

  {
    key: "pi-tokenomics",
    title: "04. Pi Tokenomics",
    shortTitle: "Pi Tokenomics",
    description:
      "Pi's maximum supply and how the 100 billion Pi are distributed between the community and Core Team.",
    sortOrder: 4,
    sourceId: "whitepaper",
    lessons: [
      {
        number: 1,
        title: "Maximum supply",
        what: "Per Pi's published tokenomics information, Pi's total/maximum supply is 100 billion Pi.",
        why: "The supply cap defines the maximum Pi that can ever be created.",
        how: "Each allocation grows proportionally to the community's migrated mining rewards, keeping the percentage split constant.",
        important:
          "Supply figures are from Pi's official whitepaper — always re-check the current official source before quoting exact numbers.",
        questions: [
          {
            topic: "Pi supply",
            difficulty: "EASY",
            question: "What is the maximum supply of Pi according to Pi Network's published tokenomics information?",
            options: ["100 billion Pi", "21 million Pi", "1 trillion Pi", "10 billion Pi"],
            correctIndex: 0,
            explanation:
              "Pi's published tokenomics sets the maximum supply at 100 billion Pi.",
            sourceId: "whitepaper",
          },
        ],
      },
      {
        number: 2,
        title: "Community and Core Team allocation",
        what: "The whitepaper states the community holds 80% and the Core Team holds 20% of total circulating supply.",
        why: "A community-majority split aligns incentives with Pioneers.",
        how: "The community's 80% is made up of mining rewards (65%), a Foundation reserve (10%), and a liquidity allocation (5%).",
        example: "The largest single share of Pi's supply is reserved for community mining rewards.",
        important:
          "Exact percentages are subject to Pi's official updates — administrators should mark them NEEDS_REVIEW if Pi changes its documents.",
        questions: [
          {
            topic: "Pi distribution",
            difficulty: "MEDIUM",
            question: "What share of Pi's total supply goes to the community?",
            options: ["80%", "50%", "30%", "10%"],
            correctIndex: 0,
            explanation:
              "Per the whitepaper, the Pi community holds 80% of the total circulating supply and the Core Team 20%.",
            sourceId: "whitepaper",
          },
          {
            topic: "Pi distribution",
            difficulty: "MEDIUM",
            question: "What share of Pi's supply is reserved for the Core Team?",
            options: ["20%", "40%", "5%", "60%"],
            correctIndex: 0,
            explanation:
              "The Core Team holds 20% of Pi's total supply, unlocking in pace with community progress.",
            sourceId: "whitepaper",
          },
          {
            topic: "Pi distribution",
            difficulty: "HARD",
            question: "Within the community's 80% allocation, what receives the largest share?",
            options: [
              "Community mining rewards",
              "Foundation reserve",
              "Liquidity allocation",
              "Core Team bonus",
            ],
            correctIndex: 0,
            explanation:
              "Mining rewards receive the largest portion of community Pi (65% of total supply).",
            sourceId: "whitepaper",
          },
        ],
      },
    ],
  },

  {
    key: "pi-kyc",
    title: "05. KYC Explained",
    shortTitle: "Pi KYC",
    description:
      "Why Pi verifies one account per person, how KYC works, and the role of community validators.",
    sortOrder: 5,
    sourceId: "blog",
    lessons: [
      {
        number: 1,
        title: "What KYC is",
        what: "KYC (Know Your Customer) is Pi's identity verification process that ensures each account belongs to one real person.",
        why: "It keeps the network fair by preventing fake or duplicate accounts and is required before mined Pi can migrate to Mainnet.",
        how: "Pioneers complete KYC inside the official Pi app; once verified, their account is tied to a real identity.",
        example: "A Pioneer completes KYC, then becomes eligible to migrate their mined Pi to the Mainnet wallet.",
        important:
          "KYC helps enforce the 'one account per human' principle — Pi's network rule.",
        questions: [
          {
            topic: "KYC purpose",
            difficulty: "EASY",
            question: "What is Pi's KYC used for?",
            options: [
              "Verifying one account per person",
              "Raising transaction fees",
              "Speeding up mining",
              "Unlocking paid ads",
            ],
            correctIndex: 0,
            explanation:
              "KYC verifies that each account belongs to one real person, preventing fake accounts.",
            sourceId: "blog",
          },
          {
            topic: "KYC purpose",
            difficulty: "MEDIUM",
            question: "Why is KYC needed before migrating mined Pi to Mainnet?",
            options: [
              "To confirm the account belongs to a real, verified human",
              "To increase the mining rate",
              "To pay network fees",
              "To create a security circle",
            ],
            correctIndex: 0,
            explanation:
              "Only KYC-verified Pioneers can migrate mined Pi, confirming one account per person.",
            sourceId: "blog",
          },
        ],
      },
      {
        number: 2,
        title: "Community-powered validators",
        what: "Pi's KYC process is community-powered: verified Pioneers can become validators who review other Pioneers' KYC applications.",
        why: "This lets the network scale identity verification for a very large user base.",
        how: "After becoming KYC-verified, a Pioneer can apply to be a validator and review applications of Pioneers from their country.",
        important:
          "Validators review identity documents; they never ask for your wallet passphrase.",
        questions: [
          {
            topic: "KYC validators",
            difficulty: "MEDIUM",
            question: "Who reviews KYC applications in Pi's community-powered process?",
            options: [
              "Verified Pioneers acting as validators",
              "Random internet users",
              "Bank employees",
              "Third-party data brokers",
            ],
            correctIndex: 0,
            explanation:
              "Pi's KYC uses verified Pioneers as community validators to review applications at scale.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-mainnet",
    title: "06. Mainnet Explained",
    shortTitle: "Pi Mainnet",
    description:
      "The live Pi blockchain, the Enclosed Mainnet period, and the transition to the Open Network.",
    sortOrder: 6,
    sourceId: "roadmap",
    lessons: [
      {
        number: 1,
        title: "What Mainnet is",
        what: "Mainnet is Pi's live production blockchain where real Pi transactions settle.",
        why: "Unlike Testnet, Mainnet holds real Pi balances and real transactions.",
        how: "Pi launched the Enclosed Mainnet on December 28, 2021, then removed the firewall for the Open Network on February 20, 2025.",
        example: "After migration, your Pi lives on the Mainnet blockchain, not just in the app.",
        important:
          "The Enclosed Mainnet began in December 2021; the Open Network followed in February 2025.",
        questions: [
          {
            topic: "Mainnet basics",
            difficulty: "EASY",
            question: "What does 'mainnet' mean?",
            options: [
              "The live production blockchain",
              "A test network",
              "A wallet app",
              "A mining pool",
            ],
            correctIndex: 0,
            explanation:
              "Mainnet is the live blockchain where real transactions settle, unlike a testnet.",
            sourceId: "roadmap",
          },
          {
            topic: "Mainnet timeline",
            difficulty: "MEDIUM",
            question: "When did the Open Network (firewall removed) launch?",
            options: [
              "February 20, 2025",
              "December 28, 2021",
              "March 14, 2019",
              "June 28, 2022",
            ],
            correctIndex: 0,
            explanation:
              "The Open Network launched on February 20, 2025, allowing external connectivity.",
            sourceId: "roadmap",
          },
        ],
      },
    ],
  },

  {
    key: "pi-mainnet-checklist",
    title: "07. Mainnet Checklist",
    shortTitle: "Mainnet Checklist",
    description:
      "An educational walkthrough of the in-app Mainnet Checklist that precedes migration.",
    sortOrder: 7,
    sourceId: "blog",
    lessons: [
      {
        number: 1,
        title: "The purpose of the checklist",
        what: "The Mainnet Checklist is a set of steps inside the official Pi app that guides a Pioneer toward Mainnet migration.",
        why: "Completing the checklist (including KYC and creating a Mainnet wallet) is how a Pioneer becomes eligible to migrate mined Pi.",
        how: "Pioneers complete steps in the Pi app in order; View2Earn is not responsible for Pi's checklist.",
        example: "Typical steps involve confirming your identity (KYC) and creating/confirming your wallet.",
        important:
          "Checklist steps come from the official Pi app — always follow the current steps shown there.",
        questions: [
          {
            topic: "Checklist purpose",
            difficulty: "EASY",
            question: "Where does a Pioneer complete the Mainnet Checklist?",
            options: [
              "In the official Pi Network app",
              "On any third-party website",
              "By emailing support",
              "On social media",
            ],
            correctIndex: 0,
            explanation:
              "The Mainnet Checklist is completed inside the official Pi Network app.",
            sourceId: "blog",
          },
          {
            topic: "Checklist purpose",
            difficulty: "MEDIUM",
            question: "Which of these is typically part of preparing for Mainnet migration?",
            options: [
              "Completing KYC and creating a Mainnet wallet",
              "Paying a migration fee in cash",
              "Sharing your passphrase with support",
              "Submitting a bank account number",
            ],
            correctIndex: 0,
            explanation:
              "KYC and wallet setup are core parts of the migration preparation process.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-wallet",
    title: "08. Pi Wallet Fundamentals",
    shortTitle: "Pi Wallet",
    description:
      "How the Pi Wallet works, the public wallet address, and the secret passphrase.",
    sortOrder: 8,
    sourceId: "blog",
    lessons: [
      {
        number: 1,
        title: "What the Pi Wallet is",
        what: "The Pi Wallet is Pi's in-app wallet that stores your Pi on Mainnet, with a unique public address and a secret passphrase.",
        why: "A wallet is required to receive migrated Pi and to transact in the Pi ecosystem.",
        how: "You create the wallet in the Pi app, receive a passphrase, and confirm it during the Mainnet Checklist.",
        example: "Your wallet address is public — share it to receive Pi. Your passphrase is private — never share it.",
        important:
          "The passphrase is the only way to access the wallet; losing it means losing access.",
        questions: [
          {
            topic: "Wallet basics",
            difficulty: "EASY",
            question: "What do you need to control your Pi Wallet?",
            options: [
              "Your secret passphrase",
              "Your public email",
              "Your phone number only",
              "A bank PIN",
            ],
            correctIndex: 0,
            explanation:
              "The passphrase is the key that controls the wallet — keep it secret and safe.",
            sourceId: "blog",
          },
          {
            topic: "Wallet basics",
            difficulty: "MEDIUM",
            question: "Which of the following is safe to share?",
            options: [
              "Your public wallet address",
              "Your wallet passphrase",
              "Your private key",
              "Your seed phrase",
            ],
            correctIndex: 0,
            explanation:
              "The public wallet address is for receiving Pi and is safe to share; passphrases/keys/seed phrases are secret.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-wallet-security",
    title: "09. Wallet Passphrase Security",
    shortTitle: "Passphrase Security",
    description:
      "What a passphrase is, why it is sensitive, and how to keep your wallet safe.",
    sortOrder: 9,
    sourceId: "blog",
    lessons: [
      {
        number: 1,
        title: "Why your passphrase is sensitive",
        what: "Your wallet passphrase is a set of secret words that is the ONLY way to access your Pi wallet.",
        why: "Anyone with your passphrase can take full control of your Pi.",
        how: "Write it down and store it offline; never type it into websites, apps, or messages, and never give it to anyone.",
        example: "Legitimate parties (including View2Earn) will NEVER ask for your passphrase.",
        important:
          "Pi will never ask for your passphrase. Never send Pi 'for verification' — that is a scam.",
        questions: [
          {
            topic: "Passphrase security",
            difficulty: "EASY",
            question: "If someone asks for your Pi wallet passphrase, you should…",
            options: [
              "Refuse — no legitimate party ever needs it",
              "Share it only if they are from an exchange",
              "Send it to Pi support",
              "Type it into any website",
            ],
            correctIndex: 0,
            explanation:
              "Your passphrase is secret; no legitimate party — including View2Earn or Pi support — will ever ask for it.",
            sourceId: "blog",
          },
          {
            topic: "Passphrase security",
            difficulty: "MEDIUM",
            question: "Which is a safe way to store your wallet passphrase?",
            options: [
              "Written down and stored offline",
              "Saved in a public note",
              "Sent in a chat message",
              "Stored in a screenshot on social media",
            ],
            correctIndex: 0,
            explanation:
              "Offline, private storage is the recommended way to protect your passphrase.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-migration",
    title: "10. Mainnet Migration",
    shortTitle: "Mainnet Migration",
    description:
      "How mined Pi moves from the mobile app to the Mainnet wallet after KYC and the checklist.",
    sortOrder: 10,
    sourceId: "roadmap",
    lessons: [
      {
        number: 1,
        title: "What migration is",
        what: "Migration moves your mined Pi from the mobile app balance to your Mainnet wallet on the live blockchain.",
        why: "Only migrated Pi exists on-chain, where it can be transacted in the ecosystem.",
        how: "Complete the Mainnet Checklist and KYC, create/confirm your wallet, then Pi migrates eligible balances in waves.",
        example: "Ability for Pioneers to migrate Pi to their Mainnet Wallet began on June 28, 2022.",
        important:
          "Migration rules and timing are set by Pi and can change — always follow official announcements.",
        questions: [
          {
            topic: "Migration basics",
            difficulty: "EASY",
            question: "What does Mainnet migration do?",
            options: [
              "Moves mined Pi to your Mainnet wallet",
              "Converts Pi into cash instantly",
              "Merges multiple Pi accounts",
              "Starts a new mining session",
            ],
            correctIndex: 0,
            explanation:
              "Migration moves your mined Pi balance onto the live Mainnet blockchain wallet.",
            sourceId: "roadmap",
          },
          {
            topic: "Migration eligibility",
            difficulty: "MEDIUM",
            question: "Why might a Pioneer's mined Pi not be migrated?",
            options: [
              "They have not passed KYC / completed the checklist",
              "They mined on an Android phone",
              "They have a security circle",
              "They have not referred anyone",
            ],
            correctIndex: 0,
            explanation:
              "KYC and checklist completion are required for Pi to be eligible for migration.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-migrations-1-2",
    title: "11. First & Second Migration",
    shortTitle: "First & Second Migration",
    description:
      "The difference between the first migration and later (second) migrations of Pi.",
    sortOrder: 11,
    sourceId: "blog",
    lessons: [
      {
        number: 1,
        title: "First migration",
        what: "The first migration is the initial transfer of eligible mined Pi to the Mainnet wallet for verified Pioneers.",
        why: "It moved the bulk of eligible balances onto the live blockchain.",
        how: "Pioneers who passed KYC and completed the checklist had their eligible Pi migrated in the first wave.",
        example: "Migrations began after Mainnet wallets and migration functionality were released (June 28, 2022).",
        questions: [
          {
            topic: "First migration",
            difficulty: "MEDIUM",
            question: "When could Pioneers first migrate Pi to their Mainnet Wallet?",
            options: [
              "June 28, 2022",
              "March 14, 2019",
              "February 20, 2025",
              "December 28, 2021",
            ],
            correctIndex: 0,
            explanation:
              "The ability for Pioneers to migrate Pi to their Mainnet Wallet began on June 28, 2022.",
            sourceId: "roadmap",
          },
        ],
      },
      {
        number: 2,
        title: "Second and later migrations",
        what: "A second (and later) migration transfers newly eligible Pi — for example Pi mined after the first migration or from Pioneers who completed KYC later.",
        why: "Migration is not a single one-time event; additional eligible Pi can be migrated later.",
        how: "Pi performs additional migrations over time according to official announcements.",
        important:
          "Migration procedures can change. These lessons carry source/date metadata so admins can keep them current.",
        questions: [
          {
            topic: "Second migration",
            difficulty: "MEDIUM",
            question: "What is a 'second migration' in Pi?",
            options: [
              "A later migration of newly eligible Pi",
              "A second wallet for the same account",
              "Migrating Pi to a bank",
              "Restarting the mining app",
            ],
            correctIndex: 0,
            explanation:
              "A second migration transfers newly eligible Pi that was not part of the first migration.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-browser",
    title: "12. Pi Browser",
    shortTitle: "Pi Browser",
    description:
      "The official Pi Browser app: its role, how to access Pi apps, and security considerations.",
    sortOrder: 12,
    sourceId: "website",
    lessons: [
      {
        number: 1,
        title: "What Pi Browser is",
        what: "Pi Browser is Pi's official browser app that hosts and lets Pioneers use Pi ecosystem applications.",
        why: "It is the gateway to Pi apps, including apps that use Pi payments.",
        how: "Pi apps open inside the Pi Browser; deep links using the pi:// scheme redirect to the Pi Browser.",
        example: "A Pi app link like pi://example.com opens that site inside the Pi Browser.",
        important:
          "Not every app in the Pi Browser is an official Pi Network product — many are built by the community.",
        questions: [
          {
            topic: "Pi Browser basics",
            difficulty: "EASY",
            question: "What is the Pi Browser used for?",
            options: [
              "Accessing Pi ecosystem apps",
              "Mining faster",
              "Watching videos only",
              "Playing games only",
            ],
            correctIndex: 0,
            explanation:
              "The Pi Browser is the gateway to Pi ecosystem applications.",
            sourceId: "website",
          },
          {
            topic: "Pi Browser links",
            difficulty: "MEDIUM",
            question: "What does a 'pi://' deep link do?",
            options: [
              "Opens a website in the Pi Browser",
              "Sends Pi to another wallet",
              "Starts mining",
              "Verifies your KYC",
            ],
            correctIndex: 0,
            explanation:
              "The pi:// URL scheme lets other apps open websites inside the Pi Browser.",
            sourceId: "website",
          },
        ],
      },
    ],
  },

  {
    key: "pi-apps-ecosystem",
    title: "13. Pi Apps & Ecosystem",
    shortTitle: "Pi Apps & Ecosystem",
    description:
      "How the Pi ecosystem works, the Pi SDK, and how to tell official from community apps.",
    sortOrder: 13,
    sourceId: "docs",
    lessons: [
      {
        number: 1,
        title: "The Pi ecosystem",
        what: "The Pi ecosystem is the collection of apps and utilities built around Pi, including Core Team apps and third-party community apps.",
        why: "Ecosystem apps create real utility for Pi.",
        how: "Developers build apps with the Pi SDK and register them through Pi's developer tools; apps can transact Mainnet Pi.",
        example: "After Enclosed Mainnet, Pi Apps gained the ability to interact with the Mainnet blockchain via SDK API calls (July 26, 2022).",
        important:
          "A community app being available in the Pi Browser does NOT mean it is officially endorsed by Pi Network.",
        questions: [
          {
            topic: "Pi ecosystem",
            difficulty: "EASY",
            question: "Pi ecosystem apps are built with…",
            options: ["The Pi SDK", "Banking software", "Browser extensions", "Email tools"],
            correctIndex: 0,
            explanation:
              "Developers use the Pi SDK to build and integrate Pi ecosystem apps.",
            sourceId: "docs",
          },
          {
            topic: "Pi ecosystem",
            difficulty: "MEDIUM",
            question: "Just because an app is in the Pi Browser, does it mean it is officially endorsed by Pi Network?",
            options: [
              "No — it may be a third-party/community app",
              "Yes — all Pi Browser apps are official",
              "Only if it uses payments",
              "Only if it has many users",
            ],
            correctIndex: 0,
            explanation:
              "The Pi Browser hosts community apps too; availability does not imply official endorsement.",
            sourceId: "website",
          },
        ],
      },
    ],
  },

  {
    key: "pi-security",
    title: "14. Pi Scams & Security",
    shortTitle: "Pi Security",
    description:
      "How to recognize scams, impersonation, and protect your Pi account.",
    sortOrder: 14,
    sourceId: "blog",
    lessons: [
      {
        number: 1,
        title: "Recognizing scams",
        what: "Scams commonly ask for your passphrase, private key, or Pi 'for verification'.",
        why: "Whoever holds the passphrase controls the wallet — scammers use it to steal Pi.",
        how: "Refuse any request for your passphrase, ignore fake support/impersonators, and only trust official Pi channels.",
        example: "A message offering 'free Pi' that requires your passphrase is a scam.",
        important:
          "Official Pi support and View2Earn will NEVER ask for your passphrase or private key.",
        questions: [
          {
            topic: "Scam red flags",
            difficulty: "EASY",
            question: "Which of these is a red flag?",
            options: [
              "Someone asking for your passphrase or Pi 'for verification'",
              "A legitimate app asking for your public wallet address",
              "The official app asking you to confirm your phone number",
              "A store accepting Pi payments",
            ],
            correctIndex: 0,
            explanation:
              "No legitimate party ever needs your passphrase or asks you to send Pi for verification.",
            sourceId: "blog",
          },
          {
            topic: "Scam red flags",
            difficulty: "MEDIUM",
            question: "How should you treat 'support' accounts that DM you asking for your wallet passphrase?",
            options: [
              "Ignore and report them — it is impersonation",
              "Share only your username",
              "Send them a small test amount",
              "Share your passphrase so they can help",
            ],
            correctIndex: 0,
            explanation:
              "Real support never contacts you to ask for your passphrase; such accounts are impersonators.",
            sourceId: "blog",
          },
        ],
      },
    ],
  },

  {
    key: "pi-official-resources",
    title: "15. Official Pi Resources & How to Verify Information",
    shortTitle: "Official Resources",
    description:
      "How to check whether Pi information is official and reduce misinformation.",
    sortOrder: 15,
    sourceId: "website",
    lessons: [
      {
        number: 1,
        title: "How to know information is official",
        what: "Official Pi information comes from Pi Network's own channels: the website, official announcements/blog, whitepaper, and developer documentation.",
        why: "Verifying sources reduces misinformation and protects you from scams.",
        how: "Check the URL and channel: minepi.com (whitepaper, roadmap, announcements) and docs.minepi.com are official.",
        example: "A claim about Pi's supply should be checked against the official whitepaper, not a random social post.",
        important:
          "Random blogs, Telegram posts, YouTube videos, and community claims are NOT authoritative sources.",
        questions: [
          {
            topic: "Official sources",
            difficulty: "EASY",
            question: "Which of these is an official Pi Network source?",
            options: [
              "minepi.com (whitepaper, roadmap, announcements)",
              "A random YouTube channel",
              "A Telegram group message",
              "A personal blog",
            ],
            correctIndex: 0,
            explanation:
              "Official Pi information lives on Pi's own channels like minepi.com and docs.minepi.com.",
            sourceId: "website",
          },
          {
            topic: "Official sources",
            difficulty: "MEDIUM",
            question: "A 'fact' about Pi that appears only in a social-media post should be treated as…",
            options: [
              "Unverified — check an official source first",
              "Always true",
              "Always false",
              "A binding Pi policy",
            ],
            correctIndex: 0,
            explanation:
              "Social posts are not authoritative; verify claims against official Pi sources.",
            sourceId: "website",
          },
        ],
      },
    ],
  },
];

// A question's source metadata is looked up from SOURCES at seed time.
export function sourceFor(sourceId: string): SourceRecord {
  const s = SOURCES.find((x) => x.sourceId === sourceId);
  if (!s) throw new Error(`Unknown sourceId: ${sourceId}`);
  return s;
}

export const LAST_CHECKED_AT = LAST_CHECKED;

export type KnowledgeSeedDoc = Doc<"courses">;