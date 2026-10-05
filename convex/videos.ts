import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./admin";
import { getAuthUserId } from "@convex-dev/auth/server";

// Telegram bots can only DOWNLOAD files up to 20 MB (getFile), and playback
// goes back through the bot — so that ceiling, not the 50 MB send limit, is
// what an upload has to fit in.
// ponytail: swap the Telegram push in `createFromUpload` for an R2 PUT when longer
// videos are needed; nothing else in this file changes.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// 1. Generate direct Convex upload URL for zero-cost file uploads
export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    return await ctx.storage.generateUploadUrl();
  },
});

// Admin upload: the panel PUTs the file to the URL above, then calls this.
// Convex storage is only a staging buffer — the bytes are pushed into the
// private Telegram channel and the staged blob is deleted, so nothing stays in
// Convex. Published straight to ACTIVE: the admin is the publisher, so there is
// no separate review step (and the app has no user-upload path at all).
export const createFromUpload = action({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ videoId: Id<"videos"> }> => {
    requireAdmin(args.token);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channel = process.env.TELEGRAM_VIDEO_CHANNEL_ID ?? process.env.TELEGRAM_VOICE_CHANNEL_ID;
    if (!token || !channel) throw new Error("TELEGRAM_VIDEO_CHANNEL_ID is not set");

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("Upload not found — please try again");
    if (blob.size > MAX_UPLOAD_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error(
        `That video is ${(blob.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
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
    await ctx.storage.delete(args.storageId);
    const video = payload.result?.video;
    if (!payload.ok || !video) {
      throw new Error(`Upload failed: ${payload.description ?? "Telegram rejected the file"}`);
    }

    return await ctx.runMutation(internal.videos.insertUpload, {
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
    title: v.string(),
    description: v.optional(v.string()),
    fileId: v.string(),
    thumbFileId: v.optional(v.string()),
    durationSeconds: v.number(),
  },
  handler: async (ctx, a): Promise<{ videoId: Id<"videos"> }> => {
    // Admin-published videos are not owned by an app user. `userId` is required
    // by the schema, so attribute them to the oldest account (the owner's).
    const owner = await ctx.db.query("users").order("asc").first();
    if (!owner) throw new Error("No user records exist yet");

    const videoId = await ctx.db.insert("videos", {
      userId: owner._id,
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
      status: "ACTIVE",
      createdAt: Date.now(),
    });
    return { videoId };
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

// ---------------------------------------------------------------------------
// User reporting (UGC moderation)
// ---------------------------------------------------------------------------

export const REPORT_REASONS = [
  "sexual",
  "violence",
  "hate",
  "harassment",
  "misleading",
  "copyright",
  "spam",
  "other",
] as const;

/** A viewer flags a video. One report per user per video. */
export const reportVideo = mutation({
  args: {
    videoId: v.id("videos"),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { videoId, reason, details }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      throw new Error("Pick a reason");
    }
    const video = await ctx.db.get(videoId);
    if (!video) throw new Error("Video not found");

    const existing = await ctx.db
      .query("contentReports")
      .withIndex("by_reporter_video", (q) =>
        q.eq("reporterId", userId).eq("videoId", videoId),
      )
      .first();
    if (existing) return { ok: true, alreadyReported: true };

    await ctx.db.insert("contentReports", {
      reporterId: userId,
      videoId,
      reason,
      details: details?.trim().slice(0, 1000) || undefined,
      status: "open",
      createdAt: Date.now(),
    });

    // Auto-hide once several distinct users flag the same video, so bad
    // content stops being served before a human gets to it.
    const all = await ctx.db
      .query("contentReports")
      .withIndex("by_video", (q) => q.eq("videoId", videoId))
      .collect();
    if (all.length >= 3 && video.status === "ACTIVE") {
      await ctx.db.patch(videoId, { status: "BLOCKED" });
    }
    return { ok: true, alreadyReported: false };
  },
});

/** Admin: open reports, newest first, with the video they point at. */
export const listReports = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { token, status }) => {
    requireAdmin(token);
    const rows = await ctx.db
      .query("contentReports")
      .withIndex("by_status", (q) => q.eq("status", status ?? "open"))
      .order("desc")
      .take(200);

    return Promise.all(
      rows.map(async (r) => {
        const video = await ctx.db.get(r.videoId);
        const reporter = await ctx.db.get(r.reporterId);
        return {
          _id: r._id,
          videoId: r.videoId,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reporter: reporter?.username ?? "unknown",
          videoTitle: video?.title ?? "(deleted)",
          videoStatus: video?.status ?? "deleted",
        };
      }),
    );
  },
});

/** Admin: close a report, optionally taking the video down at the same time. */
export const resolveReport = mutation({
  args: {
    token: v.string(),
    reportId: v.id("contentReports"),
    action: v.union(v.literal("dismiss"), v.literal("remove")),
  },
  handler: async (ctx, { token, reportId, action }) => {
    requireAdmin(token);
    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("Report not found");

    if (action === "remove") {
      const video = await ctx.db.get(report.videoId);
      if (video) await ctx.db.patch(report.videoId, { status: "BLOCKED" });
      // Every report on that video is settled by the takedown.
      for (const r of await ctx.db
        .query("contentReports")
        .withIndex("by_video", (q) => q.eq("videoId", report.videoId))
        .collect()) {
        await ctx.db.patch(r._id, { status: "reviewed" });
      }
    } else {
      await ctx.db.patch(reportId, { status: "dismissed" });
    }
    return { ok: true };
  },
});
