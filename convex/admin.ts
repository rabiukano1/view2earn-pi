import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { recomputeUserScore } from "./fraud";
import { fraudTier } from "@view2earn/core";
import { REWARD_KEYS, getNum } from "./rewardsConfig";
import { creditAnchorDeposit } from "./anchorDb";
import { deriveEconomy } from "./lib/guards";
import { adminAdjustSpins } from "./spin";
import { economyOfUser, appendLedger, lastBalance, POINTS_ISSUED_KEY, POINTS_SPENT_KEY } from "./lib/ledger";

// Every admin function requires the shared admin secret (ADMIN_PASSWORD) as a
// `token` arg, checked by requireAdmin below. The Next.js panel gate is UI-only,
// so this is what actually stops direct calls to these endpoints.
// ponytail: shared-secret auth. Upgrade to real per-admin identity
// (ctx.auth + role check via a JWT provider) once one exists — see convex-setup-auth.
export function requireAdmin(token: string) {
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

    // All-time point totals come from running counters (lib/ledger.ts), not a
    // replay of pointsLedger — that scan exceeded Convex's 32k-doc query limit.
    const settings = await ctx.db.query("platformSettings").collect();
    const totalOf = (key: string) => Number(settings.find((s) => s.key === key)?.value ?? 0) || 0;
    const issued = totalOf(POINTS_ISSUED_KEY);
    const spent = totalOf(POINTS_SPENT_KEY);

    // Newest first and capped: with redemptions + fraudEvents also reading 5000
    // each, this keeps the whole query well inside Convex's 32k-document limit.
    // The 7-day chart below stays exact (newest users are always included).
    // ponytail: tier counts cover the newest 15k users; make them counters
    // maintained in recomputeUserScore if the table grows past that.
    const users = await ctx.db.query("users").order("desc").take(15000);
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

    // Bounded like fraudEvents: this only feeds a status breakdown chart.
    // ponytail: most recent 5000; move to a counter if you need all-time exact.
    const redemptions = await ctx.db.query("redemptions").order("desc").take(5000);
    const redemptionsByStatus: Record<string, number> = {};
    for (const r of redemptions) {
      redemptionsByStatus[r.status] = (redemptionsByStatus[r.status] ?? 0) + 1;
    }

    // Bounded: fraudEvents grows without limit and is only charted by type.
    const fraudEvents = await ctx.db.query("fraudEvents").order("desc").take(5000);
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

/**
 * One-time seed of the point totals from the existing ledger. Pages through
 * pointsLedger a chunk at a time so no single execution hits the 32k-document
 * limit, then overwrites both counters.
 * Run once: npx convex run admin:backfillPointsTotals '{"token":"<ADMIN_PASSWORD>"}'
 */
export const backfillPointsTotals = mutation({
  args: { token: v.string(), cursor: v.optional(v.string()), issued: v.optional(v.number()), spent: v.optional(v.number()) },
  handler: async (ctx, { token, cursor, issued = 0, spent = 0 }): Promise<{
    done: boolean;
    issued: number;
    spent: number;
    cursor: string | null;
  }> => {
    requireAdmin(token);
    const page = await ctx.db
      .query("pointsLedger")
      .paginate({ cursor: cursor ?? null, numItems: 5000 });

    let nextIssued = issued;
    let nextSpent = spent;
    for (const e of page.page) {
      if (e.delta >= 0) nextIssued += e.delta;
      else nextSpent += -e.delta;
    }

    if (page.isDone) {
      for (const [key, value] of [
        [POINTS_ISSUED_KEY, nextIssued],
        [POINTS_SPENT_KEY, nextSpent],
      ] as const) {
        const row = await ctx.db
          .query("platformSettings")
          .filter((q) => q.eq(q.field("key"), key))
          .first();
        if (row) await ctx.db.patch(row._id, { value: String(value), updatedAt: Date.now() });
        else await ctx.db.insert("platformSettings", { key, value: String(value), updatedAt: Date.now() });
      }
    }
    return { done: page.isDone, issued: nextIssued, spent: nextSpent, cursor: page.continueCursor };
  },
});

/**
 * Runs backfillPointsTotals to completion so the caller does not have to pass
 * the cursor back by hand. Each page is its own mutation, so no single
 * execution hits the document limit.
 * npx convex run admin:backfillPointsTotalsAll '{"token":"<ADMIN_PASSWORD>"}'
 */
export const backfillPointsTotalsAll = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{ pages: number; issued: number; spent: number }> => {
    let cursor: string | null = null;
    let issued = 0;
    let spent = 0;
    for (let pages = 1; pages <= 500; pages++) {
      const r: { done: boolean; issued: number; spent: number; cursor: string | null } = await ctx.runMutation(
        api.admin.backfillPointsTotals,
        { token, cursor: cursor ?? undefined, issued, spent },
      );
      issued = r.issued;
      spent = r.spent;
      cursor = r.cursor;
      if (r.done) return { pages, issued, spent };
    }
    throw new Error("Ledger is larger than 500 pages — raise the page cap and rerun");
  },
});

// ---------- Users ----------

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    // ponytail: full scan (Convex caps a query at 16k docs / 8 MB); switch to
    // paginate() + server-side search when the user table nears that.
    const users = await ctx.db.query("users").order("desc").collect();
    // Balances are per-economy, so an adjustment aimed at the wrong one is
    // invisible to the user. The panel needs to know where each user lives.
    return users.map((u) => ({ ...u, economy: deriveEconomy(u) }));
  },
});

export const updateUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    tier: v.optional(v.number()),
    fraudScore: v.optional(v.number()),
    country: v.optional(v.string()),
    accountStatus: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("paused"))),
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
    economy: v.optional(v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"), v.literal("wallet"))),
  },
  handler: async (ctx, { token, userId, delta, reason, economy }) => {
    requireAdmin(token);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Wallet pool (what the wallet app spends/withdraws from). appendLedger
    // refuses to go negative; the history row makes it visible to the user.
    if (economy === "wallet") {
      const note = reason || (delta >= 0 ? "ADMIN_CREDIT" : "ADMIN_DEBIT");
      const after = await appendLedger(ctx, userId, "wallet", delta, note, `admin:${Date.now()}`);
      await ctx.db.insert("walletTransactions", {
        userId,
        type: "admin_adjust",
        pointsDelta: delta,
        piproDelta: 0,
        pointsBalanceAfter: after,
        piproBalanceAfter: 0,
        note: `Admin: ${note}`,
      });
      return { ok: true };
    }

    await ctx.runMutation(internal.points.creditHelper, {
      userId,
      economy: economy ?? (await economyOfUser(ctx, userId)),
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
    // A state filter is a work queue → show everything in it; "All" stays capped.
    const rows = state
      ? await ctx.db
          .query("verifications")
          .withIndex("by_state", (q) => q.eq("state", state))
          .order("desc")
          .collect()
      : await ctx.db.query("verifications").order("desc").take(300);

    return await Promise.all(
      rows.map(async (row) => {
        const [user, task, screenshotUrl, additionalScreenshotsUrls] = await Promise.all([
          ctx.db.get(row.userId),
          ctx.db.get(row.taskId),
          row.screenshotStorageId
            ? ctx.storage.getUrl(row.screenshotStorageId)
            : Promise.resolve(null),
          row.additionalScreenshots && row.additionalScreenshots.length > 0
            ? Promise.all(row.additionalScreenshots.map(id => ctx.storage.getUrl(id)))
            : Promise.resolve([]),
        ]);
        return {
          _id: row._id,
          _creationTime: row._creationTime,
          state: row.state,
          aiConfidence: row.aiConfidence,
          username: user?.username ?? "unknown",
          fraudScore: user?.fraudScore ?? 0,
          fraudTier: fraudTier(user?.fraudScore ?? 0),
          platform: task?.platform ?? "OTHER",
          taskLabel: task ? `${task.type} · ${task.platform}` : "deleted task",
          taskName: task?.name || targetNameFromUrl(task?.targetUrl ?? "") || task?.targetUrl || "",
          points: task?.points ?? 0,
          screenshotUrl,
          additionalScreenshotsUrls: additionalScreenshotsUrls.filter(Boolean),
        };
      }),
    );
  },
});

async function approveOne(ctx: MutationCtx, verificationId: Id<"verifications">) {
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
}

export const approveVerification = mutation({
  args: { token: v.string(), verificationId: v.id("verifications") },
  handler: async (ctx, { token, verificationId }) => {
    requireAdmin(token);
    await approveOne(ctx, verificationId);
  },
});

// Approve / reject a whole batch (e.g. every pending proof for one platform).
// Rows that are no longer actionable are skipped, not fatal.
export const bulkVerifications = mutation({
  args: {
    token: v.string(),
    verificationIds: v.array(v.id("verifications")),
    action: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, { token, verificationIds, action }) => {
    requireAdmin(token);
    let done = 0;
    let skipped = 0;
    for (const id of verificationIds) {
      try {
        if (action === "approve") await approveOne(ctx, id);
        else await rejectOne(ctx, id);
        done += 1;
      } catch {
        skipped += 1;
      }
    }
    return { done, skipped };
  },
});

export const rejectVerification = mutation({
  args: { token: v.string(), verificationId: v.id("verifications") },
  handler: async (ctx, { token, verificationId }) => {
    requireAdmin(token);
    await rejectOne(ctx, verificationId);
  },
});

async function rejectOne(ctx: MutationCtx, verificationId: Id<"verifications">) {
  {
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
    if (verification.additionalScreenshots) {
      for (const storageId of verification.additionalScreenshots) {
        try {
          await ctx.storage.delete(storageId);
        } catch (e) {
          console.error("Storage purge error for additional screenshot on reject:", e);
        }
      }
    }

    await ctx.db.patch(verificationId, { state: "REJECTED", screenshotStorageId: undefined, additionalScreenshots: undefined });
    await recomputeUserScore(ctx, verification.userId);
  }
}

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

// Fraud accounts: users with at least one fraud event, newest signal first.
export const listFraudAccounts = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const events = await ctx.db.query("fraudEvents").order("desc").take(500);
    const byUser = new Map<string, { count: number; lastType: string; lastAt: number }>();
    for (const e of events) {
      const cur = byUser.get(e.userId);
      if (cur) cur.count++;
      else byUser.set(e.userId, { count: 1, lastType: e.type, lastAt: e._creationTime });
    }
    const rows = [];
    for (const [userId, agg] of byUser) {
      const u = await ctx.db.get(userId as Id<"users">);
      if (!u) continue;
      rows.push({
        userId: u._id,
        username: u.username,
        email: u.email ?? null,
        accountStatus: u.accountStatus ?? "active",
        fraudScore: u.fraudScore,
        fraudTier: fraudTier(u.fraudScore),
        ...agg,
      });
    }
    return rows.sort((a, b) => b.lastAt - a.lastAt);
  },
});

// Everything an admin needs on one flagged account: the account, every fraud
// event, and — for each identity it tried to link — the account that owns it
// plus every other account that tried the same identity.
export const getFraudAccount = query({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    requireAdmin(token);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const summarize = async (id: Id<"users">) => {
      const u = await ctx.db.get(id);
      if (!u) return null;
      const logins = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", id))
        .collect();
      return {
        userId: u._id,
        username: u.username,
        email: u.email ?? null,
        country: u.country,
        accountStatus: u.accountStatus ?? "active",
        fraudScore: u.fraudScore,
        fraudTier: fraudTier(u.fraudScore),
        externalUid: u.externalUid,
        telegramUserId: u.telegramUserId ?? null,
        piUsername: u.piUsername ?? null,
        signupIp: u.signupIp,
        deviceFingerprint: u.deviceFingerprint,
        createdAt: u._creationTime,
        logins: logins.map((a) => a.provider),
      };
    };

    const events = await ctx.db
      .query("fraudEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const identities = new Set<string>();
    for (const e of events) {
      try {
        const d = JSON.parse(e.detailsJson) as { identity?: string };
        if (d.identity) identities.add(d.identity);
      } catch {}
    }

    const allEvents = identities.size ? await ctx.db.query("fraudEvents").order("desc").take(2000) : [];
    const linkedWith = [];
    for (const identity of identities) {
      const [kind, id] = identity.split(":");
      const owner =
        kind === "pi"
          ? await ctx.db.query("users").withIndex("by_externalUid", (q) => q.eq("externalUid", identity)).first()
          : await ctx.db.query("users").withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", id)).first();
      const attemptIds = new Set<string>();
      for (const e of allEvents) {
        if (e.userId === userId) continue;
        try {
          const d = JSON.parse(e.detailsJson) as { identity?: string };
          if (d.identity === identity) attemptIds.add(e.userId);
        } catch {}
      }
      const attempts = [];
      for (const id2 of attemptIds) {
        const sum = await summarize(id2 as Id<"users">);
        if (sum) attempts.push(sum);
      }
      linkedWith.push({
        identity,
        owner: owner ? await summarize(owner._id) : null,
        otherAttempts: attempts,
      });
    }

    return { account: await summarize(userId), events, linkedWith };
  },
});

// ─── Ad watches (admin only — never exposed to users) ────────────────────────

/** Every rewarded-ad payout, newest first. Capped at 2000. */
export const listAdWatches = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const logs = await ctx.db.query("adWatchLogs").withIndex("by_at").order("desc").take(2000);
    const names = new Map<string, string>();
    const out = [];
    for (const l of logs) {
      if (!names.has(l.userId)) names.set(l.userId, (await ctx.db.get(l.userId))?.username ?? "unknown");
      out.push({ ...l, username: names.get(l.userId)! });
    }
    return out;
  },
});

/** One page of ad watch logs, trimmed to what the leaderboard needs. */
export const adWatchLogPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const res = await ctx.db.query("adWatchLogs").paginate({ cursor, numItems: 4000 });
    return {
      rows: res.page.map((l) => ({ userId: l.userId, kind: l.kind, points: l.points })),
      isDone: res.isDone,
      cursor: res.continueCursor,
    };
  },
});

export const usernamesFor = internalQuery({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, { ids }) =>
    Promise.all(ids.map(async (id) => (await ctx.db.get(id))?.username ?? "unknown")),
});

type AdWatchAgg = { watches: number; rewarded: number; spinDouble: number; spinBonus: number; points: number };

/**
 * Leaderboard: top ad watchers, plus totals by kind. An action, not a query:
 * a single query can't read the whole log table any more, and a reactive one
 * re-ran on every ad watched. Reads it page by page, on demand.
 */
export const adWatchLeaderboard = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<{
    total: number;
    totalPoints: number;
    byKind: { rewarded: number; spin_double: number; spin_bonus: number };
    topUsers: ({ userId: Id<"users">; username: string } & AdWatchAgg)[];
  }> => {
    requireAdmin(token);
    const byUser = new Map<Id<"users">, AdWatchAgg>();
    const byKind = { rewarded: 0, spin_double: 0, spin_bonus: 0 };
    let total = 0, totalPoints = 0;
    let cursor: string | null = null;
    for (;;) {
      const page: { rows: { userId: Id<"users">; kind: "rewarded" | "spin_double" | "spin_bonus"; points: number }[]; isDone: boolean; cursor: string } =
        await ctx.runQuery(internal.admin.adWatchLogPage, { cursor });
      for (const l of page.rows) {
        const u = byUser.get(l.userId) ?? { watches: 0, rewarded: 0, spinDouble: 0, spinBonus: 0, points: 0 };
        u.watches++; u.points += l.points;
        if (l.kind === "rewarded") u.rewarded++;
        else if (l.kind === "spin_double") u.spinDouble++;
        else u.spinBonus++;
        byUser.set(l.userId, u);
        byKind[l.kind]++;
        totalPoints += l.points;
        total++;
      }
      if (page.isDone) break;
      cursor = page.cursor;
    }
    const sorted = [...byUser].sort((a, b) => b[1].watches - a[1].watches || b[1].points - a[1].points);
    const topUsers: ({ userId: Id<"users">; username: string } & AdWatchAgg)[] = [];
    for (let i = 0; i < sorted.length; i += 500) {
      const chunk = sorted.slice(i, i + 500);
      const names: string[] = await ctx.runQuery(internal.admin.usernamesFor, { ids: chunk.map(([id]) => id) });
      chunk.forEach(([userId, agg], k) => topUsers.push({ userId, username: names[k], ...agg }));
    }
    return { total, totalPoints, byKind, topUsers };
  },
});

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
      // Per-app overrides (rewardsConfig.getSetting): "" = use the global value.
      for (const eco of ["android", "pi-browser", "telegram"]) {
        const scoped = all.find((s) => s.key === `${key}@${eco}`);
        result[`${key}@${eco}`] = { value: scoped?.value ?? "", defaultValue: "" };
      }
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

/** Admin: List all user-submitted marketplace listings awaiting approval. */
export const listPendingListings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const listings = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_status", (q) => q.eq("status", "pending_approval"))
      .collect();
    return Promise.all(
      listings.map(async (l) => {
        const creator = await ctx.db.get(l.userId);
        return {
          ...l,
          username: creator?.username ?? creator?.name ?? "unknown",
        };
      }),
    );
  },
});

/** Admin: Approve a user-submitted listing so it goes live to app users. */
export const approveListing = mutation({
  args: { token: v.string(), listingId: v.id("marketplaceListings") },
  handler: async (ctx, { token, listingId }) => {
    requireAdmin(token);
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found");
    await ctx.db.patch(listingId, { status: "active" });
    if (listing.taskId) {
      await ctx.db.patch(listing.taskId, { status: "active" });
    }
  },
});

/** Admin: Reject a user-submitted listing and refund the points fee to the creator. */
export const rejectListing = mutation({
  args: { token: v.string(), listingId: v.id("marketplaceListings"), reason: v.optional(v.string()) },
  handler: async (ctx, { token, listingId, reason }) => {
    requireAdmin(token);
    const listing = await ctx.db.get(listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.status === "rejected" || listing.status === "cancelled") return;

    await ctx.db.patch(listingId, { status: "rejected" });
    if (listing.taskId) {
      await ctx.db.patch(listing.taskId, { status: "expired" });
    }

    // Refund listing fee back to user
    const unused = listing.maxCompletions - listing.completionsSoFar;
    const refund = unused * listing.pointsReward;
    if (refund > 0) {
      await appendLedger(
        ctx,
        listing.userId,
        await economyOfUser(ctx, listing.userId),
        refund,
        "MARKETPLACE_REFUND",
        listingId,
      );
    }
  },
});

// ─── Deposits (all sources, newest first) ───────────────────────────────────

export const listDeposits = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const [anchor, sidra, pipro, pi] = await Promise.all([
      ctx.db.query("anchorDeposits").order("desc").take(100),
      ctx.db.query("sidraDeposits").order("desc").take(100),
      ctx.db.query("piproDeposits").order("desc").take(100),
      ctx.db.query("piDonations").order("desc").take(200),
    ]);
    const rows = [
      ...anchor.map((d) => ({ _id: d._id, source: "Anchor", userId: d.userId, asset: d.assetCode, amount: d.amount, credited: `${d.pointsCredited} PTS`, status: d.status, ref: d.memo !== undefined ? `memo ${d.memo} · ${d.txHash}` : d.txHash, at: d._creationTime })),
      ...sidra.map((d) => ({ _id: d._id, source: "SIDRA", userId: d.userId, asset: "SIDRA", amount: d.amount, credited: `${d.pointsCredited ?? 0} PTS`, status: d.status, ref: d.txHash, at: d._creationTime })),
      ...pipro.map((d) => ({ _id: d._id, source: "PIPRO", userId: d.userId, asset: "PIPRO", amount: d.amount, credited: `${d.amount} PIPRO`, status: d.status, ref: d.txSignature, at: d._creationTime })),
      ...pi.filter((d) => d.deposit).map((d) => ({ _id: d._id, source: "Pi", userId: d.userId, asset: "PI", amount: d.amount, credited: "Pi credit", status: d.status, ref: d.txid ?? d.paymentId ?? "", at: d._creationTime })),
    ].sort((a, b) => b.at - a.at).slice(0, 200);
    return await Promise.all(rows.map(async (r) => {
      const user = r.userId ? await ctx.db.get(r.userId) : null;
      return { ...r, username: user ? (user.username ?? user.name ?? "—") : null };
    }));
  },
});

/** Give an "unmatched" anchor deposit (no/wrong memo) to a user, at today's rate. */
export const assignAnchorDeposit = mutation({
  args: { token: v.string(), depositId: v.id("anchorDeposits"), username: v.string() },
  handler: async (ctx, { token, depositId, username }) => {
    requireAdmin(token);
    const d = await ctx.db.get(depositId);
    if (!d || d.status !== "unmatched") throw new Error("Only unmatched deposits can be assigned");
    const user = await ctx.db.query("users").filter((q) => q.eq(q.field("username"), username.trim())).first();
    if (!user) throw new Error(`No user named "${username}"`);
    const points = Math.floor(d.amount * (await getNum(ctx, "anchorPointsPerUnit")));
    if (points <= 0) throw new Error("Set 'Points per 1 anchor asset' first");
    await ctx.db.patch(depositId, { userId: user._id, pointsCredited: points, status: "credited" });
    await creditAnchorDeposit(ctx, user._id, d.opId, d.txHash, d.amount, d.assetCode, points);
  },
});

// ─── Bulk point adjustments (Users page: selected users, or everyone) ───────

const adjustEconomy = v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"), v.literal("wallet"));
type AdjustEconomy = "android" | "pi-browser" | "telegram" | "wallet";

const adjustKind = v.union(v.literal("points"), v.literal("spins"));
type AdjustKind = "points" | "spins";

// Deductions take at most what the user has, so one low balance never blocks
// a batch. Returns the delta actually applied (0 = nothing to do).
async function adjustOne(ctx: MutationCtx, kind: AdjustKind, userId: Id<"users">, economy: AdjustEconomy, delta: number, reason: string, ref: string) {
  if (kind === "spins") {
    if (economy === "wallet") throw new Error("The wallet has no spins. Pick Android, Pi Browser or Telegram.");
    return adminAdjustSpins(ctx, userId, economy, delta);
  }
  const applied = delta < 0 ? -Math.min(await lastBalance(ctx, userId, economy), -delta) : delta;
  if (applied === 0) return 0;
  const after = await appendLedger(ctx, userId, economy, applied, reason, ref);
  if (economy === "wallet") {
    await ctx.db.insert("walletTransactions", {
      userId, type: "admin_adjust", pointsDelta: applied, piproDelta: 0,
      pointsBalanceAfter: after, piproBalanceAfter: 0, note: `Admin: ${reason}`,
    });
  }
  return applied;
}

function checkDelta(delta: number) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Enter a whole, non-zero number");
}

/** Add/deduct spins for one user on one app. */
export const adjustSpins = mutation({
  args: { token: v.string(), userId: v.id("users"), economy: v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram")), delta: v.number() },
  handler: async (ctx, { token, userId, economy, delta }) => {
    requireAdmin(token);
    checkDelta(delta);
    const applied = await adminAdjustSpins(ctx, userId, economy, delta);
    if (!applied) throw new Error("This user has no spins to remove on that app");
    return { applied };
  },
});

/** Add/deduct points for a hand-picked set of users (max 500 per call). */
export const adjustPointsBulk = mutation({
  args: { token: v.string(), kind: adjustKind, userIds: v.array(v.id("users")), economy: adjustEconomy, delta: v.number(), reason: v.string() },
  handler: async (ctx, { token, kind, userIds, economy, delta, reason }) => {
    requireAdmin(token);
    checkDelta(delta);
    if (userIds.length > 500) throw new Error("Select at most 500 users at a time, or use 'All users'");
    const ref = `admin-bulk:${Date.now()}`;
    let changed = 0;
    for (const id of userIds) if (await adjustOne(ctx, kind, id, economy, delta, reason || "ADMIN_BULK", ref)) changed++;
    return { changed, ref };
  },
});

/** Add/deduct points for EVERY user who uses that app. Runs in background
 *  batches of 200 (one mutation can't touch the whole user table). */
export const adjustPointsAll = mutation({
  args: { token: v.string(), kind: adjustKind, economy: adjustEconomy, delta: v.number(), reason: v.string() },
  handler: async (ctx, { token, kind, economy, delta, reason }) => {
    requireAdmin(token);
    checkDelta(delta);
    if (kind === "spins" && economy === "wallet") throw new Error("The wallet has no spins. Pick Android, Pi Browser or Telegram.");
    const ref = `admin-all:${Date.now()}`;
    await ctx.scheduler.runAfter(0, internal.admin.adjustPointsAllPage, {
      kind, economy, delta, reason: reason || "ADMIN_ALL", ref, cursor: null, changed: 0,
    });
    return { ref };
  },
});

export const adjustPointsAllPage = internalMutation({
  args: { kind: adjustKind, economy: adjustEconomy, delta: v.number(), reason: v.string(), ref: v.string(), cursor: v.union(v.string(), v.null()), changed: v.number() },
  handler: async (ctx, { kind, economy, delta, reason, ref, cursor, changed }) => {
    const page = await ctx.db.query("users").paginate({ numItems: 200, cursor });
    for (const u of page.page) {
      if (u.accountStatus === "suspended" || u.accountStatus === "merged") continue;
      // Only users who actually use this app (have a ledger row there).
      const uses = await ctx.db.query("pointsLedger")
        .withIndex("by_user_economy", (q) => q.eq("userId", u._id).eq("economy", economy)).first();
      if (uses && (await adjustOne(ctx, kind, u._id, economy, delta, reason, ref))) changed++;
    }
    if (page.isDone) {
      console.log(`[admin] ${ref}: ${delta} ${kind} on ${economy} applied to ${changed} users`);
      return;
    }
    await ctx.scheduler.runAfter(0, internal.admin.adjustPointsAllPage, {
      kind, economy, delta, reason, ref, cursor: page.continueCursor, changed,
    });
  },
});
