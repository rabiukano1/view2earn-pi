import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { recomputeUserScore } from "./fraud";
import { fraudTier } from "@view2earn/core";
import { REWARD_KEYS } from "./rewardsConfig";

// Every admin function requires the shared admin secret (ADMIN_PASSWORD) as a
// `token` arg, checked by requireAdmin below. The Next.js panel gate is UI-only,
// so this is what actually stops direct calls to these endpoints.
// ponytail: shared-secret auth. Upgrade to real per-admin identity
// (ctx.auth + role check via a JWT provider) once one exists — see convex-setup-auth.
function requireAdmin(token: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "admin";
  if (token !== expected) throw new Error("Unauthorized");
}

// Derive a short display name (page/channel handle) from a target URL when the
// task has no explicit `name`, e.g. "https://t.me/pinetwork" -> "pinetwork".
function targetNameFromUrl(url: string): string {
  const clean = url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/^t\.me\//, "")
    .replace(/^facebook\.com\//, "")
    .replace(/^tiktok\.com\/@?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  return clean.replace(/^@/, "");
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

// Admin credit / debit points directly to user balance
export const adjustPoints = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    delta: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, userId, delta, reason }) => {
    requireAdmin(token);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.runMutation(internal.points.creditHelper, {
      userId,
      delta,
      reason: reason || (delta >= 0 ? "ADMIN_CREDIT" : "ADMIN_DEBIT"),
      refId: `admin:${Date.now()}`,
    });

    return { ok: true };
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
    name: v.optional(v.string()),
    pageId: v.optional(v.string()),
    points: v.number(),
    verifier: v.string(),
    maxCompletions: v.number(),
    expiresAt: v.number(),
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
    name: v.optional(v.string()),
    pageId: v.optional(v.string()),
    points: v.optional(v.number()),
    verifier: v.optional(v.string()),
    maxCompletions: v.optional(v.number()),
    status: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
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
          taskName: task?.name || targetNameFromUrl(task?.targetUrl ?? "") || task?.targetUrl || "",
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

    if (verification.screenshotStorageId) {
      try {
        await ctx.storage.delete(verification.screenshotStorageId);
      } catch (e) {
        console.error("Storage purge error on reject:", e);
      }
    }

    await ctx.db.patch(verificationId, { state: "REJECTED", screenshotStorageId: undefined });
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
    const id = await ctx.db.insert("providers", { ...args, enabled: true });

    if (args.kind === "ADS" && args.configJson) {
      try {
        const parsed = JSON.parse(args.configJson);
        if (parsed.rewardPoints !== undefined) {
          const val = String(parsed.rewardPoints);
          const setting = await ctx.db
            .query("platformSettings")
            .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
            .unique();
          if (setting) {
            await ctx.db.patch(setting._id, { value: val, updatedAt: Date.now() });
          } else {
            await ctx.db.insert("platformSettings", { key: "adRewardPoints", value: val, updatedAt: Date.now() });
          }
        }
      } catch {}
    }
    return id;
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

    if (fields.configJson) {
      try {
        const parsed = JSON.parse(fields.configJson);
        if (parsed.rewardPoints !== undefined) {
          const val = String(parsed.rewardPoints);
          const setting = await ctx.db
            .query("platformSettings")
            .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
            .unique();
          if (setting) {
            await ctx.db.patch(setting._id, { value: val, updatedAt: Date.now() });
          } else {
            await ctx.db.insert("platformSettings", { key: "adRewardPoints", value: val, updatedAt: Date.now() });
          }
        }
      } catch {}
    }
  },
});

export const toggleProvider = mutation({
  args: { token: v.string(), providerId: v.id("providers"), enabled: v.boolean() },
  handler: async (ctx, { token, providerId, enabled }) => {
    requireAdmin(token);
    await ctx.db.patch(providerId, { enabled });

    const provider = await ctx.db.get(providerId);
    if (provider?.kind === "ADS" && provider.configJson) {
      try {
        const parsed = JSON.parse(provider.configJson);
        if (parsed.rewardPoints !== undefined) {
          const val = String(parsed.rewardPoints);
          const setting = await ctx.db
            .query("platformSettings")
            .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
            .unique();
          if (setting) {
            await ctx.db.patch(setting._id, { value: val, updatedAt: Date.now() });
          } else {
            await ctx.db.insert("platformSettings", { key: "adRewardPoints", value: val, updatedAt: Date.now() });
          }
        }
      } catch {}
    }
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

// Admin: Set reward points for watching ads (global setting + optional provider update)
export const setAdRewardPoints = mutation({
  args: {
    token: v.string(),
    rewardPoints: v.number(),
    providerId: v.optional(v.id("providers")),
  },
  handler: async (ctx, { token, rewardPoints, providerId }) => {
    requireAdmin(token);
    if (rewardPoints < 0) throw new Error("Reward points cannot be negative");

    // 1. Update platformSettings key "adRewardPoints"
    const existing = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: String(rewardPoints), updatedAt: Date.now() });
    } else {
      await ctx.db.insert("platformSettings", { key: "adRewardPoints", value: String(rewardPoints), updatedAt: Date.now() });
    }

    // 2. If providerId passed, update its configJson
    if (providerId) {
      const provider = await ctx.db.get(providerId);
      if (provider) {
        let config = {} as Record<string, any>;
        if (provider.configJson) {
          try { config = JSON.parse(provider.configJson); } catch {}
        }
        config.rewardPoints = rewardPoints;
        await ctx.db.patch(providerId, { configJson: JSON.stringify(config) });
      }
    }

    // 3. Also patch any existing ADS providers to stay in sync
    const adsProviders = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("kind"), "ADS"))
      .collect();

    for (const p of adsProviders) {
      let config = {} as Record<string, any>;
      if (p.configJson) {
        try { config = JSON.parse(p.configJson); } catch {}
      }
      config.rewardPoints = rewardPoints;
      await ctx.db.patch(p._id, { configJson: JSON.stringify(config) });
    }
  },
});

export const setProviderRewardPoints = mutation({
  args: { token: v.string(), providerId: v.id("providers"), rewardPoints: v.number() },
  handler: async (ctx, { token, providerId, rewardPoints }) => {
    requireAdmin(token);
    const provider = await ctx.db.get(providerId);
    if (!provider) throw new Error("Provider not found");
    let config = {} as Record<string, any>;
    if (provider.configJson) {
      try { config = JSON.parse(provider.configJson); } catch {}
    }
    config.rewardPoints = rewardPoints;
    await ctx.db.patch(providerId, { configJson: JSON.stringify(config) });

    // Also sync to platformSettings
    const existing = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "adRewardPoints"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: String(rewardPoints), updatedAt: Date.now() });
    } else {
      await ctx.db.insert("platformSettings", { key: "adRewardPoints", value: String(rewardPoints), updatedAt: Date.now() });
    }
  },
});

// ========== Wallet & Pipro Admin ==========

/** Set the global exchange rate: how many points equal 1 pipro. */
export const setExchangeRate = mutation({
  args: { token: v.string(), pointsPerPipro: v.number() },
  handler: async (ctx, { token, pointsPerPipro }) => {
    requireAdmin(token);
    if (pointsPerPipro <= 0) throw new Error("Rate must be positive");
    // Upsert: replace any existing row (singleton pattern)
    const existing = await ctx.db.query("exchangeRates").first();
    if (existing) {
      await ctx.db.patch(existing._id, { pointsPerPipro, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("exchangeRates", { pointsPerPipro, updatedAt: Date.now() });
    }
  },
});

/** Get current exchange rate for admin dashboard display. */
export const getExchangeRate = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const rate = await ctx.db.query("exchangeRates").first();
    return rate ?? null;
  },
});

/** Set or update a platform setting (key-value). Used for platformSolanaAddress etc. */
export const setPlatformSetting = mutation({
  args: { token: v.string(), key: v.string(), value: v.string() },
  handler: async (ctx, { token, key, value }) => {
    requireAdmin(token);
    const existing = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("platformSettings", { key, value, updatedAt: Date.now() });
    }
  },
});

/** Get all platform settings for admin dashboard. */
export const getPlatformSettings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.db.query("platformSettings").collect();
  },
});

/** Get all reward settings with their current values and defaults. */
export const getRewardSettings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const all = await ctx.db.query("platformSettings").collect();
    const result: Record<string, { value: string; defaultValue: string }> = {};

    for (const key of Object.keys(REWARD_KEYS)) {
      const setting = all.find((s) => s.key === key);
      result[key] = {
        value: setting?.value ?? REWARD_KEYS[key as keyof typeof REWARD_KEYS],
        defaultValue: REWARD_KEYS[key as keyof typeof REWARD_KEYS],
      };
    }
    return result;
  },
});

/** Update one or more reward settings. */
export const setRewardSettings = mutation({
  args: { token: v.string(), settings: v.record(v.string(), v.string()) },
  handler: async (ctx, { token, settings }) => {
    requireAdmin(token);
    for (const [key, value] of Object.entries(settings)) {
      const existing = await ctx.db
        .query("platformSettings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
      } else {
        await ctx.db.insert("platformSettings", { key, value, updatedAt: Date.now() });
      }
    }
  },
});

/** Super admin: manually adjust a user's wallet balance (for support, corrections). */
export const adminAdjustWallet = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    pointsDelta: v.number(),
    piproDelta: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { token, userId, pointsDelta, piproDelta, reason }) => {
    requireAdmin(token);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Get or create wallet
    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!wallet) {
      const id = await ctx.db.insert("wallets", {
        userId,
        pointsBalance: 0,
        piproBalance: 0,
      });
      wallet = (await ctx.db.get(id))!;
    }

    const newPoints = wallet.pointsBalance + pointsDelta;
    const newPipro = wallet.piproBalance + piproDelta;
    if (newPoints < 0) throw new Error("Would result in negative points balance");
    if (newPipro < 0) throw new Error("Would result in negative pipro balance");

    await ctx.db.patch(wallet._id, {
      pointsBalance: newPoints,
      piproBalance: newPipro,
    });

    await ctx.db.insert("walletTransactions", {
      userId,
      type: "admin_adjust",
      pointsDelta,
      piproDelta,
      pointsBalanceAfter: newPoints,
      piproBalanceAfter: newPipro,
      note: `Admin: ${reason}`,
    });

    return { pointsBalance: newPoints, piproBalance: newPipro };
  },
});

/** List pending pipro deposits for admin review. */
export const listPendingDeposits = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const deposits = await ctx.db.query("piproDeposits").order("desc").take(100);
    return await Promise.all(
      deposits.map(async (d) => {
        const user = await ctx.db.get(d.userId);
        return { ...d, username: user?.username ?? "unknown" };
      }),
    );
  },
});

/** Admin manually approve a deposit (when auto-verification isn't available). */
export const adminApproveDeposit = mutation({
  args: { token: v.string(), depositId: v.id("piproDeposits"), amount: v.number() },
  handler: async (ctx, { token, depositId, amount }) => {
    requireAdmin(token);
    if (amount <= 0) throw new Error("Amount must be positive");

    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status === "confirmed") throw new Error("Already confirmed");

    await ctx.db.patch(depositId, {
      status: "confirmed",
      amount,
      confirmedAt: Date.now(),
    });

    // Credit wallet
    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", deposit.userId))
      .unique();
    if (!wallet) {
      const id = await ctx.db.insert("wallets", {
        userId: deposit.userId,
        pointsBalance: 0,
        piproBalance: 0,
      });
      wallet = (await ctx.db.get(id))!;
    }

    const newPipro = wallet.piproBalance + amount;
    await ctx.db.patch(wallet._id, { piproBalance: newPipro });

    await ctx.db.insert("walletTransactions", {
      userId: deposit.userId,
      type: "deposit_pipro",
      pointsDelta: 0,
      piproDelta: amount,
      pointsBalanceAfter: wallet.pointsBalance,
      piproBalanceAfter: newPipro,
      note: `Deposit approved: ${amount} PIPRO (tx: ${deposit.txSignature.slice(0, 12)}…)`,
    });
  },
});

/** Admin manually reject a deposit. */
export const adminRejectDeposit = mutation({
  args: { token: v.string(), depositId: v.id("piproDeposits") },
  handler: async (ctx, { token, depositId }) => {
    requireAdmin(token);
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    await ctx.db.patch(depositId, { status: "failed" });
  },
});

/** Admin: Set platform limits (daily task limit, cooldown minutes) for a social platform. */
export const updatePlatformLimit = mutation({
  args: {
    token: v.string(),
    platform: v.string(),
    dailyTaskLimit: v.optional(v.number()),
    cooldownMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { token, platform, dailyTaskLimit, cooldownMinutes }) => {
    requireAdmin(token);
    const existing = await ctx.db.query("platformLimits").collect();
    const target = existing.find((l) => l.platform === platform);

    const patch: Record<string, any> = {};
    if (dailyTaskLimit !== undefined) patch.dailyTaskLimit = dailyTaskLimit;
    if (cooldownMinutes !== undefined) patch.cooldownMinutes = cooldownMinutes;

    if (target) {
      await ctx.db.patch(target._id, patch);
    } else {
      await ctx.db.insert("platformLimits", {
        platform,
        dailyTaskLimit: dailyTaskLimit ?? 50,
        cooldownMinutes: cooldownMinutes ?? 0,
        newProfileFactor: 1.0,
      });
    }
  },
});
