import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { recomputeUserScore } from "./fraud";
import { fraudTier } from "@view2earn/core";

// Every admin function requires the shared admin secret (ADMIN_PASSWORD) as a
// `token` arg, checked by requireAdmin below. The Next.js panel gate is UI-only,
// so this is what actually stops direct calls to these endpoints.
// ponytail: shared-secret auth. Upgrade to real per-admin identity
// (ctx.auth + role check via a JWT provider) once one exists — see convex-setup-auth.
function requireAdmin(token: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "admin";
  if (token !== expected) throw new Error("Unauthorized");
}

// Admin panel sign-in. Verifies against the ADMIN_PASSWORD Convex env var
// (set with: npx convex env set ADMIN_PASSWORD <password>). Defaults to
// "admin" until set — change it before exposing the panel.
export const checkPassword = query({
  args: { password: v.string() },
  handler: async (_ctx, { password }) => {
    const expected = process.env.ADMIN_PASSWORD ?? "admin";
    return password === expected;
  },
});

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
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
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

// Analytics for the dashboard. ponytail: full-table scans per load — fine at
// current scale; precompute/roll up if the tables grow large.
export const getAnalytics = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);

    const ledger = await ctx.db.query("pointsLedger").collect();
    let issued = 0;
    let spent = 0;
    for (const e of ledger) {
      if (e.delta >= 0) issued += e.delta;
      else spent += -e.delta;
    }

    const users = await ctx.db.query("users").collect();
    const tiers = { normal: 0, watch: 0, restricted: 0, banned: 0 };
    for (const u of users) tiers[fraudTier(u.fraudScore)]++;

    const DAY = 86400000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const start = todayStart.getTime();
    const newUsersByDay = Array.from({ length: 7 }, (_, i) => {
      const dayStart = start - (6 - i) * DAY;
      return {
        ts: dayStart,
        count: users.filter(
          (u) => u._creationTime >= dayStart && u._creationTime < dayStart + DAY,
        ).length,
      };
    });

    const redemptions = await ctx.db.query("redemptions").collect();
    const redemptionsByStatus: Record<string, number> = {};
    for (const r of redemptions) {
      redemptionsByStatus[r.status] = (redemptionsByStatus[r.status] ?? 0) + 1;
    }

    const fraudEvents = await ctx.db.query("fraudEvents").collect();
    const fraudByType: Record<string, number> = {};
    for (const f of fraudEvents) {
      fraudByType[f.type] = (fraudByType[f.type] ?? 0) + 1;
    }

    return {
      points: { issued, spent, outstanding: issued - spent },
      tiers,
      newUsersByDay,
      redemptionsByStatus,
      fraudByType,
      fraudEventsTotal: fraudEvents.length,
    };
  },
});

// ---------- Users ----------

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("users").order("desc").take(100);
  },
});

export const updateUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    tier: v.optional(v.number()),
    fraudScore: v.optional(v.number()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, { token, userId, ...fields }) => {
    requireAdmin(token);
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(userId, patch);
  },
});

export const deleteUser = mutation({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    requireAdmin(token);
    await ctx.db.delete(userId);
  },
});

// ---------- Tasks ----------

export const listActiveTasks = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("tasks").order("desc").take(100);
  },
});

export const createTask = mutation({
  args: {
    token: v.string(),
    type: v.string(),
    platform: v.string(),
    targetUrl: v.string(),
    pageId: v.optional(v.string()),
    points: v.number(),
    verifier: v.string(),
    maxCompletions: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { token, ...args }) => {
    requireAdmin(token);
    return await ctx.db.insert("tasks", { ...args, status: "active" });
  },
});

export const updateTask = mutation({
  args: {
    token: v.string(),
    taskId: v.id("tasks"),
    type: v.optional(v.string()),
    platform: v.optional(v.string()),
    targetUrl: v.optional(v.string()),
    pageId: v.optional(v.string()),
    points: v.optional(v.number()),
    verifier: v.optional(v.string()),
    maxCompletions: v.optional(v.number()),
    status: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { token, taskId, ...fields }) => {
    requireAdmin(token);
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(taskId, patch);
  },
});

export const deleteTask = mutation({
  args: { token: v.string(), taskId: v.id("tasks") },
  handler: async (ctx, { token, taskId }) => {
    requireAdmin(token);
    await ctx.db.delete(taskId);
  },
});

// ---------- Verifications (review queue) ----------

export const listVerifications = query({
  args: { token: v.string(), state: v.optional(v.string()) },
  handler: async (ctx, { token, state }) => {
    requireAdmin(token);
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
          fraudScore: user?.fraudScore ?? 0,
          fraudTier: fraudTier(user?.fraudScore ?? 0),
          taskLabel: task ? `${task.type} · ${task.platform}` : "deleted task",
          points: task?.points ?? 0,
          screenshotUrl,
        };
      }),
    );
  },
});

export const approveVerification = mutation({
  args: { token: v.string(), verificationId: v.id("verifications") },
  handler: async (ctx, { token, verificationId }) => {
    requireAdmin(token);
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
  args: { token: v.string(), verificationId: v.id("verifications") },
  handler: async (ctx, { token, verificationId }) => {
    requireAdmin(token);
    const verification = await ctx.db.get(verificationId);
    if (!verification) {
      throw new Error("Verification not found");
    }
    if (verification.state === "RELEASED") {
      throw new Error("Already released — use a fraud clawback instead");
    }
    await ctx.db.patch(verificationId, { state: "REJECTED" });
    await recomputeUserScore(ctx, verification.userId);
  },
});

// ---------- Providers ----------

export const listProviders = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("providers").collect();
  },
});

export const createProvider = mutation({
  args: {
    token: v.string(),
    kind: v.union(v.literal("ADS"), v.literal("SURVEY"), v.literal("VAS")),
    name: v.string(),
    platform: v.union(
      v.literal("pi-web"),
      v.literal("sidra-mobile"),
      v.literal("both"),
    ),
    configJson: v.string(),
  },
  handler: async (ctx, { token, ...args }) => {
    requireAdmin(token);
    return await ctx.db.insert("providers", { ...args, enabled: false });
  },
});

export const updateProvider = mutation({
  args: {
    token: v.string(),
    providerId: v.id("providers"),
    name: v.optional(v.string()),
    configJson: v.optional(v.string()),
  },
  handler: async (ctx, { token, providerId, ...fields }) => {
    requireAdmin(token);
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(providerId, patch);
  },
});

export const toggleProvider = mutation({
  args: { token: v.string(), providerId: v.id("providers"), enabled: v.boolean() },
  handler: async (ctx, { token, providerId, enabled }) => {
    requireAdmin(token);
    await ctx.db.patch(providerId, { enabled });
  },
});

export const deleteProvider = mutation({
  args: { token: v.string(), providerId: v.id("providers") },
  handler: async (ctx, { token, providerId }) => {
    requireAdmin(token);
    await ctx.db.delete(providerId);
  },
});

// ---------- Redemptions ----------

export const listRedemptions = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const rows = await ctx.db.query("redemptions").order("desc").take(100);
    return await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          ...r,
          username: user?.username ?? "unknown",
          fraudScore: user?.fraudScore ?? 0,
          fraudTier: fraudTier(user?.fraudScore ?? 0),
        };
      }),
    );
  },
});

export const updateRedemptionStatus = mutation({
  args: { token: v.string(), redemptionId: v.id("redemptions"), status: v.string() },
  handler: async (ctx, { token, redemptionId, status }) => {
    requireAdmin(token);
    await ctx.db.patch(redemptionId, { status });
  },
});

// ---------- Fraud ----------

export const listFraudEvents = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
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
  args: { token: v.string(), userId: v.id("users"), type: v.string(), detailsJson: v.string() },
  handler: async (ctx, { token, ...args }) => {
    requireAdmin(token);
    const id = await ctx.db.insert("fraudEvents", args);
    await recomputeUserScore(ctx, args.userId);
    return id;
  },
});

export const deleteFraudEvent = mutation({
  args: { token: v.string(), eventId: v.id("fraudEvents") },
  handler: async (ctx, { token, eventId }) => {
    requireAdmin(token);
    await ctx.db.delete(eventId);
  },
});
