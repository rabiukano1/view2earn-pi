import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Anonymous website (apps/website) visitor analytics. The site's VisitorTracker
// only calls `trackVisit` after the visitor accepts the cookie banner
// (v2e_consent = "accepted"); we also sanity-check the shape server-side so the
// endpoint can't be spammed with junk. No personal data: `vid` is a random uuid
// cookie, never a user id.

const VID_RE = /^[0-9a-f-]{8,64}$/;
const PATH_MAX = 300;

/** Record one consented page view. Fire-and-forget from the browser. */
export const trackVisit = mutation({
  args: {
    vid: v.string(),
    path: v.string(),
    isNewVisit: v.boolean(),
    visitNumber: v.number(),
    firstVisitAt: v.number(),
    referrer: v.optional(v.string()),
    screen: v.optional(v.string()),
    lang: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Light validation so the public endpoint only stores sane rows.
    const vid = args.vid.trim();
    if (!VID_RE.test(vid)) return;
    const path = args.path.trim().slice(0, PATH_MAX);
    if (!path.startsWith("/")) return;
    if (!Number.isFinite(args.visitNumber) || args.visitNumber < 1) return;
    const now = Date.now();
    const firstVisitAt = Number.isFinite(args.firstVisitAt) ? args.firstVisitAt : now;

    await ctx.db.insert("visitorEvents", {
      vid,
      path,
      isNewVisit: !!args.isNewVisit,
      visitNumber: Math.floor(args.visitNumber),
      firstVisitAt,
      referrer: args.referrer?.trim().slice(0, 500) || undefined,
      screen: args.screen?.trim().slice(0, 40) || undefined,
      lang: args.lang?.trim().slice(0, 20) || undefined,
    });
  },
});

// ---------- Admin (token-gated, same pattern as convex/inquiries.ts) ----------

function requireAdmin(token: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "admin";
  if (token !== expected) throw new Error("Unauthorized");
}

/**
 * Aggregate visitor stats for the admin panel. `since` (epoch ms) bounds the
 * window; results are always capped so the query stays cheap on big tables.
 */
export const getVisitorStats = query({
  args: {
    token: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (ctx, { token, since }) => {
    requireAdmin(token);
    const cutoff = since && Number.isFinite(since) ? since : 0;
    const all = await ctx.db.query("visitorEvents").order("desc").take(2000);

    const inWindow = cutoff > 0 ? all.filter((e) => e._creationTime >= cutoff) : all;

    // Unique visitor ids in the window (Set of vids).
    const unique = new Set<string>();
    const paths: Record<string, number> = {};
    const visitsNew = inWindow.filter((e) => e.isNewVisit).length;
    for (const e of inWindow) {
      unique.add(e.vid);
      paths[e.path] = (paths[e.path] ?? 0) + 1;
    }

    const topPaths = Object.entries(paths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const recent = inWindow.slice(0, 100).map((e) => ({
      _id: e._id,
      _creationTime: e._creationTime,
      vid: e.vid,
      path: e.path,
      isNewVisit: e.isNewVisit,
      visitNumber: e.visitNumber,
      referrer: e.referrer ?? null,
      screen: e.screen ?? null,
      lang: e.lang ?? null,
    }));

    return {
      pageViews: inWindow.length,
      uniqueVisitors: unique.size,
      newVisits: visitsNew,
      topPaths,
      recent,
    };
  },
});
