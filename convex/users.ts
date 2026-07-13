import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Dev-only identity until Sidra auth lands (plan §7.1): one user per device
// fingerprint, stored as externalUid "dev:<fingerprint>".
export const getOrCreateDevUser = mutation({
  args: { deviceFingerprint: v.string() },
  handler: async (ctx, args) => {
    const externalUid = `dev:${args.deviceFingerprint}`;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", externalUid))
      .unique();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("users", {
      ecosystem: "SIDRA",
      externalUid,
      username: `dev-${args.deviceFingerprint.slice(0, 8)}`,
      tier: 0,
      fraudScore: 0,
      deviceFingerprint: args.deviceFingerprint,
      signupIp: "dev",
      country: "dev",
    });
  },
});

// Live points balance = balanceAfter of the latest ledger entry.
export const balance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    return last?.balanceAfter ?? 0;
  },
});
