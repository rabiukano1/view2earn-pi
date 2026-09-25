import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

// Telegram bots can only DOWNLOAD files up to 20 MB (getFile), and playback
// goes back through the bot — so that ceiling, not the 50 MB send limit, is
// what an upload has to fit in.
// ponytail: swap the Telegram push in `submitUpload` for an R2 PUT when longer
// videos are needed; nothing else in this file changes.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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

// 2b. App upload: the client PUTs the file to the URL from `generateUploadUrl`,
// then calls this. Convex storage is only a staging buffer — the bytes are
// pushed into the private Telegram channel and the staged blob is deleted, so
// nothing stays in Convex. The row lands as PROCESSING = awaiting admin review.
export const submitUpload = action({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ videoId: Id<"videos"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const title = args.title.trim();
    if (!title) throw new Error("Give your video a title");

    // Admin kill switch (Admin → Features). Checked here, before anything is
    // uploaded, so turning it off stops new videos immediately.
    const flags = await ctx.runQuery(api.features.getFlags, {});
    if (flags["feature:videoUpload"] === false) {
      throw new Error("Video uploads are turned off right now. Please try again later.");
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channel = process.env.TELEGRAM_VIDEO_CHANNEL_ID ?? process.env.TELEGRAM_VOICE_CHANNEL_ID;
    if (!token || !channel) throw new Error("Video uploads are not configured yet");

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("Upload not found — please try again");

    // Authoritative size check (the client checks too, for a nicer message).
    if (blob.size > MAX_UPLOAD_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error(
        `That video is ${(blob.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB — please trim it or record at a lower quality.`,
      );
    }

    const form = new FormData();
    form.append("chat_id", channel);
    form.append("caption", title);
    form.append("supports_streaming", "true");
    form.append("video", blob, "upload.mp4");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: "POST", body: form });
    const payload = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: {
        message_id: number;
        video?: { file_id: string; duration?: number; thumbnail?: { file_id: string }; thumb?: { file_id: string } };
      };
    };
    // Free the staging blob either way — it has served its purpose.
    await ctx.storage.delete(args.storageId);
    const video = payload.result?.video;
    if (!payload.ok || !video) {
      throw new Error(`Upload failed: ${payload.description ?? "Telegram rejected the file"}`);
    }

    return await ctx.runMutation(internal.videos.insertUpload, {
      externalUid: identity.subject,
      title,
      description: args.description,
      fileId: video.file_id,
      thumbFileId: video.thumbnail?.file_id ?? video.thumb?.file_id,
      durationSeconds: video.duration ?? args.durationSeconds ?? 0,
    });
  },
});

export const insertUpload = internalMutation({
  args: {
    externalUid: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    fileId: v.string(),
    thumbFileId: v.optional(v.string()),
    durationSeconds: v.number(),
  },
  handler: async (ctx, a): Promise<{ videoId: Id<"videos"> }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", a.externalUid))
      .first();
    if (!user) throw new Error("User record not found");

    const videoId = await ctx.db.insert("videos", {
      userId: user._id,
      title: a.title,
      description: a.description,
      provider: "TELEGRAM",
      externalId: a.fileId,
      // Clients prefix this with the Convex site URL (see src/config.ts).
      videoUrl: "",
      thumbnailUrl: a.thumbFileId,
      durationSeconds: a.durationSeconds,
      viewsCount: 0,
      rewardPoints: 10,
      status: "PROCESSING", // awaiting admin approval
      createdAt: Date.now(),
    });
    return { videoId };
  },
});

/** The signed-in user's own uploads, so they can see review status. */
export const myVideos = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", identity.subject))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

// ---------- Admin moderation ----------

export const listForReview = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    requireAdmin(token);
    const rows = status
      ? await ctx.db
          .query("videos")
          .withIndex("by_status_createdAt", (q) => q.eq("status", status as any))
          .order("desc")
          .collect()
      : await ctx.db.query("videos").order("desc").take(300);
    return await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { ...r, username: user?.username ?? "unknown", fraudScore: user?.fraudScore ?? 0 };
      }),
    );
  },
});

export const setVideoStatus = mutation({
  args: {
    token: v.string(),
    videoIds: v.array(v.id("videos")),
    status: v.union(v.literal("ACTIVE"), v.literal("BLOCKED")),
  },
  handler: async (ctx, { token, videoIds, status }) => {
    requireAdmin(token);
    let done = 0;
    for (const id of videoIds) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      await ctx.db.patch(id, { status });
      done += 1;
    }
    return { done };
  },
});

export const removeVideo = mutation({
  args: { token: v.string(), id: v.id("videos") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    await ctx.db.delete(id); // the file stays in the Telegram channel as the archive
  },
});

// 3. Query active video feed sorted by newest
export const getActiveVideos = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const rows = await ctx.db
      .query("videos")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "ACTIVE"))
      .order("desc")
      .take(limit);
    return await Promise.all(
      rows.map(async (r) => ({ ...r, username: (await ctx.db.get(r.userId))?.username ?? "unknown" })),
    );
  },
});

/** Telegram file ids for the playback proxy (http.ts /video/file). */
export const getForStream = internalQuery({
  // `allowPending` is set only when http.ts verified an admin token, so
  // moderators can watch an upload before approving it.
  args: { id: v.id("videos"), allowPending: v.optional(v.boolean()) },
  handler: async (ctx, { id, allowPending }) => {
    const row = await ctx.db.get(id);
    if (!row || row.provider !== "TELEGRAM") return null;
    if (row.status !== "ACTIVE" && !allowPending) return null;
    return { fileId: row.externalId, thumbFileId: row.thumbnailUrl };
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
