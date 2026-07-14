import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";

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
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.userId);
    if (args.pointsReward < 10) throw new Error("Minimum reward is 10 points");
    if (args.maxCompletions < 1 || args.maxCompletions > 100)
      throw new Error("Completions must be between 1–100");
    if (!args.targetUrl) throw new Error("Profile URL is required");

    const listingFee = args.pointsReward * args.maxCompletions;

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    const balance = last?.balanceAfter ?? 0;
    if (balance < listingFee)
      throw new Error(`Insufficient points. Need ${listingFee}, have ${balance}`);

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const taskId = await ctx.db.insert("tasks", {
      type: "FOLLOW_PAGE",
      platform: args.platform,
      targetUrl: args.targetUrl,
      points: args.pointsReward,
      verifier: "screenshot-ai",
      maxCompletions: args.maxCompletions,
      creatorUserId: args.userId,
      status: "active",
      expiresAt,
    });

    const listingId = await ctx.db.insert("marketplaceListings", {
      userId: args.userId,
      taskId,
      platform: args.platform,
      targetUrl: args.targetUrl,
      pointsReward: args.pointsReward,
      listingFee,
      maxCompletions: args.maxCompletions,
      completionsSoFar: 0,
      status: "active",
      expiresAt,
    });

    const balanceAfter = balance - listingFee;
    await ctx.db.insert("pointsLedger", {
      userId: args.userId,
      delta: -listingFee,
      reason: "MARKETPLACE_LISTING",
      refId: listingId,
      balanceAfter,
    });

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

    const unused = listing.maxCompletions - listing.completionsSoFar;
    const refund = unused * listing.pointsReward;

    await ctx.db.patch(args.listingId, { status: "cancelled" });
    await ctx.db.patch(listing.taskId, { status: "expired" });

    if (refund > 0) {
      const last = await ctx.db
        .query("pointsLedger")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .first();
      const balanceAfter = (last?.balanceAfter ?? 0) + refund;
      await ctx.db.insert("pointsLedger", {
        userId: args.userId,
        delta: refund,
        reason: "MARKETPLACE_REFUND",
        refId: args.listingId,
        balanceAfter,
      });
    }

    return { refund };
  },
});
