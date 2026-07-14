import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";

const PROFILE_LOCK_DAYS = 30;
const BIO_CODE_EXPIRY_MS = 15 * 60 * 1000;

// Which hosts a given platform's profile link must live on (plan §7.2 —
// one profile per platform, real link required).
const PLATFORM_HOSTS: Record<string, string[]> = {
  facebook: ["facebook.com", "fb.com", "m.facebook.com"],
  tiktok: ["tiktok.com", "vm.tiktok.com"],
  telegram: ["t.me", "telegram.me"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  x: ["x.com", "twitter.com"],
};

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function hostMatchesPlatform(url: string, platform: string): boolean {
  const allowed = PLATFORM_HOSTS[platform];
  if (!allowed) return false;
  const host = normalizeUrl(url).split("/")[0];
  return allowed.some((h) => host === h || host.endsWith(`.${h}`));
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const requestBioCode = mutation({
  args: { userId: v.id("users"), platform: v.string() },
  handler: async (ctx, { userId, platform }) => {
    await requireUser(ctx, userId);
    const code = generateCode();
    await ctx.db.insert("bioCodes", {
      userId,
      code,
      platform,
      createdAt: Date.now(),
    });
    ctx.scheduler.runAfter(BIO_CODE_EXPIRY_MS, internal.linkedProfiles.purgeBioCode, {
      code,
    });
    return code;
  },
});

// Reads the pending code (actions can't touch the db directly).
export const getBioByCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("bioCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
  },
});

// Verify ownership by actually fetching the public profile and confirming the
// 6-char code appears in the page (plan §4 Tier 2). An action so it can fetch.
export const verifyBioCode = action({
  args: {
    userId: v.id("users"),
    code: v.string(),
    url: v.string(),
    platform: v.string(),
    usernameSnapshot: v.string(),
  },
  handler: async (ctx, args): Promise<{ profileId: string; lockedUntil: number }> => {
    const code = args.code.trim().toUpperCase();

    // 1. The link must actually belong to the chosen platform.
    if (!hostMatchesPlatform(args.url, args.platform)) {
      const hosts = (PLATFORM_HOSTS[args.platform] ?? []).join(", ");
      throw new Error(
        `That link isn't a ${args.platform} profile. Paste your ${args.platform} link (${hosts}).`,
      );
    }

    // 2. The code must be a live, unexpired code owned by this user + platform.
    const record = await ctx.runQuery(internal.linkedProfiles.getBioByCode, { code });
    if (
      !record ||
      record.userId !== args.userId ||
      record.platform !== args.platform
    ) {
      throw new Error("Invalid code. Request a new one and try again.");
    }
    if (Date.now() - record.createdAt > BIO_CODE_EXPIRY_MS) {
      throw new Error("This code has expired. Request a new one.");
    }

    // 3. Fetch the public profile and confirm the code is in the page.
    let pageText: string;
    try {
      const res = await fetch(args.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      pageText = await res.text();
    } catch {
      throw new Error(
        "Couldn't open your profile. Make sure the link is correct and the profile is public, then try again.",
      );
    }

    if (!pageText.toUpperCase().includes(code)) {
      throw new Error(
        `Code ${code} wasn't found in your bio yet. Add it to your ${args.platform} bio, save, wait a moment, then tap Verify.`,
      );
    }

    // 4. Persist atomically (delete code, enforce global uniqueness, insert).
    return await ctx.runMutation(internal.linkedProfiles.finalizeLink, {
      userId: args.userId,
      code,
      url: args.url,
      platform: args.platform,
      usernameSnapshot: args.usernameSnapshot,
    });
  },
});

export const finalizeLink = internalMutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    url: v.string(),
    platform: v.string(),
    usernameSnapshot: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("bioCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!record || record.userId !== args.userId) {
      throw new Error("Invalid or expired code");
    }
    await ctx.db.delete(record._id);

    const normalizedUrl = normalizeUrl(args.url);
    const existing = await ctx.db
      .query("linkedProfiles")
      .withIndex("by_normalizedUrl", (q) => q.eq("normalizedUrl", normalizedUrl))
      .unique();
    if (existing) {
      throw new Error("This profile is already linked to another account");
    }

    const lockedUntil = Date.now() + PROFILE_LOCK_DAYS * 24 * 60 * 60 * 1000;
    const id = await ctx.db.insert("linkedProfiles", {
      userId: args.userId,
      platform: args.platform,
      url: args.url,
      usernameSnapshot: args.usernameSnapshot,
      verifiedAt: Date.now(),
      lockedUntil,
      normalizedUrl,
    });
    return { profileId: id, lockedUntil };
  },
});

export const purgeBioCode = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const record = await ctx.db
      .query("bioCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (record) {
      await ctx.db.delete(record._id);
    }
  },
});

export const listMyProfiles = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("linkedProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const isProfileLocked = query({
  args: { profileId: v.id("linkedProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");
    return { locked: Date.now() < profile.lockedUntil, lockedUntil: profile.lockedUntil };
  },
});
