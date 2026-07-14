import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { enforceRateLimit } from "./lib/ratelimit";

// Task Verification State Machine (plan §5):
// CREATED → USER_CLAIMED_DONE → PROOF_SUBMITTED
//   → AI_APPROVED / AI_UNCERTAIN(→ADMIN_REVIEW) / AI_REJECTED(→REJECTED)
//   → PENDING_HOLD (48h) → RELEASED | CANCELLED

// TODO(prod): 48h per plan. Short hold in dev so the full flow is testable.
const HOLD_MS = 60 * 1000;
const AI_APPROVE_THRESHOLD = 0.85;
const AI_REJECT_THRESHOLD = 0.4;

// Trust-based sampling (plan §4 Stage 4): new users are 100% verified; trusted
// users are randomly sampled and otherwise auto-approved into the hold; any
// recent fraud or a high score forces 100% verification again.
const NEW_USER_TASKS = 10;      // first N completions: always verify
const SAMPLE_RATE = 0.4;        // trusted users: verify ~40% of the time
const HIGH_FRAUD_SCORE = 50;
const FRAUD_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// Decide whether to actually run AI verification on this screenshot, or trust
// the user and auto-approve into the hold.
async function shouldVerify(ctx: any, userId: string): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (user && user.fraudScore >= HIGH_FRAUD_SCORE) return true;

  const mine = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const completions = mine.filter((v: any) => v.state === "RELEASED").length;
  if (completions < NEW_USER_TASKS) return true;

  const cutoff = Date.now() - FRAUD_LOOKBACK_MS;
  const fraud = await ctx.db
    .query("fraudEvents")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  if (fraud.some((f: any) => f._creationTime >= cutoff)) return true;

  return Math.random() < SAMPLE_RATE;
}

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// NOTE(dev): takes userId directly until Sidra auth lands; after auth this
// must derive the user from ctx.auth (never trust a client-sent userId).
async function checkPlatformLimit(
  ctx: any,
  userId: string,
  platform: string,
): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = todayStart.getTime();

  const mine = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const samePlatform = mine.filter((v: any) => {
    if (v.state === "CANCELLED" || v.state === "REJECTED") return false;
    if (v.platform !== platform) return false;
    return v._creationTime >= since;
  });

  const limits = await ctx.db.query("platformLimits").collect();
  const cfg = (limits as any[]).find((l: any) => l.platform === platform);
  const dailyLimit = cfg?.dailyTaskLimit ?? 15;
  const cooldownMin = cfg?.cooldownMinutes ?? 3;

  if (samePlatform.length >= dailyLimit) {
    throw new Error(`Daily ${platform} limit reached (${dailyLimit}). Try again tomorrow.`);
  }

  if (samePlatform.length > 0) {
    const last = (samePlatform as any[]).sort((a: any, b: any) => b._creationTime - a._creationTime)[0];
    const elapsed = Date.now() - last._creationTime;
    const cooldownMs = cooldownMin * 60 * 1000;
    if (elapsed < cooldownMs) {
      const wait = Math.ceil((cooldownMs - elapsed) / 1000 / 60);
      throw new Error(`Please wait ${wait} min before next ${platform} task.`);
    }
  }
}

export const claim = mutation({
  args: { taskId: v.id("tasks"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, args.userId, "claim");
    const task = await ctx.db.get(args.taskId);
    if (!task || task.status !== "active") {
      throw new Error("Task is not available");
    }
    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existing = mine.find((m) => m.taskId === args.taskId);
    if (existing && existing.state !== "REJECTED") {
      throw new Error("Task already claimed");
    }
    if (task.platform && task.platform !== "app") {
      await checkPlatformLimit(ctx, args.userId, task.platform);
    }
    return await ctx.db.insert("verifications", {
      taskId: args.taskId,
      userId: args.userId,
      platform: task.platform,
      state: "USER_CLAIMED_DONE",
    });
  },
});

// Telegram JOIN_CHANNEL verification (plan §7.3 / Tier 4): no screenshot —
// the bot confirms membership. Transitions to PROOF_SUBMITTED, then the
// telegram check (env-aware; dev-mocked) approves or rejects.
export const verifyTelegram = mutation({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    const verification = await ctx.db.get(verificationId);
    if (!verification) throw new Error("Verification not found");
    if (
      verification.state !== "USER_CLAIMED_DONE" &&
      verification.state !== "REJECTED"
    ) {
      throw new Error(`Cannot verify from state ${verification.state}`);
    }
    await ctx.db.patch(verificationId, { state: "PROOF_SUBMITTED" });
    await ctx.scheduler.runAfter(0, internal.telegram.check, { verificationId });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitProof = mutation({
  args: {
    verificationId: v.id("verifications"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) {
      throw new Error("Verification not found");
    }
    if (
      verification.state !== "USER_CLAIMED_DONE" &&
      verification.state !== "REJECTED"
    ) {
      throw new Error(`Cannot submit proof from state ${verification.state}`);
    }
    await enforceRateLimit(ctx, verification.userId, "upload");
    await ctx.db.patch(args.verificationId, {
      state: "PROOF_SUBMITTED",
      screenshotStorageId: args.storageId,
    });

    if (await shouldVerify(ctx, verification.userId)) {
      // Run AI vision (sampled = true set in applyAiResult).
      await ctx.scheduler.runAfter(0, internal.verifications.aiCheck, {
        verificationId: args.verificationId,
      });
    } else {
      // Trusted user, not sampled — auto-approve straight into the hold.
      const holdUntil = Date.now() + HOLD_MS;
      await ctx.db.patch(args.verificationId, {
        state: "PENDING_HOLD",
        sampled: false,
        holdUntil,
      });
      await ctx.scheduler.runAt(holdUntil, internal.verifications.release, {
        verificationId: args.verificationId,
      });
    }
  },
});

// Tier 1 screenshot check. TODO(prod): pHash dedup, then cheap-model-first
// AI vision (plan §4 Tier 1). Mocked as approve until the vision key is set.
export const aiCheck = internalAction({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, args) => {
    const confidence = 0.92; // mock — replace with vision API result
    await ctx.runMutation(internal.verifications.applyAiResult, {
      verificationId: args.verificationId,
      confidence,
    });
  },
});

export const applyAiResult = internalMutation({
  args: { verificationId: v.id("verifications"), confidence: v.number() },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification || verification.state !== "PROOF_SUBMITTED") {
      return;
    }
    if (args.confidence < AI_REJECT_THRESHOLD) {
      await ctx.db.patch(args.verificationId, {
        state: "REJECTED",
        sampled: true,
        aiConfidence: args.confidence,
      });
      return;
    }
    if (args.confidence < AI_APPROVE_THRESHOLD) {
      await ctx.db.patch(args.verificationId, {
        state: "ADMIN_REVIEW",
        sampled: true,
        aiConfidence: args.confidence,
      });
      return;
    }
    const holdUntil = Date.now() + HOLD_MS;
    await ctx.db.patch(args.verificationId, {
      state: "PENDING_HOLD",
      sampled: true,
      aiConfidence: args.confidence,
      holdUntil,
    });
    await ctx.scheduler.runAt(holdUntil, internal.verifications.release, {
      verificationId: args.verificationId,
    });
  },
});

export const release = internalMutation({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification || verification.state !== "PENDING_HOLD") {
      return;
    }
    const task = await ctx.db.get(verification.taskId);
    if (!task) {
      return;
    }
    await ctx.db.patch(args.verificationId, { state: "RELEASED" });
    await ctx.runMutation(internal.points.creditHelper, {
      userId: verification.userId,
      delta: task.points,
      reason: "TASK_COMPLETED",
      refId: verification.taskId,
    });
    if (task.targetUrl) {
      await ctx.db.insert("completedTargets", {
        userId: verification.userId,
        normalizedUrl: normalizeUrl(task.targetUrl),
      });
    }
    const listing = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("taskId"), verification.taskId))
      .first();
    if (listing) {
      const updated = listing.completionsSoFar + 1;
      await ctx.db.patch(listing._id, { completionsSoFar: updated });
      if (updated >= listing.maxCompletions) {
        await ctx.db.patch(listing._id, { status: "completed" });
        await ctx.db.patch(task._id, { status: "expired" });
      }
    }
  },
});

export const purgeOldScreenshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_state", (q) => q.eq("state", "RELEASED"))
      .collect();

    for (const v of verifications) {
      if (v._creationTime < cutoff && v.screenshotStorageId) {
        await ctx.storage.delete(v.screenshotStorageId);
        await ctx.db.patch(v._id, { screenshotStorageId: undefined });
      }
    }
  },
});

// My verification per task, for the feed UI.
export const listMine = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return mine.map((m) => ({
      _id: m._id,
      taskId: m.taskId,
      state: m.state,
      holdUntil: m.holdUntil,
    }));
  },
});
