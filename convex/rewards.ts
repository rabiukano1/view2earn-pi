import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";

// User-facing rewards catalog + redemption flow (plan §6).
// Points are debited through the append-only pointsLedger, same as credits.

export const listCatalog = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return [];
    const items = await ctx.db
      .query("catalog")
      .withIndex("by_ecosystem", (q) => q.eq("ecosystem", user.ecosystem))
      .collect();
    return items
      .filter((i) => i.enabled && i.pointsPrice !== undefined)
      .sort((a, b) => (a.pointsPrice ?? 0) - (b.pointsPrice ?? 0));
  },
});

export const listMyRedemptions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("redemptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return Promise.all(
      rows.map(async (r) => {
        const item = await ctx.db.get(r.catalogId);
        return {
          _id: r._id,
          name: item?.name ?? "Reward",
          amount: r.amount,
          status: r.status,
          phoneNumber: r.phoneNumber,
          at: r._creationTime,
        };
      }),
    );
  },
});

import { checkIpReputation, recordIpFraudSignal } from "./ipReputation";

export const redeem = mutation({
  args: {
    userId: v.id("users"),
    catalogId: v.id("catalog"),
    phoneNumber: v.string(),
    clientIp: v.optional(v.string()),
  },
  handler: async (ctx, { userId, catalogId, phoneNumber, clientIp }) => {
    await requireUser(ctx, userId);
    await enforceRateLimit(ctx, userId, "redeem");

    // IP Reputation & VPN Restriction Check (Fraud Layer 3)
    if (clientIp) {
      const ipInfo = await checkIpReputation(clientIp);
      await recordIpFraudSignal(ctx, userId, ipInfo);
      if (ipInfo.isVpn || ipInfo.isProxy || ipInfo.riskScore >= 75) {
        throw new Error("VPN or Proxy connection detected. Please disconnect VPN to process airtime/data redemptions.");
      }
    }

    const item = await ctx.db.get(catalogId);
    if (!item || !item.enabled) throw new Error("Reward unavailable");
    const price = item.pointsPrice;
    if (price === undefined) throw new Error("Reward not redeemable with points");
    if (!/^[0-9+\s-]{6,20}$/.test(phoneNumber.trim())) {
      throw new Error("Enter a valid phone number");
    }

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const balance = last?.balanceAfter ?? 0;
    if (balance < price) throw new Error("Insufficient points");

    const redemptionId = await ctx.db.insert("redemptions", {
      userId,
      catalogId,
      paidWith: "points",
      amount: price,
      phoneNumber: phoneNumber.trim(),
      status: "processing",
    });

    const balanceAfter = balance - price;
    await ctx.db.insert("pointsLedger", {
      userId,
      delta: -price,
      reason: "REDEEM",
      refId: redemptionId,
      balanceAfter,
    });

    // Schedule automated VAS Airtime & Data fulfillment
    await ctx.scheduler.runAfter(0, internal.vas.fulfill, { redemptionId });

    return { redemptionId, balanceAfter };
  },
});

export const refundRedemption = internalMutation({
  args: {
    redemptionId: v.id("redemptions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { redemptionId, reason }) => {
    const r = await ctx.db.get(redemptionId);
    if (!r || r.status === "refunded") return;

    await ctx.db.patch(redemptionId, { status: "refunded" });

    await ctx.runMutation(internal.points.creditHelper, {
      userId: r.userId,
      delta: r.amount,
      reason: reason ?? "REFUND_REDEMPTION_FAILED",
      refId: `refund:${redemptionId}`,
    });
  },
});

export const markFulfilled = internalMutation({
  args: {
    redemptionId: v.id("redemptions"),
    providerRef: v.optional(v.string()),
  },
  handler: async (ctx, { redemptionId, providerRef }) => {
    const r = await ctx.db.get(redemptionId);
    if (!r) return;
    await ctx.db.patch(redemptionId, {
      status: "fulfilled",
      providerRef,
    });
  },
});

// Progress toward the next redeemable reward (plan §7.11b — "340 points from a
// 1GB bundle"). Targets the cheapest reward you can't yet afford; once you can
// afford everything, targets the cheapest and flags ready.
export const progressToNext = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const balance = last?.balanceAfter ?? 0;

    const items = (
      await ctx.db
        .query("catalog")
        .withIndex("by_ecosystem", (q) => q.eq("ecosystem", user.ecosystem))
        .collect()
    )
      .filter((i) => i.enabled && i.pointsPrice !== undefined)
      .sort((a, b) => (a.pointsPrice ?? 0) - (b.pointsPrice ?? 0));

    if (items.length === 0) return { balance, target: null, ready: false };

    const locked = items.find((i) => (i.pointsPrice ?? 0) > balance);
    const target = locked ?? items[0];
    return {
      balance,
      target: { name: target.name, pointsPrice: target.pointsPrice ?? 0 },
      ready: !locked,
    };
  },
});

// Deterministic referral code + rich stats for the Profile referral card.
export const myReferral = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const referred = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .collect();
    const code = `V2E-${userId.slice(-6).toUpperCase()}`;
    const qualifiedCount = referred.filter((r) => !!r.qualifiedAt).length;
    const totalEarned = qualifiedCount * 100; // REFERRAL_QUALIFIED constant

    // Who referred this user?
    const user = await ctx.db.get(userId);
    let referrerName: string | null = null;
    if (user?.referredBy) {
      const referrer = await ctx.db.get(user.referredBy);
      referrerName = referrer?.username ?? referrer?.name ?? null;
    }

    return {
      code,
      count: referred.length,
      qualifiedCount,
      totalEarned,
      referredBy: referrerName,
    };
  },
});

// Dev seed so the Rewards screen has items before providers are wired.
const CATALOG_SEED = [
  { itemType: "DATA", name: "1GB Data Bundle", pointsPrice: 500, providerSku: "data-1gb" },
  { itemType: "DATA", name: "2GB Data Bundle", pointsPrice: 900, providerSku: "data-2gb" },
  { itemType: "DATA", name: "5GB Data Bundle", pointsPrice: 2000, providerSku: "data-5gb" },
  { itemType: "AIRTIME", name: "₦100 Airtime", pointsPrice: 300, providerSku: "air-100" },
  { itemType: "AIRTIME", name: "₦200 Airtime", pointsPrice: 550, providerSku: "air-200" },
  { itemType: "AIRTIME", name: "₦500 Airtime", pointsPrice: 1200, providerSku: "air-500" },
] as const;

export const seedCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("catalog").take(1);
    if (existing.length > 0) return "already seeded";
    for (const eco of ["SIDRA", "PI"] as const) {
      for (const item of CATALOG_SEED) {
        await ctx.db.insert("catalog", {
          ecosystem: eco,
          itemType: item.itemType,
          name: item.name,
          pointsPrice: item.pointsPrice,
          providerSku: item.providerSku,
          countries: ["NG"],
          enabled: true,
        });
      }
    }
    return `seeded ${CATALOG_SEED.length * 2} catalog items`;
  },
});
