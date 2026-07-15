import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    lastDay: v.number(),        // UTC day number the wheel was last spun
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

  users: defineTable({
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    externalUid: v.string(),
    username: v.string(),
    tier: v.number(),
    fraudScore: v.number(),
    deviceFingerprint: v.string(),
    signupIp: v.string(),
    country: v.string(),
  }).index("by_ecosystem", ["ecosystem"])
    .index("by_externalUid", ["externalUid"]),

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
    pageId: v.optional(v.string()),      // numeric FB page ID (plan §7.9d)
    points: v.number(),
    verifier: v.string(),
    maxCompletions: v.number(),
    creatorUserId: v.optional(v.id("users")),
    status: v.string(),
    expiresAt: v.number(),
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
  }).index("by_user", ["userId"]),

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
  }).index("by_referrer", ["referrerId"]),

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
  // Web3 wallet sign-in nonces (plan §7.1). One pending nonce per address; the
  // wallet signs `message`, the server verifies the signature over it.
  walletNonces: defineTable({
    address: v.string(), // lowercased 0x…
    message: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_address", ["address"]),

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
});
