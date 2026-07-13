import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    points: v.number(),
    verifier: v.string(),
    maxCompletions: v.number(),
    creatorUserId: v.optional(v.id("users")),
    status: v.string(),
    expiresAt: v.number(),
  }).index("by_status", ["status"]),

  verifications: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    state: v.string(),
    screenshotStorageId: v.optional(v.id("_storage")),
    screenshotPhash: v.optional(v.string()),
    sampled: v.optional(v.boolean()),
    aiConfidence: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    holdUntil: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_state", ["state"]),

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
});
