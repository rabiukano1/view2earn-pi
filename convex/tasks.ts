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

    const inProgress = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const inProgressTaskIds = new Set(
      inProgress
        .filter((v) => v.state !== "REJECTED" && v.state !== "CANCELLED" && v.state !== "RELEASED")
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
        const url = normalizeUrl(t.targetUrl);
        if (doneUrls.has(url)) return false;
        if (inProgressTaskIds.has(t._id)) return false;
        return true;
      })
      .map((t) => ({
        _id: t._id,
        type: t.type,
        platform: t.platform,
        targetUrl: t.targetUrl,
        points: t.points,
        verifier: t.verifier,
      }));
  },
});

export const dailyRemaining = query({
  args: { userId: v.id("users"), platform: v.string() },
  handler: async (ctx, { userId, platform }) => {
    await requireUser(ctx, userId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const todayCount = verifications.filter((v) => {
      const task = v.taskId;
      if (!task || v.state === "CANCELLED") return false;
      return v._creationTime >= todayStart.getTime();
    }).length;

    const limits = await ctx.db.query("platformLimits").collect();
    const platformLimit = limits.find((l) => l.platform === platform);
    const limit = platformLimit?.dailyTaskLimit ?? 15;

    return { used: todayCount, remaining: Math.max(0, limit - todayCount), limit };
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
      { type: "FOLLOW_PAGE", platform: "facebook", targetUrl: "https://facebook.com/pinetwork", points: 50, verifier: "screenshot-ai" },
      { type: "FOLLOW_PAGE", platform: "tiktok", targetUrl: "https://tiktok.com/@pinetwork", points: 50, verifier: "screenshot-ai" },
      { type: "JOIN_CHANNEL", platform: "telegram", targetUrl: "https://t.me/pinetwork", points: 75, verifier: "telegram-bot" },
      { type: "FOLLOW_PAGE", platform: "facebook", targetUrl: "https://facebook.com/sidrachain", points: 50, verifier: "screenshot-ai" },
      { type: "QUIZ", platform: "app", targetUrl: "", points: 20, verifier: "quiz" },
      { type: "JOIN_CHANNEL", platform: "telegram", targetUrl: "https://t.me/sidrachain", points: 75, verifier: "telegram-bot" },
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
    points: v.number(),
    verifier: v.string(),
    maxCompletions: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    return await ctx.db.insert("tasks", {
      type: args.type,
      platform: args.platform,
      targetUrl: args.targetUrl,
      points: args.points,
      verifier: args.verifier,
      maxCompletions: args.maxCompletions,
      creatorUserId: args.userId,
      status: "active",
      expiresAt: args.expiresAt,
    });
  },
});
