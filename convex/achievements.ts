import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireAdmin } from "./admin";
import { requireAuth } from "./lib/guards";
import { awardXP } from "./xp";
import { Id } from "./_generated/dataModel";

// Achievements are fully admin-configurable. Each achievement has a `metric`
// (which dashboard value it measures) and a `target` threshold. The app client
// (src/profile/smart.ts) computes per-user progress from the config returned by
// `getEnabled` via the smartDashboard payload.

export const ACHIEVEMENT_METRICS = [
  "tasks",
  "earned",
  "streak",
  "referrals",
  "rank",
] as const;
export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export type AchievementConfig = {
  key: string;
  metric: AchievementMetric;
  target: number;
  icon: string;
  tint: string;
  title: string;
  desc: string;
  enabled: boolean;
  sortOrder: number;
};

// The 12 shipped achievements. Admin edits create a row in the `achievements`
// table that overrides the matching default (keyed by `key`).
export const ACHIEVEMENT_DEFAULTS: AchievementConfig[] = [
  {
    key: "first-task",
    metric: "tasks",
    target: 1,
    icon: "list-check",
    tint: "#3B82F6",
    title: "First Task",
    desc: "Complete your first task",
    enabled: true,
    sortOrder: 1,
  },
  {
    key: "task-ten",
    metric: "tasks",
    target: 10,
    icon: "clipboard-check",
    tint: "#3B82F6",
    title: "Task Taker",
    desc: "Complete 10 tasks",
    enabled: true,
    sortOrder: 2,
  },
  {
    key: "task-fifty",
    metric: "tasks",
    target: 50,
    icon: "bolt",
    tint: "#3B82F6",
    title: "Task Machine",
    desc: "Complete 50 tasks",
    enabled: true,
    sortOrder: 3,
  },
  {
    key: "points-100",
    metric: "earned",
    target: 100,
    icon: "coins",
    tint: "#F59E0B",
    title: "First Points",
    desc: "Earn 100 lifetime points",
    enabled: true,
    sortOrder: 4,
  },
  {
    key: "points-1000",
    metric: "earned",
    target: 1000,
    icon: "sack-dollar",
    tint: "#F59E0B",
    title: "Points Collector",
    desc: "Earn 1,000 lifetime points",
    enabled: true,
    sortOrder: 5,
  },
  {
    key: "points-5000",
    metric: "earned",
    target: 5000,
    icon: "gem",
    tint: "#F59E0B",
    title: "Points Tycoon",
    desc: "Earn 5,000 lifetime points",
    enabled: true,
    sortOrder: 6,
  },
  {
    key: "streak-3",
    metric: "streak",
    target: 3,
    icon: "fire",
    tint: "#EF4444",
    title: "Streak Starter",
    desc: "Hit a 3-day streak",
    enabled: true,
    sortOrder: 7,
  },
  {
    key: "streak-7",
    metric: "streak",
    target: 7,
    icon: "fire-flame-curved",
    tint: "#EF4444",
    title: "Week Streak",
    desc: "Hit a 7-day streak",
    enabled: true,
    sortOrder: 8,
  },
  {
    key: "streak-30",
    metric: "streak",
    target: 30,
    icon: "crown",
    tint: "#EF4444",
    title: "Monthly Legend",
    desc: "Hit a 30-day streak",
    enabled: true,
    sortOrder: 9,
  },
  {
    key: "refer-1",
    metric: "referrals",
    target: 1,
    icon: "user-plus",
    tint: "#10B981",
    title: "First Invite",
    desc: "Invite 1 friend",
    enabled: true,
    sortOrder: 10,
  },
  {
    key: "refer-5",
    metric: "referrals",
    target: 5,
    icon: "users",
    tint: "#10B981",
    title: "Community Builder",
    desc: "Invite 5 friends",
    enabled: true,
    sortOrder: 11,
  },
  {
    key: "rank-top",
    metric: "rank",
    target: 10,
    icon: "trophy",
    tint: "#7C3AED",
    title: "Leaderboard Star",
    desc: "Reach the top 10 in your ecosystem",
    enabled: true,
    sortOrder: 12,
  },
];

const DEFAULT_KEYS = new Set(ACHIEVEMENT_DEFAULTS.map((a) => a.key));

async function loadOverrides(
  ctx: QueryCtx,
): Promise<Record<string, Omit<AchievementConfig, "key">>> {
  const rows = await ctx.db.query("achievements").collect();
  const overrides: Record<string, Omit<AchievementConfig, "key">> = {};
  for (const row of rows) {
    overrides[row.key] = {
      metric: row.metric as AchievementMetric,
      target: row.target,
      icon: row.icon,
      tint: row.tint,
      title: row.title,
      desc: row.desc,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
    };
  }
  return overrides;
}

// Merges defaults + DB overrides into the full, sorted config list.
async function mergedConfigs(
  ctx: QueryCtx,
): Promise<AchievementConfig[]> {
  const overrides = await loadOverrides(ctx);
  const merged = ACHIEVEMENT_DEFAULTS.map((def) =>
    overrides[def.key]
      ? { ...def, ...overrides[def.key] }
      : def,
  );
  // Custom achievements added by admin (keys not in defaults) come after.
  for (const [key, cfg] of Object.entries(overrides)) {
    if (!DEFAULT_KEYS.has(key)) {
      merged.push({ key, ...cfg });
    }
  }
  return merged.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Public: enabled achievement configs (used by the app's smart dashboard). */
export const getEnabled = query({
  args: {},
  handler: async (ctx): Promise<AchievementConfig[]> => {
    const all = await mergedConfigs(ctx);
    return all.filter((a) => a.enabled);
  },
});

// ---------- Admin ----------

/** Admin: every achievement (defaults merged with overrides, incl. disabled). */
export const listAll = query({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<AchievementConfig[]> => {
    requireAdmin(token);
    return await mergedConfigs(ctx);
  },
});

/** Admin: create or replace an achievement (upsert by key). */
export const upsert = mutation({
  args: {
    token: v.string(),
    key: v.string(),
    metric: v.string(),
    target: v.number(),
    icon: v.string(),
    tint: v.string(),
    title: v.string(),
    desc: v.string(),
    enabled: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, { token, key, ...fields }) => {
    requireAdmin(token);
    if (!fields.title.trim()) throw new Error("Title is required");
    if (!fields.desc.trim()) throw new Error("Description is required");
    if (fields.target < 1) throw new Error("Target must be at least 1");
    if (!ACHIEVEMENT_METRICS.includes(fields.metric as AchievementMetric)) {
      throw new Error(`Unknown metric "${fields.metric}"`);
    }
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("achievements", { key, ...fields });
  },
});

/** Admin: delete an override (reverts to the default when one exists). */
export const remove = mutation({
  args: { token: v.string(), key: v.string() },
  handler: async (ctx, { token, key }) => {
    requireAdmin(token);
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** User: Claim an achievement to get XP. */
export const claimAchievement = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const userId = (await requireAuth(ctx)) as Id<"users">;
    const achievement = await ctx.db
      .query("achievements")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    // We get the default if not overridden
    let targetDef = ACHIEVEMENT_DEFAULTS.find(a => a.key === args.key);
    
    const xpReward = achievement?.xpReward ?? 100;

    await awardXP(ctx, {
      userId,
      amount: xpReward,
      source: "ACHIEVEMENT",
      sourceId: args.key,
    });
  },
});
