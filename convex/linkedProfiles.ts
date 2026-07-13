import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";

const PROFILE_LOCK_DAYS = 30;

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const codes = new Map<string, { platform: string; userId: string; createdAt: number }>();

export const requestBioCode = mutation({
  args: { userId: v.id("users"), platform: v.string() },
  handler: async (ctx, { userId, platform }) => {
    await requireUser(ctx, userId);
    const code = generateCode();
    codes.set(code, { platform, userId, createdAt: Date.now() });
    setTimeout(() => codes.delete(code), 15 * 60 * 1000);
    return code;
  },
});

export const verifyBioCode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    url: v.string(),
    platform: v.string(),
    usernameSnapshot: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    const record = codes.get(args.code);
    if (!record || record.userId !== args.userId || record.platform !== args.platform) {
      throw new Error("Invalid or expired code");
    }
    codes.delete(args.code);

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
