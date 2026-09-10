import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { requireAdmin } from "./admin";
import type { Id } from "./_generated/dataModel";

// A URL is "already HLS" when it points directly at a playlist file.
const M3U8_EXT = /\.m3u8?($|\?)/i;
const HLS_CONTENT_TYPES = ["application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl", "application/mpegurl"];

// Sites whose player needs a native HLS link (can't be transcoded serverless).
const KNOWN_LIVE_PLATFORMS: { re: RegExp; name: string }[] = [
  { re: /youtube\.com|youtu\.be/i, name: "YouTube" },
  { re: /twitch\.tv/i, name: "Twitch" },
  { re: /kick\.com/i, name: "Kick" },
  { re: /dailymotion\.com|dai\.ly/i, name: "Dailymotion" },
  { re: /facebook\.com.*\/watch|fb\.watch/i, name: "Facebook Live" },
];

// IPTV live-TV channel management. Admin can add / edit / pause / remove
// channels from the dashboard; the Android app reads them via the reactive
// `list` query, so changes appear instantly with no rebuild or new release.

export type IptvChannelDoc = {
  _id: Id<"iptvChannels">;
  name: string;
  logo?: string;
  country?: string;
  category: "Football" | "Sports" | "News" | "Entertainment";
  type?: "football" | "youtube" | "other";
  streamUrl: string;
  backupStreamUrls?: string[];
  quality?: string;
  currentMatch?: string;
  httpReferrer?: string;
  userAgent?: string;
  status: "active" | "paused";
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

const CATEGORIES = ["Football", "Sports", "News", "Entertainment"] as const;

function validateUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Stream URL is required");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`Stream URL must start with http(s):// — got "${trimmed}"`);
  }
  return trimmed;
}

function validateBackups(urls: string[] | undefined): string[] {
  if (!urls) return [];
  return urls
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => {
      if (!/^https?:\/\//i.test(u)) {
        throw new Error(`Backup URL must start with http(s):// — got "${u}"`);
      }
      return u;
    });
}

const YOUTUBE_RE = /youtube\.com|youtu\.be/i;

// Auto-classify a stream into its screen type from the URL: YouTube links go to
// the YouTube screen; hls/m3u8 live streams that are football go to football;
// everything else lands in "other".
function classifyType(url: string, category: string): "football" | "youtube" | "other" {
  if (YOUTUBE_RE.test(url)) return "youtube";
  if (category === "Football" || category === "Sports") return "football";
  return "other";
}

// ---------------------------------------------------------------------------
// Public: active channels for the Android live-TV screen (reactive subscription).
// ---------------------------------------------------------------------------
export const list = query({
  args: {},
  handler: async (ctx): Promise<IptvChannelDoc[]> => {
    const rows = await ctx.db
      .query("iptvChannels")
      .withIndex("by_status_order", (q) => q.eq("status", "active"))
      .collect();
    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({
        ...r,
        _id: r._id,
        type: r.type ?? classifyType(r.streamUrl, r.category),
      }));
  },
});

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

export const listAll = query({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<IptvChannelDoc[]> => {
    requireAdmin(token);
    const rows = await ctx.db.query("iptvChannels").collect();
    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({
        ...r,
        _id: r._id,
        type: r.type ?? classifyType(r.streamUrl, r.category),
      }));
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    logo: v.optional(v.string()),
    country: v.optional(v.string()),
    category: v.string(),
    type: v.optional(v.union(v.literal("football"), v.literal("youtube"), v.literal("other"))),
    streamUrl: v.string(),
    backupStreamUrls: v.optional(v.array(v.string())),
    quality: v.optional(v.string()),
    currentMatch: v.optional(v.string()),
    httpReferrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.token);
    const name = args.name.trim();
    if (!name) throw new Error("Channel name is required");
    const category = CATEGORIES.includes(args.category as any)
      ? (args.category as IptvChannelDoc["category"])
      : "Sports";
    const streamUrl = validateUrl(args.streamUrl);
    const type = args.type ?? classifyType(streamUrl, category);

    const max = (await ctx.db.query("iptvChannels").collect()).reduce(
      (m, c) => Math.max(m, c.sortOrder),
      0,
    );

    const now = Date.now();
    return await ctx.db.insert("iptvChannels", {
      name,
      logo: args.logo?.trim() || undefined,
      country: args.country?.trim() || "Global",
      category,
      type,
      streamUrl,
      backupStreamUrls: validateBackups(args.backupStreamUrls),
      quality: args.quality?.trim() || "720p HD",
      currentMatch: args.currentMatch?.trim() || undefined,
      httpReferrer: args.httpReferrer?.trim() || undefined,
      userAgent: args.userAgent?.trim() || undefined,
      status: args.status ?? "active",
      sortOrder: args.sortOrder ?? max + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("iptvChannels"),
    name: v.optional(v.string()),
    logo: v.optional(v.string()),
    country: v.optional(v.string()),
    category: v.optional(v.string()),
    type: v.optional(v.union(v.literal("football"), v.literal("youtube"), v.literal("other"))),
    streamUrl: v.optional(v.string()),
    backupStreamUrls: v.optional(v.array(v.string())),
    quality: v.optional(v.string()),
    currentMatch: v.optional(v.string()),
    httpReferrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdmin(args.token);
    const { token, id, ...raw } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Channel not found");

    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (raw.name !== undefined) {
      const name = raw.name.trim();
      if (!name) throw new Error("Channel name is required");
      patch.name = name;
    }
    if (raw.category !== undefined) {
      patch.category = CATEGORIES.includes(raw.category as any)
        ? raw.category
        : "Sports";
    }
    if (raw.streamUrl !== undefined) patch.streamUrl = validateUrl(raw.streamUrl);
    if (raw.backupStreamUrls !== undefined) {
      patch.backupStreamUrls = validateBackups(raw.backupStreamUrls);
    }
    if (raw.type !== undefined) {
      patch.type = raw.type;
    } else if (raw.streamUrl !== undefined || raw.category !== undefined) {
      // Re-classify when the URL/category changed and type wasn't explicitly set.
      patch.type = classifyType(
        raw.streamUrl ?? existing.streamUrl,
        raw.category ?? existing.category,
      );
    }
    if (raw.logo !== undefined) patch.logo = raw.logo.trim() || undefined;
    if (raw.country !== undefined) patch.country = raw.country.trim() || "Global";
    if (raw.quality !== undefined) patch.quality = raw.quality.trim() || "720p HD";
    if (raw.currentMatch !== undefined) {
      patch.currentMatch = raw.currentMatch.trim() || undefined;
    }
    if (raw.httpReferrer !== undefined) {
      patch.httpReferrer = raw.httpReferrer.trim() || undefined;
    }
    if (raw.userAgent !== undefined) {
      patch.userAgent = raw.userAgent.trim() || undefined;
    }
    if (raw.sortOrder !== undefined) patch.sortOrder = raw.sortOrder;

    await ctx.db.patch(id, patch);
    return id;
  },
});

/** Toggle a channel between active (visible) and paused (hidden). */
export const setStatus = mutation({
  args: {
    token: v.string(),
    id: v.id("iptvChannels"),
    status: v.union(v.literal("active"), v.literal("paused")),
  },
  handler: async (ctx, { token, id, status }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Channel not found");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("iptvChannels") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Channel not found");
    await ctx.db.delete(id);
  },
});

// ---------------------------------------------------------------------------
// URL → .m3u8 resolver (admin helper). Given ANY url, returns the playable
// HLS manifest URL when one can be found, plus a human-readable note.
// ---------------------------------------------------------------------------

function extractM3u8FromHtml(html: string): string | null {
  const patterns = [
    /["']((?:https?:)?\/\/[^"'\s]+?\.m3u8[^"'\s]*)["']/gi,
    /["']((?:https?:)?\/\/[^"'\s]+?\.m3u[^"'\s]*)["']/gi,
    /src\s*=\s*["']([^"'\s]+)["']/gi,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1];
  }
  return null;
}

// Best-effort YouTube live resolution via Piped (Invidious-compatible API), so
// a raw watch URL can become a playable HLS stream without yt-dlp on a server.
async function resolveYouTube(inputUrl: string): Promise<string | null> {
  const id =
    (inputUrl.match(/[?&]v=([\w-]{11})/) || [])[1] ||
    (inputUrl.match(/youtu\.be\/([\w-]{11})/) || [])[1];
  if (!id) return null;
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.private.coffee",
    "https://pipedapi.reallyaweso.me",
  ];
  for (const base of instances) {
    try {
      const res = await fetch(`${base}/streams/${id}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        hls?: string;
        videoStreams?: { url: string; format?: string }[];
      };
      if (data.hls) return data.hls;
      const hlsStream = (data.videoStreams ?? []).find((s) => s.format === "hls");
      if (hlsStream) return hlsStream.url;
    } catch {
      // try next instance
    }
  }
  return null;
}

export const resolve = action({
  args: { url: v.string() },
  handler: async (_ctx, { url }): Promise<{
    ok: boolean;
    m3u8Url: string | null;
    redirects: string[];
    note: string;
  }> => {
    const input = url.trim();
    if (!/^https?:\/\//i.test(input)) {
      return { ok: false, m3u8Url: null, redirects: [], note: "URL must start with http:// or https://" };
    }

    // 1. Already an m3u8/m3u link — trust it.
    if (M3U8_EXT.test(input)) {
      return { ok: true, m3u8Url: input, redirects: [], note: "Already an HLS playlist" };
    }

    // 2. Known live platforms (YouTube/Twitch/…) need native extraction.
    for (const p of KNOWN_LIVE_PLATFORMS) {
      if (p.re.test(input)) {
        if (p.name === "YouTube") {
          const hls = await resolveYouTube(input);
          if (hls) {
            return { ok: true, m3u8Url: hls, redirects: [], note: `Resolved ${p.name} live stream to HLS` };
          }
        }
        return {
          ok: false,
          m3u8Url: null,
          redirects: [],
          note: `${p.name} links can't be auto-converted server-side. Paste the stream's direct .m3u8 URL instead.`,
        };
      }
    }

    // 3. Follow redirects and inspect the final content — most HLS CDNs 302
    //    a short token URL to the real .m3u8, and some pages return the
    //    playlist body directly.
    const redirects: string[] = [];
    try {
      let current = input;
      for (let hop = 0; hop < 5; hop++) {
        const res = await fetch(current, { method: "GET", redirect: "manual", headers: { "user-agent": "Mozilla/5.0" } });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) break;
          redirects.push(loc);
          current = new URL(loc, current).toString();
          continue;
        }
        const ct = (res.headers.get("content-type") || "").toLowerCase();

        // Direct HLS body or content-type → this is the manifest.
        if (HLS_CONTENT_TYPES.some((t) => ct.includes(t)) || M3U8_EXT.test(current)) {
          return { ok: true, m3u8Url: current, redirects, note: "Resolved via redirect chain" };
        }

        // HTML page → dig for an embedded .m3u8.
        if (ct.includes("text/html")) {
          const html = await res.text();
          const found = extractM3u8FromHtml(html);
          if (found) {
            const abs = new URL(found, current).toString();
            return { ok: true, m3u8Url: abs, redirects, note: "Found embedded HLS stream in page" };
          }
        }
        // Non-HLS final resource (e.g. direct .mp4 / DASH) — can't wrap to m3u8.
        return {
          ok: false,
          m3u8Url: null,
          redirects,
          note: `Resolved to a non-HLS resource (${ct || "unknown type"}). Only HLS (.m3u8) streams are supported.`,
        };
      }
    } catch (e) {
      return { ok: false, m3u8Url: null, redirects, note: `Could not reach URL: ${String(e)}` };
    }

    return { ok: false, m3u8Url: null, redirects, note: "Could not resolve to an .m3u8 stream" };
  },
});
