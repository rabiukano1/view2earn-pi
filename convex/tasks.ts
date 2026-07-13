import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Active, non-expired tasks for the feed. Completion counts are NEVER
// returned to the client (key design rule: counts stay hidden).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(50);
    return tasks
      .filter((t) => t.expiresAt > now)
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

// Dev-only sample data so the feed has something to show.
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
