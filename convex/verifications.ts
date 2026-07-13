import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Task Verification State Machine (plan §5):
// CREATED → USER_CLAIMED_DONE → PROOF_SUBMITTED
//   → AI_APPROVED / AI_UNCERTAIN(→ADMIN_REVIEW) / AI_REJECTED(→REJECTED)
//   → PENDING_HOLD (48h) → RELEASED | CANCELLED

// TODO(prod): 48h per plan. Short hold in dev so the full flow is testable.
const HOLD_MS = 60 * 1000;
const AI_APPROVE_THRESHOLD = 0.85;
const AI_REJECT_THRESHOLD = 0.4;

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// NOTE(dev): takes userId directly until Sidra auth lands; after auth this
// must derive the user from ctx.auth (never trust a client-sent userId).
export const claim = mutation({
  args: { taskId: v.id("tasks"), userId: v.id("users") },
  handler: async (ctx, args) => {
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
    return await ctx.db.insert("verifications", {
      taskId: args.taskId,
      userId: args.userId,
      state: "USER_CLAIMED_DONE",
    });
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
    await ctx.db.patch(args.verificationId, {
      state: "PROOF_SUBMITTED",
      screenshotStorageId: args.storageId,
    });
    await ctx.scheduler.runAfter(0, internal.verifications.aiCheck, {
      verificationId: args.verificationId,
    });
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
