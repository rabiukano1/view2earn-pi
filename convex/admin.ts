import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

// TODO(prod): every function here must require an authenticated admin
// (ctx.auth + role check) before the panel is exposed anywhere.

const VERIFICATION_STATES = [
  "USER_CLAIMED_DONE",
  "PROOF_SUBMITTED",
  "ADMIN_REVIEW",
  "PENDING_HOLD",
  "RELEASED",
  "REJECTED",
  "CANCELLED",
] as const;

// TODO(prod): 48h hold, same as verifications.ts.
const HOLD_MS = 60 * 1000;

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const users = await ctx.db.query("users").collect();
    const redemptions = await ctx.db.query("redemptions").collect();

    const stateCounts: Record<string, number> = {};
    for (const state of VERIFICATION_STATES) {
      const rows = await ctx.db
        .query("verifications")
        .withIndex("by_state", (q) => q.eq("state", state))
        .collect();
      stateCounts[state] = rows.length;
    }

    const recentLedger = await ctx.db.query("pointsLedger").order("desc").take(8);
    const ledgerUsers = new Map<string, string>();
    for (const entry of recentLedger) {
      if (!ledgerUsers.has(entry.userId)) {
        const user = await ctx.db.get(entry.userId);
        ledgerUsers.set(entry.userId, user?.username ?? "unknown");
      }
    }

    return {
      activeTasks: tasks.length,
      pendingReview: stateCounts.ADMIN_REVIEW ?? 0,
      totalUsers: users.length,
      redemptions: redemptions.length,
      stateCounts,
      recentActivity: recentLedger.map((entry) => ({
        _id: entry._id,
        at: entry._creationTime,
        username: ledgerUsers.get(entry.userId) ?? "unknown",
        delta: entry.delta,
        reason: entry.reason,
        balanceAfter: entry.balanceAfter,
      })),
    };
  },
});

// ---------- Users ----------

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").order("desc").take(100);
  },
});

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    tier: v.optional(v.number()),
    fraudScore: v.optional(v.number()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...fields }) => {
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(userId, patch);
  },
});

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.delete(userId);
  },
});

// ---------- Tasks ----------

export const listActiveTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").take(100);
  },
});

export const createTask = mutation({
  args: {
    type: v.string(),
    platform: v.string(),
    targetUrl: v.string(),
    points: v.number(),
    verifier: v.string(),
    maxCompletions: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", { ...args, status: "active" });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    type: v.optional(v.string()),
    platform: v.optional(v.string()),
    targetUrl: v.optional(v.string()),
    points: v.optional(v.number()),
    verifier: v.optional(v.string()),
    maxCompletions: v.optional(v.number()),
    status: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { taskId, ...fields }) => {
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(taskId, patch);
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    await ctx.db.delete(taskId);
  },
});

// ---------- Verifications (review queue) ----------

export const listVerifications = query({
  args: { state: v.optional(v.string()) },
  handler: async (ctx, { state }) => {
    const rows = state
      ? await ctx.db
          .query("verifications")
          .withIndex("by_state", (q) => q.eq("state", state))
          .order("desc")
          .take(100)
      : await ctx.db.query("verifications").order("desc").take(100);

    return await Promise.all(
      rows.map(async (row) => {
        const [user, task, screenshotUrl] = await Promise.all([
          ctx.db.get(row.userId),
          ctx.db.get(row.taskId),
          row.screenshotStorageId
            ? ctx.storage.getUrl(row.screenshotStorageId)
            : Promise.resolve(null),
        ]);
        return {
          _id: row._id,
          _creationTime: row._creationTime,
          state: row.state,
          aiConfidence: row.aiConfidence,
          username: user?.username ?? "unknown",
          taskLabel: task ? `${task.type} · ${task.platform}` : "deleted task",
          points: task?.points ?? 0,
          screenshotUrl,
        };
      }),
    );
  },
});

export const approveVerification = mutation({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    const verification = await ctx.db.get(verificationId);
    if (!verification) {
      throw new Error("Verification not found");
    }
    if (
      verification.state !== "ADMIN_REVIEW" &&
      verification.state !== "PROOF_SUBMITTED"
    ) {
      throw new Error(`Cannot approve from state ${verification.state}`);
    }
    const holdUntil = Date.now() + HOLD_MS;
    await ctx.db.patch(verificationId, { state: "PENDING_HOLD", holdUntil });
    await ctx.scheduler.runAt(holdUntil, internal.verifications.release, {
      verificationId,
    });
  },
});

export const rejectVerification = mutation({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    const verification = await ctx.db.get(verificationId);
    if (!verification) {
      throw new Error("Verification not found");
    }
    if (verification.state === "RELEASED") {
      throw new Error("Already released — use a fraud clawback instead");
    }
    await ctx.db.patch(verificationId, { state: "REJECTED" });
  },
});

// ---------- Providers ----------

export const listProviders = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("providers").collect();
  },
});

export const createProvider = mutation({
  args: {
    kind: v.union(v.literal("ADS"), v.literal("SURVEY"), v.literal("VAS")),
    name: v.string(),
    platform: v.union(
      v.literal("pi-web"),
      v.literal("sidra-mobile"),
      v.literal("both"),
    ),
    configJson: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("providers", { ...args, enabled: false });
  },
});

export const updateProvider = mutation({
  args: {
    providerId: v.id("providers"),
    name: v.optional(v.string()),
    configJson: v.optional(v.string()),
  },
  handler: async (ctx, { providerId, ...fields }) => {
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(providerId, patch);
  },
});

export const toggleProvider = mutation({
  args: { providerId: v.id("providers"), enabled: v.boolean() },
  handler: async (ctx, { providerId, enabled }) => {
    await ctx.db.patch(providerId, { enabled });
  },
});

export const deleteProvider = mutation({
  args: { providerId: v.id("providers") },
  handler: async (ctx, { providerId }) => {
    await ctx.db.delete(providerId);
  },
});

// ---------- Redemptions ----------

export const listRedemptions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("redemptions").order("desc").take(100);
  },
});

export const updateRedemptionStatus = mutation({
  args: { redemptionId: v.id("redemptions"), status: v.string() },
  handler: async (ctx, { redemptionId, status }) => {
    await ctx.db.patch(redemptionId, { status });
  },
});

// ---------- Fraud ----------

export const listFraudEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("fraudEvents").order("desc").take(100);
    return await Promise.all(
      events.map(async (event) => {
        const user = await ctx.db.get(event.userId);
        return { ...event, username: user?.username ?? "unknown" };
      }),
    );
  },
});

export const createFraudEvent = mutation({
  args: { userId: v.id("users"), type: v.string(), detailsJson: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("fraudEvents", args);
  },
});

export const deleteFraudEvent = mutation({
  args: { eventId: v.id("fraudEvents") },
  handler: async (ctx, { eventId }) => {
    await ctx.db.delete(eventId);
  },
});
