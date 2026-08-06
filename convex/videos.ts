import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// 1. Generate direct Convex upload URL for zero-cost file uploads
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

// 2. Register/Create a video entry in the database
export const createVideo = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    provider: v.union(v.literal("YOUTUBE"), v.literal("CONVEX"), v.literal("R2")),
    storageId: v.optional(v.id("_storage")),
    youtubeId: v.optional(v.string()),
    customUrl: v.optional(v.string()),
    durationSeconds: v.number(),
    rewardPoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", identity.subject))
      .first();

    if (!user) throw new Error("User record not found");

    let videoUrl = args.customUrl || "";
    let externalId = args.youtubeId || "";

    if (args.provider === "CONVEX" && args.storageId) {
      const url = await ctx.storage.getUrl(args.storageId);
      if (!url) throw new Error("Failed to resolve storage URL");
      videoUrl = url;
      externalId = args.storageId;
    }

    // ponytail: default rewardPoints is set to 10 points per video view; calibrate based on economy metrics in production.
    const rewardPoints = args.rewardPoints ?? 10;

    const videoId = await ctx.db.insert("videos", {
      userId: user._id,
      title: args.title,
      description: args.description,
      provider: args.provider,
      externalId,
      videoUrl,
      durationSeconds: args.durationSeconds,
      viewsCount: 0,
      rewardPoints,
      status: "ACTIVE",
      createdAt: Date.now(),
    });

    return videoId;
  },
});

// 3. Query active video feed sorted by newest
export const getActiveVideos = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("videos")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "ACTIVE"))
      .order("desc")
      .take(limit);
  },
});

// 4. Record watch event and claim view points
export const recordWatchCompletion = mutation({
  args: {
    videoId: v.id("videos"),
    watchDurationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");

    // ponytail: minimum watch requirement set to 80% of video duration to prevent instant view point farming.
    const requiredSeconds = Math.floor(video.durationSeconds * 0.8);
    const isValidWatch = args.watchDurationSeconds >= requiredSeconds;

    const existingLog = await ctx.db
      .query("videoWatchLogs")
      .withIndex("by_user_video", (q) => q.eq("userId", user._id).eq("videoId", args.videoId))
      .first();

    if (existingLog && existingLog.rewardClaimed) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }

    if (isValidWatch) {
      if (existingLog) {
        await ctx.db.patch(existingLog._id, {
          watchDurationSeconds: args.watchDurationSeconds,
          completed: true,
          rewardClaimed: true,
          watchedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("videoWatchLogs", {
          userId: user._id,
          videoId: args.videoId,
          watchDurationSeconds: args.watchDurationSeconds,
          completed: true,
          rewardClaimed: true,
          watchedAt: Date.now(),
        });
      }

      await ctx.db.patch(args.videoId, {
        viewsCount: video.viewsCount + 1,
      });

      return { success: true, rewardEarned: video.rewardPoints };
    }

    return { success: false, reason: "INSUFFICIENT_WATCH_TIME" };
  },
});

// Helper to extract YouTube video ID from various link formats
function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// 5. Submit video via URL (No direct file upload required - 0$ storage & bandwidth cost)
export const submitVideoLink = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", identity.subject))
      .first();

    if (!user) throw new Error("User record not found");

    const youtubeId = extractYouTubeId(args.url);
    if (!youtubeId) {
      throw new Error("Invalid YouTube URL. Please paste a valid YouTube or YouTube Shorts link.");
    }

    // ponytail: fallback default duration set to 60s if not specified by user; in production use YouTube Data API metadata fetch.
    const durationSeconds = args.durationSeconds ?? 60;
    const rewardPoints = 10;

    const videoId = await ctx.db.insert("videos", {
      userId: user._id,
      title: args.title,
      description: args.description,
      provider: "YOUTUBE",
      externalId: youtubeId,
      videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      durationSeconds,
      viewsCount: 0,
      rewardPoints,
      status: "ACTIVE",
      createdAt: Date.now(),
    });

    return { videoId, youtubeId };
  },
});
