import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { compositeFingerprint } from "@view2earn/core";
import { recomputeUserScore } from "./fraud";

// Layer 2 device fingerprinting (plan §7.9). The client collects raw hardware
// signals; here we hash them and store one row per (user, device). canvasHash
// holds the fingerprint hash (web canvas / native composite — same role, shares
// the index).
//
// Identity is per-ecosystem, so one Pi + one Sidra account on the same phone is
// NORMAL — never flag across platforms. Only a SECOND account of the SAME
// platform (2+ Pi, or 2+ Sidra, on one device) is the clone/farm signal.

export const record = mutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("pi-web"), v.literal("sidra-mobile")),
    // Ordered parts the client wants fingerprinted (stable order = stable hash).
    fingerprintParts: v.array(v.string()),
    hardwareJson: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, { userId, platform, fingerprintParts, hardwareJson, timezone }) => {
    await requireUser(ctx, userId);
    const hash = compositeFingerprint(fingerprintParts);

    const withHash = await ctx.db
      .query("deviceSignals")
      .withIndex("by_canvasHash", (q) => q.eq("canvasHash", hash))
      .collect();

    // Already recorded this device for this user+platform — nothing new to do.
    if (withHash.some((s) => s.userId === userId && s.platform === platform)) return;

    await ctx.db.insert("deviceSignals", {
      userId,
      platform,
      canvasHash: hash,
      hardwareJson,
      ip: "unknown", // ponytail: real IP needs an httpAction (Layer 3, gated).
      timezone,
    });

    // Same device + same ecosystem already tied to other accounts → clone/farm.
    // Cross-platform accounts (Pi + Sidra) are legitimate and ignored here.
    const otherUsers = new Set(
      withHash
        .filter((s) => s.userId !== userId && s.platform === platform)
        .map((s) => s.userId),
    );
    if (otherUsers.size > 0) {
      await ctx.db.insert("fraudEvents", {
        userId,
        type: "device-cluster",
        detailsJson: JSON.stringify({ fingerprint: hash, sharedWith: otherUsers.size }),
      });
      await recomputeUserScore(ctx, userId);
    }
  },
});
