// Section 6 schema — View2Earn Master Plan v2.4
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    externalUid: v.string(),             // Pi UID / Sidra ID — UNIQUE, one
                                         // account per KYC'd identity (Layer 1)
    username: v.string(),
    tier: v.number(),                    // 0 basic, 1 email, 2 phone
    fraudScore: v.number(),
    deviceFingerprint: v.string(),
    signupIp: v.string(),
    country: v.string(),
  }).index("by_ecosystem", ["ecosystem"])
    .index("by_externalUid", ["externalUid"]),   // enforce uniqueness

  linkedProfiles: defineTable({
    userId: v.id("users"),
    platform: v.string(),                // "tiktok" | "facebook" | "telegram"
    url: v.string(),
    usernameSnapshot: v.string(),
    verifiedAt: v.number(),
    lockedUntil: v.number(),             // 30-day lock
    normalizedUrl: v.string(),           // GLOBALLY unique — one profile,
                                         // one account, forever (Layer 1)
  }).index("by_user", ["userId"])
    .index("by_normalizedUrl", ["normalizedUrl"]),

  tasks: defineTable({
    type: v.string(),                    // FOLLOW_PAGE | JOIN_CHANNEL | QUIZ | SURVEY
    platform: v.string(),
    targetUrl: v.string(),
    points: v.number(),
    verifier: v.string(),                // "screenshot-ai" | "telegram-bot" | ...
    maxCompletions: v.number(),
    creatorUserId: v.optional(v.id("users")),  // marketplace tasks
    status: v.string(),
    expiresAt: v.number(),
  }).index("by_status", ["status"]),

  verifications: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    state: v.string(),                   // state machine states
    screenshotStorageId: v.optional(v.id("_storage")),  // purged after 14d
    screenshotPhash: v.optional(v.string()),             // kept forever (dedup/audit)
    sampled: v.optional(v.boolean()),                    // was AI actually run?
    aiConfidence: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    holdUntil: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_state", ["state"]),

  pointsLedger: defineTable({            // APPEND-ONLY, never edit
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
    configJson: v.string(),              // appId, bannerId, keys...
    enabled: v.boolean(),
  }),

  catalog: defineTable({                 // data/airtime bundles
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    itemType: v.string(),                // "DATA" | "AIRTIME"
    name: v.string(),                    // "1GB Data", "500 Airtime"
    pointsPrice: v.optional(v.number()), // redeem with points
    coinPrice: v.optional(v.number()),   // buy with real Pi / Sidra
    providerSku: v.string(),             // VAS provider bundle ID
    countries: v.array(v.string()),
    enabled: v.boolean(),
  }).index("by_ecosystem", ["ecosystem"]),

  redemptions: defineTable({
    userId: v.id("users"),
    catalogId: v.id("catalog"),
    paidWith: v.string(),                // "POINTS" | "PI" | "SIDRA"
    amount: v.number(),
    phoneNumber: v.string(),             // verified number topped up
    providerRef: v.optional(v.string()),
    status: v.string(),                  // processing | fulfilled | failed | refunded
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

  deviceSignals: defineTable({           // Layer 2 + 3 signals per session
    userId: v.id("users"),
    platform: v.string(),                // "pi-web" | "sidra-mobile"
    canvasHash: v.optional(v.string()),  // web: canvas/WebGL fingerprint
    audioHash: v.optional(v.string()),
    hardwareJson: v.string(),            // model, screen, sensors, GAID(native)
    ip: v.string(),
    ipFraudScore: v.optional(v.number()),
    vpnDetected: v.optional(v.boolean()),
    timezone: v.string(),
    tzIpMismatch: v.optional(v.boolean()),
  }).index("by_user", ["userId"])
    .index("by_canvasHash", ["canvasHash"]),

  completedTargets: defineTable({        // feed dedup by target URL
    userId: v.id("users"),
    normalizedUrl: v.string(),
  }).index("by_user_url", ["userId", "normalizedUrl"]),

  platformLimits: defineTable({          // admin-configurable follow caps
    platform: v.string(),
    dailyTaskLimit: v.number(),
    cooldownMinutes: v.number(),
    newProfileFactor: v.number(),        // e.g. 0.5 for young profiles
  }),
});
