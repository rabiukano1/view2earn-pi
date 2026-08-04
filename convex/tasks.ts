import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/guards";

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// All target URLs a task requires, including every MULTI_TASK step. Used by
// list() to hide fully-done bundles and by release to record completions.
export function targetUrlsOf(task: any): string[] {
  if (Array.isArray(task?.steps) && task.steps.length > 0) {
    return task.steps
      .map((s: any) => s?.targetUrl)
      .filter((u: string | null | undefined): u is string => !!u);
  }
  return task?.targetUrl ? [task.targetUrl] : [];
}

function getPlatform(url: string): string | null {
  const n = normalizeUrl(url);
  if (n.includes("facebook.com") || n.includes("fb.com")) return "facebook";
  if (n.includes("tiktok.com")) return "tiktok";
  if (n.includes("t.me") || n.includes("telegram")) return "telegram";
  if (n.includes("instagram.com")) return "instagram";
  return null;
}

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const now = Date.now();

    const completed = await ctx.db
      .query("completedTargets")
      .withIndex("by_user_url", (q) => q.eq("userId", userId))
      .collect();
    const doneUrls = new Set(completed.map((c) => c.normalizedUrl));

    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Only hide tasks the user has finished (RELEASED/CANCELLED). In-progress
    // verifications (USER_CLAIMED_DONE, PROOF_SUBMITTED, ADMIN_REVIEW, …) must
    // stay in the feed so the "Upload screenshot" / "Verify join" action remains
    // reachable after the user comes back from the target link.
    const excludedTaskIds = new Set(
      mine
        .filter((v) => v.state === "RELEASED" || v.state === "CANCELLED")
        .map((v) => v.taskId),
    );

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(100);

    return tasks
      .filter((t) => {
        if (t.expiresAt <= now) return false;
        if (t.creatorUserId === userId) return false;
        // A task is done if every one of its target URLs was already completed.
        const urls = targetUrlsOf(t);
        if (urls.length > 0 && urls.every((u) => doneUrls.has(normalizeUrl(u)))) {
          return false;
        }
        if (excludedTaskIds.has(t._id)) return false;
        return true;
      })
      .map((t) => ({
        _id: t._id,
        type: t.type,
        platform: t.platform,
        targetUrl: t.targetUrl,
        name: t.name,
        pageId: t.pageId,
        points: t.points,
        verifier: t.verifier,
        steps: t.steps,
      }));
  },
});

export const dailyRemaining = query({
  args: { userId: v.id("users"), platform: v.string() },
  handler: async (ctx, { userId, platform }) => {
    await requireUser(ctx, userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.getTime();

    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const todayCount = mine.filter((v) => {
      if (v.state === "CANCELLED" || v.state === "REJECTED") return false;
      if (v.platform !== platform) return false;
      return v._creationTime >= since;
    }).length;

    const limits = await ctx.db.query("platformLimits").collect();
    const cfg = limits.find((l) => l.platform === platform);
    const limit = cfg?.dailyTaskLimit ?? 50;

    return {
      used: todayCount,
      remaining: Math.max(0, limit - todayCount),
      limit,
      cooldownMinutes: cfg?.cooldownMinutes ?? 0,
    };
  },
});

// Honest follow-limit UI (plan §7.9b): remaining for every social platform in
// one call, so the feed can show "protects your account" caps up front.
const SOCIAL_PLATFORMS = ["facebook", "tiktok", "telegram"] as const;

export const myLimits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.getTime();

    const mine = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const active = mine.filter(
      (v) => v.state !== "CANCELLED" && v.state !== "REJECTED" && v._creationTime >= since,
    );

    const limits = await ctx.db.query("platformLimits").collect();
    return SOCIAL_PLATFORMS.map((platform) => {
      const cfg = limits.find((l) => l.platform === platform);
      const limit = cfg?.dailyTaskLimit ?? 50;
      const used = active.filter((v) => v.platform === platform).length;
      return {
        platform,
        used,
        remaining: Math.max(0, limit - used),
        limit,
        cooldownMinutes: cfg?.cooldownMinutes ?? 0,
      };
    });
  },
});

export const seedLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("platformLimits").take(1);
    if (existing.length > 0) return "already seeded";
    const rows = [
      { platform: "facebook", dailyTaskLimit: 50, cooldownMinutes: 0, newProfileFactor: 1.0 },
      { platform: "tiktok", dailyTaskLimit: 50, cooldownMinutes: 0, newProfileFactor: 1.0 },
      { platform: "telegram", dailyTaskLimit: 50, cooldownMinutes: 0, newProfileFactor: 1.0 },
    ];
    for (const r of rows) await ctx.db.insert("platformLimits", r);
    return `seeded ${rows.length} platform limits`;
  },
});

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    if (existing.length > 0) {
      return "already seeded";
    }
    const in30d = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const samples = [
      { type: "FOLLOW_PAGE", platform: "facebook", name: "pinetwork", targetUrl: "https://facebook.com/pinetwork", points: 50, verifier: "screenshot-ai" },
      { type: "FOLLOW_PAGE", platform: "tiktok", name: "pinetwork", targetUrl: "https://tiktok.com/@pinetwork", points: 50, verifier: "screenshot-ai" },
      { type: "JOIN_CHANNEL", platform: "telegram", name: "pinetwork", targetUrl: "https://t.me/pinetwork", points: 75, verifier: "telegram-bot" },
      { type: "FOLLOW_PAGE", platform: "facebook", name: "sidrachain", targetUrl: "https://facebook.com/sidrachain", points: 50, verifier: "screenshot-ai" },
      { type: "QUIZ", platform: "app", name: "Pi Quiz", targetUrl: "", points: 20, verifier: "quiz" },
      { type: "JOIN_CHANNEL", platform: "telegram", name: "sidrachain", targetUrl: "https://t.me/sidrachain", points: 75, verifier: "telegram-bot" },
      { type: "MULTI_TASK", platform: "tiktok", name: "pinetwork engagement", targetUrl: "", points: 150, verifier: "screenshot-ai", steps: [
        { action: "FOLLOW", label: "Follow the account", name: "pinetwork", targetUrl: "https://tiktok.com/@pinetwork" },
        { action: "LIKE", label: "Like a video", name: "", targetUrl: "https://tiktok.com/@pinetwork" },
        { action: "COMMENT", label: "Comment on a video", name: "", targetUrl: "https://tiktok.com/@pinetwork" },
      ] },
    ];
    for (const s of samples) {
      await ctx.db.insert("tasks", {
        ...s,
        maxCompletions: 1000,
        status: "active",
        expiresAt: in30d,
      });
    }
    return `seeded ${samples.length} tasks`;
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
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
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    return await ctx.db.insert("tasks", {
      type: args.type,
      platform: args.platform,
      targetUrl: args.targetUrl,
      name: args.name,
      pageId: args.pageId,
      points: args.points,
      verifier: args.verifier,
      maxCompletions: args.maxCompletions,
      creatorUserId: args.userId,
      status: "active",
      expiresAt: args.expiresAt,
      steps: args.steps,
    });
  },
});
