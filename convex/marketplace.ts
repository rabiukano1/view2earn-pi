import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";
import { sanitizeProfileUrl } from "@view2earn/core";
import { appendLedger, lastBalance } from "./lib/ledger";

export const listListings = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("marketplaceListings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();
  },
});

export const myListings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    return await ctx.db
      .query("marketplaceListings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createListing = mutation({
  args: {
    userId: v.id("users"),
    platform: v.string(),
    targetUrl: v.string(),
    pointsReward: v.number(),
    maxCompletions: v.number(),
    steps: v.optional(v.array(v.object({
      action: v.string(),
      label: v.string(),
      targetUrl: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const { economy } = await requireUserAndEconomy(ctx, args.userId);
    if (args.pointsReward < 10) throw new Error("Minimum reward is 10 points");
    if (args.maxCompletions < 1 || args.maxCompletions > 100)
      throw new Error("Completions must be between 1–100");

    // A1: sanitize + allowlist the target URL against the chosen platform's
    // profile hosts (AdMob §3 content moderation). Rejects off-platform,
    // non-http(s), or scriptable URLs before they ever reach the admin queue.
    const { url: cleanTargetUrl, handle } = sanitizeProfileUrl(args.platform, args.targetUrl);

    // If it's a MULTI_TASK, we should also sanitize/validate the video URL in the steps,
    // but for now we just trust the caller since it goes to admin review anyway.
    
    const listingFee = args.pointsReward * args.maxCompletions;

    const balance = await lastBalance(ctx, args.userId, economy);
    if (balance < listingFee)
      throw new Error(`Insufficient points. Need ${listingFee}, have ${balance}`);

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const taskId = await ctx.db.insert("tasks", {
      type: args.steps && args.steps.length > 0 ? "MULTI_TASK" : "FOLLOW_PAGE",
      platform: args.platform,
      targetUrl: cleanTargetUrl,
      name: handle,
      points: args.pointsReward,
      verifier: "screenshot-ai",
      maxCompletions: args.maxCompletions,
      creatorUserId: args.userId,
      status: "pending_approval",
      expiresAt,
      steps: args.steps,
    });

    const listingId = await ctx.db.insert("marketplaceListings", {
      userId: args.userId,
      taskId,
      platform: args.platform,
      targetUrl: cleanTargetUrl,
      pointsReward: args.pointsReward,
      listingFee,
      maxCompletions: args.maxCompletions,
      completionsSoFar: 0,
      status: "pending_approval",
      expiresAt,
    });

    const balanceAfter = await appendLedger(
      ctx,
      args.userId,
      economy,
      -listingFee,
      "MARKETPLACE_LISTING",
      listingId,
    );

    return { listingId, taskId, balanceAfter };
  },
});

export const cancelListing = mutation({
  args: {
    userId: v.id("users"),
    listingId: v.id("marketplaceListings"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.userId !== args.userId) throw new Error("Not your listing");

    const { economy } = await requireUserAndEconomy(ctx, args.userId);
    const unused = listing.maxCompletions - listing.completionsSoFar;
    const refund = unused * listing.pointsReward;

    await ctx.db.patch(args.listingId, { status: "cancelled" });
    await ctx.db.patch(listing.taskId, { status: "expired" });

    if (refund > 0) {
      await appendLedger(ctx, args.userId, economy, refund, "MARKETPLACE_REFUND", args.listingId);
    }

    return { refund };
  },
});
