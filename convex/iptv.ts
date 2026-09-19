import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { requireAdmin } from "./admin";
import type { Id } from "./_generated/dataModel";

// Stream channel management (football / youtube / other / movies). Admin can
// add / edit / pause / remove channels from the dashboard; the Android app reads them via the reactive
// `list` query, so changes appear instantly with no rebuild or new release.

export type IptvChannelDoc = {
  _id: Id<"iptvChannels">;
  name: string;
  logo?: string;
  country?: string;
  category: "Football" | "Sports" | "News" | "Entertainment";
  type?: "football" | "youtube" | "other" | "movies";
  streamUrl: string;
  backupStreamUrls?: string[];
  quality?: string;
  currentMatch?: string;
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
function classifyType(url: string, category: string): "football" | "youtube" | "other" | "movies" {
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
    type: v.optional(v.union(v.literal("football"), v.literal("youtube"), v.literal("other"), v.literal("movies"))),
    streamUrl: v.string(),
    backupStreamUrls: v.optional(v.array(v.string())),
    quality: v.optional(v.string()),
    currentMatch: v.optional(v.string()),
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
    type: v.optional(v.union(v.literal("football"), v.literal("youtube"), v.literal("other"), v.literal("movies"))),
    streamUrl: v.optional(v.string()),
    backupStreamUrls: v.optional(v.array(v.string())),
    quality: v.optional(v.string()),
    currentMatch: v.optional(v.string()),
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
// Admin helper: @handle → channel ID, so a whole channel can be embedded as
// its uploads playlist (UU…). Reads the channel ID YouTube publishes in the
// page's canonical link — no API key needed.
// ---------------------------------------------------------------------------
export const resolveYoutubeHandle = action({
  args: { handle: v.string() },
  handler: async (_ctx, { handle }): Promise<string | null> => {
    const h = handle.trim().replace(/^@/, "");
    if (!/^[\w.-]{3,30}$/.test(h)) return null;
    try {
      const res = await fetch(`https://www.youtube.com/@${h}`, {
        headers: { "accept-language": "en", "user-agent": "Mozilla/5.0" },
      });
      if (!res.ok) return null;
      const html = await res.text();
      const m =
        html.match(/youtube\.com\/channel\/(UC[\w-]{22})/) ||
        html.match(/"channelId":"(UC[\w-]{22})"/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  },
});
