import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth tables (authAccounts, authSessions, …). `users` is overridden
  // below to add our app fields; the auth-standard optional fields come from
  // extending the Convex Auth user shape.
  ...authTables,

  // Daily check-in streak (plan §7.11b): one row per user.
  streaks: defineTable({
    userId: v.id("users"),
    current: v.number(),        // consecutive-day streak length
    longest: v.number(),
    lastDay: v.number(),        // UTC day number of last check-in
  }).index("by_user", ["userId"]),

  // Daily mystery box (plan §7.11b): one open per day after 3 tasks.
  dailyBoxes: defineTable({
    userId: v.id("users"),
    lastDay: v.number(),        // UTC day number the box was last opened
  }).index("by_user", ["userId"]),

  dailySpins: defineTable({
    userId: v.id("users"),
    windowStart: v.optional(v.number()),
    spinsUsedInWindow: v.optional(v.number()),
    bonusSpins: v.optional(v.number()),
    adBonusEarned: v.optional(v.number()),
    lastDay: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Pi Ad Network rewarded-ad completions (plan §7.9 / Pi Ads). One row per
  // adId so a claimed rewarded ad can never be replayed for another reward.
  adCompletions: defineTable({
    userId: v.id("users"),
    adId: v.string(),
    at: v.number(),
  }).index("by_adId", ["adId"]),

  // Daily task combo (plan §7.11b): follow + telegram join + quiz in one day.
  combos: defineTable({
    userId: v.id("users"),
    lastDay: v.number(),        // UTC day number the combo bonus was claimed
  }).index("by_user", ["userId"]),

  // Sliding-window rate limits (plan §7.9 Layer 5): one row per action attempt.
  rateLimits: defineTable({
    userId: v.id("users"),
    action: v.string(),
    at: v.number(),
  }).index("by_user_action", ["userId", "action"]),

  // Overrides Convex Auth's default users table: standard auth fields (all
  // optional) + our app fields (filled on signup by the Password `profile`).
  users: defineTable({
    // Convex Auth standard fields:
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // App fields:
    accountStatus: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("paused"))),
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    externalUid: v.string(),
    username: v.string(),
    tier: v.number(),
    xp: v.optional(v.number()), // User's total XP for the 12-level progression system
    fraudScore: v.number(),
    deviceFingerprint: v.string(),
    signupIp: v.string(),
    country: v.string(),
    telegramUserId: v.optional(v.string()), // set at Telegram sign-in; used for channel-join checks
    payoutEvm: v.optional(v.string()), // EVM payout address (public only, no keys held)
    payoutSolana: v.optional(v.string()), // Solana payout address
    piWalletAddress: v.optional(v.string()), // Pi blockchain wallet address (public, no keys held)
    referredBy: v.optional(v.id("users")), // set at signup if a referral code was applied
  }).index("by_ecosystem", ["ecosystem"])
    .index("by_externalUid", ["externalUid"])
    .index("email", ["email"]),

  linkedProfiles: defineTable({
    userId: v.id("users"),
    platform: v.string(),
    url: v.string(),
    usernameSnapshot: v.string(),
    verifiedAt: v.number(),
    lockedUntil: v.number(),
    normalizedUrl: v.string(),
  }).index("by_user", ["userId"])
    .index("by_normalizedUrl", ["normalizedUrl"]),

  tasks: defineTable({
    type: v.string(),
    platform: v.string(),
    targetUrl: v.string(),
    name: v.optional(v.string()),        // page/channel handle, e.g. "pinetwork"
    pageId: v.optional(v.string()),      // numeric FB page ID (plan §7.9d)
    points: v.number(),
    xpReward: v.optional(v.number()),    // Optional explicit XP reward for completing this task
    verifier: v.string(),
    maxCompletions: v.number(),
    creatorUserId: v.optional(v.id("users")),
    status: v.string(),
    expiresAt: v.number(),
    // MULTI_TASK bundle: one task = several action steps (JOIN/FOLLOW/SUBSCRIBE/
    // LIKE/COMMENT) on a platform. The user completes every step, then uploads
    // a single proof screenshot for the whole bundle. targetUrl above may be
    // empty for MULTI_TASK; each step carries its own targetUrl.
    steps: v.optional(
      v.array(
        v.object({
          action: v.string(),
          label: v.optional(v.string()),
          name: v.optional(v.string()),
          targetUrl: v.string(),
        }),
      ),
    ),
    // Tier 3 count-delta snapshot (convex/countDelta.ts): last public-count
    // reading + claimed-follow count at that reading, to compute per-run deltas.
    lastCount: v.optional(v.number()),
    lastCountClaims: v.optional(v.number()),
    lastCountAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  verifications: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    platform: v.optional(v.string()),
    state: v.string(),
    screenshotStorageId: v.optional(v.id("_storage")),
    screenshotPhash: v.optional(v.string()),
    sampled: v.optional(v.boolean()),
    aiConfidence: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    holdUntil: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_state", ["state"])
    .index("by_task", ["taskId"]),

  // Two-economy model (plan: ONE verified user, TWO separate economies).
  // `economy` tags every ledger row so the Android economy (private/app PTS)
  // and the Pi-Browser economy (redeemable Pi/Airtime/Data PTS) never mix:
  //   "android"    — private in-app PTS earned via the native app (tasks, quiz,
  //                   spin, surveys, AdMob rewarded ads, …). NOT withdrawable.
  //   "pi-browser" — PTS earned inside the Pi Browser (Pi rewarded ads, Pi
  //                   activities). This is the ONLY economy the Pi/Airtime/Data
  //                   redemption & withdrawal systems may draw from.
  // Balance of each economy = `balanceAfter` of its latest ledger row.
  pointsLedger: defineTable({
    userId: v.id("users"),
    // Optional only so legacy rows (written before the two-economy split) keep
    // validating; every NEW write sets this. Backfill via backfillEconomy().
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"))),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
    balanceAfter: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_economy", ["userId", "economy"])
    .index("by_refId", ["refId"]),

  // App wallet: internal ledger for points, PIPRO, VINTA, and Sidra balances.
  // `pointsBalance` mirrors the ANDROID economy points ledger; the Pi-Browser
  // economy keeps its own balance so the two never mix (one user, two ledgers).
  wallets: defineTable({
    userId: v.id("users"),
    pointsBalance: v.number(),
    piBrowserPointsBalance: v.optional(v.number()), // Pi-Browser economy balance mirror
    piproBalance: v.number(),
    vintaBalance: v.optional(v.number()),
    sidraBalance: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // User withdrawal requests (VINTA token, PIPRO token, Sidra coin)
  withdrawals: defineTable({
    userId: v.id("users"),
    asset: v.string(), // "VINTA" | "PIPRO" | "SIDRA"
    amount: v.number(),
    destinationAddress: v.string(),
    status: v.string(), // "pending" | "processing" | "completed" | "rejected"
    txHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Points-to-Pi withdrawals: A2U (App-to-User) Pi payments. The app sends
  // real Pi from its treasury wallet to the user's linked Pi wallet address
  // in exchange for earned points (plan §7.8 extension).
  // `economy` is ALWAYS "pi-browser" here: Pi cashouts can only spend the
  // Pi-Browser economy ledger, never the Android economy (no cross-redemption).
  piWithdrawals: defineTable({
    userId: v.id("users"),
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"))),
    pointsSpent: v.number(),                      // points deducted from user
    piAmount: v.number(),                          // Pi sent to wallet
    walletAddress: v.string(),                     // destination Pi address
    status: v.string(),                            // "pending" | "processing" | "completed" | "failed"
    paymentId: v.optional(v.string()),             // Pi Platform payment ID
    txid: v.optional(v.string()),                  // blockchain transaction ID
    failureReason: v.optional(v.string()),
    createdAt: v.number(),                         // when the withdrawal was requested
  }).index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // Singleton mutex for Pi A2U payouts. Pi allows only ONE A2U payment in
  // flight at a time (all A2U payments use the developer wallet's sequence
  // number). `expiresAt` lets a crashed worker's slot be reclaimed.
  payoutLocks: defineTable({
    name: v.string(),        // "pi-a2u"
    expiresAt: v.number(),   // epoch ms; stale when < now
  }).index("by_name", ["name"]),

  // Exchange rates (global singleton) for swapping points ↔ pipro
  exchangeRates: defineTable({
    pointsPerPipro: v.number(), // how many points equal one pipro
    updatedAt: v.number(),
  }),

  // Pipro deposit requests: user sends real PIPRO (SPL token) from their
  // external Solana wallet to the platform's deposit address. Backend verifies
  // the on-chain tx and credits the user's app wallet.
  piproDeposits: defineTable({
    userId: v.id("users"),
    txSignature: v.string(),            // Solana transaction signature
    amount: v.number(),                  // pipro tokens received
    fromAddress: v.string(),             // sender's Solana address
    status: v.string(),                  // "pending" | "confirmed" | "failed"
    confirmedAt: v.optional(v.number()), // when the deposit was verified
  }).index("by_user", ["userId"])
    .index("by_txSignature", ["txSignature"]),

  // Full transaction history for the app wallet (swaps, deposits, deductions)
  walletTransactions: defineTable({
    userId: v.id("users"),
    type: v.string(),       // "swap_points_to_pipro" | "swap_pipro_to_points" | "deposit_pipro" | "deduct_points" | "earn_points"
    pointsDelta: v.number(),
    piproDelta: v.number(),
    pointsBalanceAfter: v.number(),
    piproBalanceAfter: v.number(),
    note: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Admin-configurable platform settings (key-value store, changeable from dashboard)
  platformSettings: defineTable({
    key: v.string(),        // e.g. "platformSolanaAddress", "piproMintAddress"
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  providers: defineTable({
    kind: v.union(v.literal("ADS"), v.literal("SURVEY"), v.literal("VAS")),
    name: v.string(),
    platform: v.union(v.literal("pi-web"), v.literal("sidra-mobile"), v.literal("both")),
    configJson: v.string(),
    enabled: v.boolean(),
  }),

  catalog: defineTable({
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    itemType: v.string(),
    name: v.string(),
    pointsPrice: v.optional(v.number()),
    coinPrice: v.optional(v.number()),
    providerSku: v.string(),
    countries: v.array(v.string()),
    enabled: v.boolean(),
  }).index("by_ecosystem", ["ecosystem"]),

  redemptions: defineTable({
    userId: v.id("users"),
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"))),
    catalogId: v.id("catalog"),
    paidWith: v.string(),
    amount: v.number(),
    phoneNumber: v.string(),
    providerRef: v.optional(v.string()),
    status: v.string(),
    paymentId: v.optional(v.string()), // Pi SDK payment id when paidWith === "PI"
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  piDonations: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    memo: v.string(),
    paymentId: v.optional(v.string()),
    txid: v.optional(v.string()),
    status: v.string(), // "pending" | "completed" | "failed" | "cancelled"
    displayName: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_paymentId", ["paymentId"]),

  referrals: defineTable({
    referrerId: v.id("users"),
    refereeId: v.id("users"),
    qualifiedAt: v.optional(v.number()),
    rewarded: v.boolean(),
  }).index("by_referrer", ["referrerId"])
    .index("by_referee", ["refereeId"]),

  fraudEvents: defineTable({
    userId: v.id("users"),
    type: v.string(),
    detailsJson: v.string(),
  }).index("by_user", ["userId"]),

  deviceSignals: defineTable({
    userId: v.id("users"),
    platform: v.union(v.literal("pi-web"), v.literal("sidra-mobile")),
    canvasHash: v.optional(v.string()),
    audioHash: v.optional(v.string()),
    hardwareJson: v.string(),
    ip: v.string(),
    ipFraudScore: v.optional(v.number()),
    vpnDetected: v.optional(v.boolean()),
    timezone: v.string(),
    tzIpMismatch: v.optional(v.boolean()),
  }).index("by_user", ["userId"])
    .index("by_canvasHash", ["canvasHash"]),

  completedTargets: defineTable({
    userId: v.id("users"),
    normalizedUrl: v.string(),
  }).index("by_user_url", ["userId", "normalizedUrl"]),

  platformLimits: defineTable({
    platform: v.string(),
    dailyTaskLimit: v.number(),
    cooldownMinutes: v.number(),
    newProfileFactor: v.number(),
  }),

  quizQuestions: defineTable({
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    explanation: v.string(),
    difficulty: v.number(),
    // Knowledge Center fields (learn-pi.md). All optional so the legacy quiz
    // engine and AI-generated questions keep working unchanged.
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    topic: v.optional(v.string()),
    difficultyLabel: v.optional(
      v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    ),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceDate: v.optional(v.number()),
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
    lastReviewedAt: v.optional(v.number()),
    contentVersion: v.optional(v.number()),
  }).index("by_ecosystem", ["ecosystem"])
    .index("by_course", ["courseId"])
    .index("by_status", ["status"]),

  quizResults: defineTable({
    userId: v.id("users"),
    score: v.number(),
    total: v.number(),
    questionIds: v.array(v.id("quizQuestions")),
  }).index("by_user", ["userId"]),

  // Academy progress (plan §7.11b): one row per level a user has passed.
  // "Sign in with Telegram" one-time nonces. Client creates one, opens the bot
  // deep link; the bot webhook marks it verified with the Telegram user.
  telegramNonces: defineTable({
    nonce: v.string(),
    verified: v.boolean(),
    used: v.boolean(),
    telegramUserId: v.optional(v.string()),
    telegramName: v.optional(v.string()),
    expiresAt: v.number(),
  }).index("by_nonce", ["nonce"]),

  academyProgress: defineTable({
    userId: v.id("users"),
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    level: v.number(),
    passedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ─── Knowledge Center (learn-pi.md) ──────────────────────────────────────
  // 15 official-source-backed Pi courses sharing ONE Course/Lesson/Question
  // architecture and ONE centralized question bank.

  courses: defineTable({
    key: v.string(),       // stable slug, e.g. "pi-tokenomics"
    title: v.string(),     // full title, e.g. "04. Pi Tokenomics"
    shortTitle: v.string(), // nav label, e.g. "Pi Tokenomics"
    description: v.string(),
    sortOrder: v.number(),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("REVIEW"),
      v.literal("PUBLISHED"),
      v.literal("ARCHIVED"),
    ),
    contentVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastReviewedAt: v.number(),
  }).index("by_key", ["key"])
    .index("by_status", ["status"]),

  lessons: defineTable({
    courseId: v.id("courses"),
    lessonNumber: v.number(),
    title: v.string(),
    // learn-pi.md §5 lesson sections.
    what: v.string(),
    why: v.string(),
    how: v.string(),
    example: v.optional(v.string()),
    important: v.optional(v.string()),
    commonMistake: v.optional(v.string()),
    officialSource: v.optional(v.string()),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("REVIEW"),
      v.literal("PUBLISHED"),
      v.literal("ARCHIVED"),
    ),
    contentVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastReviewedAt: v.number(),
  }).index("by_course", ["courseId"])
    .index("by_status", ["status"]),

  sources: defineTable({
    sourceId: v.string(),  // stable id, e.g. "whitepaper-v1"
    title: v.string(),
    officialUrl: v.string(),
    publisher: v.string(), // e.g. "Pi Network Core Team"
    publicationDate: v.optional(v.number()),
    lastChecked: v.number(),
    version: v.optional(v.string()),
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("NEEDS_REVIEW"),
      v.literal("OUTDATED"),
    ),
    courseId: v.optional(v.id("courses")),
    relevantSection: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_sourceId", ["sourceId"]),

  // Simple per-course learning progress (learn-pi.md §23/§24): no reputation
  // system, just lessons completed + best quiz score.
  learningProgress: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    lessonsCompleted: v.array(v.id("lessons")),
    quizBest: v.optional(v.number()),       // best quiz score (0-100)
    questionsAnswered: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_course", ["userId", "courseId"]),

  // Singleton Daily Quiz config (learn-pi.md §8/§9): MIXED or COURSE_OF_THE_DAY,
  // with a configurable distribution and weekday schedule.
  quizSettings: defineTable({
    mode: v.union(v.literal("MIXED"), v.literal("COURSE_OF_THE_DAY")),
    questionsPerQuiz: v.number(),
    distribution: v.array(
      v.object({
        courseKey: v.string(),
        count: v.number(),
      }),
    ),
    schedule: v.array(
      v.object({
        day: v.number(),     // 0 = Sunday .. 6 = Saturday
        courseKey: v.string(), // or "MIXED"
      }),
    ),
    updatedAt: v.number(),
  }),

  bioCodes: defineTable({
    userId: v.id("users"),
    code: v.string(),
    platform: v.string(),
    createdAt: v.number(),
  }).index("by_code", ["code"])
    .index("by_user", ["userId"]),

  marketplaceListings: defineTable({
    userId: v.id("users"),
    taskId: v.id("tasks"),
    platform: v.string(),
    targetUrl: v.string(),
    pageId: v.optional(v.string()),
    pointsReward: v.number(),
    listingFee: v.number(),
    maxCompletions: v.number(),
    completionsSoFar: v.number(),
    status: v.string(),
    expiresAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Public website (apps/website) submissions: contact form + partner requests.
  // Written by unauthenticated visitors via convex/inquiries.ts.
  inquiries: defineTable({
    kind: v.union(v.literal("contact"), v.literal("partner")),
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    platform: v.optional(v.string()), // which ecosystem/ad they're interested in
    message: v.string(),
    status: v.union(
      v.literal("new"),
      v.literal("seen"),
      v.literal("done"),
      v.literal("archived"),
    ),
    ip: v.optional(v.string()), // for spam/abuse triage
  }).index("by_status", ["status"])
    .index("by_kind", ["kind"]),

  // Anonymous website (apps/website) visit analytics, consent-gated by the
  // cookie banner. Written by unauthenticated visitors via convex/visitors.ts;
  // `vid` is the random v2e_vid cookie, never a user id.
  visitorEvents: defineTable({
    vid: v.string(),            // anonymous visitor id (uuid from v2e_vid)
    path: v.string(),           // page path viewed, e.g. "/", "/privacy"
    isNewVisit: v.boolean(),    // true when this page view starts a new visit (>30 min gap)
    visitNumber: v.number(),    // Nth visit for this visitor id
    firstVisitAt: v.number(),   // epoch ms of the visitor's first visit
    referrer: v.optional(v.string()), // document.referrer (may be empty)
    screen: v.optional(v.string()),   // "WxH" viewport from the browser
    lang: v.optional(v.string()),     // navigator.language
  }).index("by_vid", ["vid"])
    .index("by_path", ["path"]),

  // Videos and zero-cost watch-to-earn logs
  videos: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    provider: v.union(v.literal("YOUTUBE"), v.literal("CONVEX"), v.literal("R2")),
    externalId: v.string(),
    videoUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
    durationSeconds: v.number(),
    viewsCount: v.number(),
    rewardPoints: v.number(),
    status: v.union(v.literal("PROCESSING"), v.literal("ACTIVE"), v.literal("BLOCKED")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  videoWatchLogs: defineTable({
    userId: v.id("users"),
    videoId: v.id("videos"),
    watchDurationSeconds: v.number(),
    completed: v.boolean(),
    rewardClaimed: v.boolean(),
    watchedAt: v.number(),
  }).index("by_user_video", ["userId", "videoId"]),

  // Admin-configurable achievements (plan: smart profile). Each row overrides
  // a default achievement (see convex/achievements.ts ACHIEVEMENT_DEFAULTS).
  // `metric` selects what the progress measures; `target` is the threshold.
  achievements: defineTable({
    key: v.string(),
    metric: v.string(),
    target: v.number(),
    icon: v.string(),
    tint: v.string(),
    title: v.string(),
    desc: v.string(),
    enabled: v.boolean(),
    sortOrder: v.number(),
    xpReward: v.optional(v.number()), // Optional XP reward when achievement is claimed
  }).index("by_key", ["key"]),

  // 12-Level User Progression System
  xpTransactions: defineTable({
    userId: v.id("users"),
    source: v.string(), // "LESSON", "COURSE", "QUIZ", "TASK", "ACHIEVEMENT", "STREAK", "OTHER"
    sourceId: v.optional(v.string()), // ID of the specific activity to prevent duplicates
    amount: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_source", ["userId", "source", "sourceId"]),

  levels: defineTable({
    level: v.number(),
    name: v.string(),
    xpRequired: v.number(),
    desc: v.string(),
    icon: v.optional(v.string()),
    enabled: v.boolean(),
  }).index("by_level", ["level"]),

  // One-time Pi linking tokens (plan §7.1 linking flow). The Android app
  // creates a token tied to its own user, passes it to the Pi Browser via the
  // /link URL, and the Pi web app exchanges it + a verified Pi identity to
  // promote that user row to the Pi economy (ecosystem "PI").
  piLinkTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
  }).index("by_token", ["token"])
    .index("by_user", ["userId"]),
});
