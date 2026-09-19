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
    // One record per surface. Legacy rows (undefined) are adopted by the
    // user's home economy on first use (spin.ts getSpinRecord).
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"))),
    windowStart: v.optional(v.number()),
    spinsUsedInWindow: v.optional(v.number()),
    bonusSpins: v.optional(v.number()),
    adBonusEarned: v.optional(v.number()),
    lastDay: v.optional(v.number()),
    // Accumulating spin credits: `balance` = unused spins; `lastChargeSlot` =
    // epoch ms of the last top-up slot we credited. Every spinWindowHours the
    // account is topped up by `spinsPerWindow` (no daily reset).
    balance: v.optional(v.number()),
    lastChargeSlot: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_user_economy", ["userId", "economy"]),

  // Pending spin results — spin() reserves a prize without crediting points;
  // claimSpin() credits only after the wheel animation finishes.
  pendingSpins: defineTable({
    userId: v.id("users"),
    pts: v.number(),
    prizeIndex: v.number(),
    claimed: v.boolean(),
    createdAt: v.number(),
    // Legacy optional flag: set by an earlier revision of the 2x flow. Kept so
    // rows written while it existed still validate. No longer written by code.
    doubled: v.optional(v.boolean()),
    // True once the BASE wheel points have been credited to the ledger.
    // spin() credits base points immediately (so points can never be orphaned
    // if the client never calls claimSpin); claimSpin() then only credits the
    // 2x EXTRA on double, or marks the row claimed. Absent on rows written
    // before this change — treated as "not yet credited".
    baseCredited: v.optional(v.boolean()),
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
    accountStatus: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("paused"), v.literal("merged"))),
    mergedInto: v.optional(v.id("users")), // set when this row was linked into another account
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
    // Surface (economy) of the sign-in currently being created. Written by the
    // auth providers / beforeSessionCreation in the SAME transaction that
    // inserts the authSessions row, so session._creationTime === pendingSurfaceAt
    // identifies which surface a session belongs to (see lib/guards.ts).
    pendingSurface: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"), v.literal("wallet"))),
    pendingSurfaceAt: v.optional(v.number()),
    payoutEvm: v.optional(v.string()), // EVM payout address (public only, no keys held)
    payoutSolana: v.optional(v.string()), // Solana payout address
    piWalletAddress: v.optional(v.string()), // Pi blockchain wallet address (public, no keys held)
    piUsername: v.optional(v.string()), // Pi Network username, set only from a Pi.authenticate() verified server-side
    referredBy: v.optional(v.id("users")), // set at signup if a referral code was applied
  }).index("by_ecosystem", ["ecosystem"])
    .index("by_externalUid", ["externalUid"])
    .index("by_telegramUserId", ["telegramUserId"])
    .index("email", ["email"])
    .index("by_payoutEvm", ["payoutEvm"]),

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
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"))), // set at claim; paid into on release
    state: v.string(),
    screenshotStorageId: v.optional(v.id("_storage")),
    additionalScreenshots: v.optional(v.array(v.id("_storage"))),
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
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"), v.literal("wallet"))),
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
    amount: v.number(), // amount of `asset` to pay out on-chain
    destinationAddress: v.string(),
    status: v.string(), // "pending" | "processing" | "completed" | "rejected"
    txHash: v.optional(v.string()),
    // SIDRA payouts are funded from POINTS at request time (SIDRA is never a
    // stored balance) — the rate and points taken are locked here for audit.
    pointsDebited: v.optional(v.number()),
    pointsPerSidra: v.optional(v.number()),
    // Withdrawal fee (admin-set %) taken from the payout: pay out `netAmount`.
    feePercent: v.optional(v.number()),
    feeAmount: v.optional(v.number()),
    netAmount: v.optional(v.number()),
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
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"))),
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

  // Real Sidra Chain (EVM) deposits of the native SIDRA coin to the platform
  // address. SIDRA is never held as a balance: once verified on-chain the
  // deposit is converted to POINTS at that moment's pointsPerSidra rate, so
  // the platform carries no floating SIDRA liability users could time.
  // Attributed to the user whose registered payoutEvm address SENT it — never
  // to whoever submits the hash — and each tx hash is credited at most once.
  sidraDeposits: defineTable({
    userId: v.id("users"),
    txHash: v.string(),                  // 0x-prefixed 32-byte tx hash (lowercase)
    fromAddress: v.string(),             // sender EVM address (lowercase)
    amount: v.number(),                  // SIDRA received on-chain (filled on confirm)
    pointsPerSidra: v.optional(v.number()), // rate locked at confirmation
    pointsCredited: v.optional(v.number()), // amount × rate, floored
    status: v.string(),                  // "pending" | "confirmed" | "failed"
    source: v.string(),                  // "manual" (user pasted hash) | "scan" (poller found it)
    failReason: v.optional(v.string()),
    blockNumber: v.optional(v.number()),
    attempts: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_txHash", ["txHash"])
    .index("by_status", ["status"]),

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
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Per-user/per-level feature toggles. Overrides global platformSettings
  // feature flags for specific users or user levels.
  featureToggles: defineTable({
    userId: v.optional(v.id("users")),
    level: v.optional(v.number()),
    featureKey: v.string(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_featureKey", ["featureKey"])
    .index("by_userId_featureKey", ["userId", "featureKey"])
    .index("by_level_featureKey", ["level", "featureKey"]),

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
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"))),
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

  pointDonations: defineTable({
    userId: v.id("users"),
    points: v.number(),
    memo: v.string(),
    displayName: v.optional(v.string()),
  }).index("by_user", ["userId"]),

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
    // Bilingual Hausa Support
    questionHa: v.optional(v.string()),
    optionsHa: v.optional(v.array(v.string())),
    explanationHa: v.optional(v.string()),
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
  // Adsgram (Telegram Mini App ads) server-side REWARD postbacks, keyed by the
  // Telegram user id Adsgram substitutes into the Reward URL. Audit trail for
  // the client-side `done` grants; not yet consumed by reward mutations.
  adsgramRewards: defineTable({
    telegramUserId: v.string(),
    at: v.number(),
  }).index("by_telegramUserId", ["telegramUserId"]),

  // One row per auth session: which app surface (economy) the session runs on.
  // Bound lazily on the session's first mutation (lib/guards.ts).
  // 6-digit codes for linking surfaces (Pi <-> Telegram) without a foreign
  // login: generated on one surface by the target user, redeemed on the other.
  linkCodes: defineTable({
    code: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_code", ["code"]),

  sessionSurfaces: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    surface: v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"), v.literal("wallet")),
  }).index("by_session", ["sessionId"]),

  telegramNonces: defineTable({
    nonce: v.string(),
    verified: v.boolean(),
    used: v.boolean(),
    telegramUserId: v.optional(v.string()),
    telegramName: v.optional(v.string()),
    expiresAt: v.number(),
  }).index("by_nonce", ["nonce"]),

  // "Sign in with View2Earn" handoff for the companion wallet app. The wallet
  // creates a nonce and deep-links into the main app; the signed-in main app
  // binds its user to the nonce (approve); the wallet then exchanges the
  // nonce for a session via the "wallet-handoff" auth provider. Single-use.
  walletAuthNonces: defineTable({
    nonce: v.string(),
    approved: v.boolean(),
    used: v.boolean(),
    userId: v.optional(v.id("users")),
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
    platformFee: v.optional(v.number()), // promote fee charged on top of the budget (not refunded)
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

  // One row per rewarded AD that actually paid out (AdMob / Pi Ads), written
  // at the payout site so it can't be spoofed by a client. Admin reporting
  // only — never surfaced to users.
  adWatchLogs: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("rewarded"), v.literal("spin_double"), v.literal("spin_bonus")),
    provider: v.string(),   // ad unit / network id as reported by the client, or "pi-ads"
    points: v.number(),     // points the ad earned (0 for a bonus spin)
    economy: v.string(),
    at: v.number(),
  }).index("by_user", ["userId"]).index("by_at", ["at"]),

  videoWatchLogs: defineTable({
    userId: v.id("users"),
    videoId: v.id("videos"),
    watchDurationSeconds: v.number(),
    completed: v.boolean(),
    rewardClaimed: v.boolean(),
    watchedAt: v.number(),
  }).index("by_user_video", ["userId", "videoId"]),

  // Admin-managed IPTV live-stream channels (football/sports). Admin can add,
  // pause, or remove channels from the dashboard and they appear in the Android
  // live TV screen instantly (Convex reactive query) — no app rebuild/release.
  iptvChannels: defineTable({
    name: v.string(),
    logo: v.optional(v.string()),
    country: v.optional(v.string()),
    category: v.union(
      v.literal("Football"),
      v.literal("Sports"),
      v.literal("News"),
      v.literal("Entertainment"),
    ),
    // Which screen this stream belongs to: football/IPTV, YouTube, or other
    // live streams. Auto-classified from the URL on create unless overridden.
    type: v.optional(
      v.union(v.literal("football"), v.literal("youtube"), v.literal("other"), v.literal("movies")),
    ),
    streamUrl: v.string(),
    backupStreamUrls: v.optional(v.array(v.string())),
    quality: v.optional(v.string()), // e.g. "1080p HD", "720p HD", "SD"
    currentMatch: v.optional(v.string()), // short subtitle shown under the name
    // Legacy (no longer read or written): kept optional so old rows still validate.
    httpReferrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    // "active" == visible/playable in the app; "paused" == hidden but kept.
    status: v.union(v.literal("active"), v.literal("paused")),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_order", ["status", "sortOrder"]),

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
