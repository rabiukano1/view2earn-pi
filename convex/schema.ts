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
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    externalUid: v.string(),
    username: v.string(),
    tier: v.number(),
    fraudScore: v.number(),
    deviceFingerprint: v.string(),
    signupIp: v.string(),
    country: v.string(),
    telegramUserId: v.optional(v.string()), // set at Telegram sign-in; used for channel-join checks
    payoutEvm: v.optional(v.string()), // EVM payout address (public only, no keys held)
    payoutSolana: v.optional(v.string()), // Solana payout address
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

  pointsLedger: defineTable({
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
    balanceAfter: v.number(),
  }).index("by_user", ["userId"]).index("by_refId", ["refId"]),

  // App wallet: internal ledger for points, PIPRO, VINTA, and Sidra balances
  wallets: defineTable({
    userId: v.id("users"),
    pointsBalance: v.number(),
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
    catalogId: v.id("catalog"),
    paidWith: v.string(),
    amount: v.number(),
    phoneNumber: v.string(),
    providerRef: v.optional(v.string()),
    status: v.string(),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

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
  }).index("by_ecosystem", ["ecosystem"]),

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
});
