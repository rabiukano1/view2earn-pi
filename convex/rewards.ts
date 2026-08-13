import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser, requireEconomy, requireUserAndEconomy } from "./lib/guards";
import { enforceRateLimit } from "./lib/ratelimit";
import { appendLedger, lastBalance, economyOfUser } from "./lib/ledger";

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
      .map((i) => ({
        ...i,
        name: i.name.replace(/₦/g, ""),
      }))
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
    paidWith: v.optional(v.union(v.literal("POINTS"), v.literal("PIPRO"))),
    clientIp: v.optional(v.string()),
  },
  handler: async (ctx, { userId, catalogId, phoneNumber, paidWith = "POINTS", clientIp }) => {
    // Airtime & Data redemption is a Pi-Browser-economy privilege ONLY.
    // The Android economy has no cash-out path (no cross-redemption).
    await requireEconomy(ctx, userId, "pi-browser");
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
    if (!/^[0-9+\s-]{6,20}$/.test(phoneNumber.trim())) {
      throw new Error("Enter a valid phone number");
    }

    let redemptionId;
    let balanceAfter = 0;

    if (paidWith === "PIPRO") {
      // Fetch exchange rate or default to 1000
      const rateDoc = await ctx.db.query("exchangeRates").order("desc").first();
      const pointsPerPipro = rateDoc?.pointsPerPipro ?? 1000;
      const coinPrice = item.coinPrice ?? ((item.pointsPrice ?? 500) / pointsPerPipro);

      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const piproBal = wallet?.piproBalance ?? 0;
      if (piproBal < coinPrice) {
        throw new Error(`Insufficient PIPRO balance. Required: ${coinPrice.toFixed(4)} PIPRO`);
      }

      redemptionId = await ctx.db.insert("redemptions", {
        userId,
        economy: "pi-browser",
        catalogId,
        paidWith: "PIPRO",
        amount: coinPrice,
        phoneNumber: phoneNumber.trim(),
        status: "processing",
      });

      const newPiproBal = piproBal - coinPrice;
      if (wallet) {
        await ctx.db.patch(wallet._id, { piproBalance: newPiproBal });
      } else {
        await ctx.db.insert("wallets", {
          userId,
          pointsBalance: 0,
          piproBalance: newPiproBal,
        });
      }

      await ctx.db.insert("walletTransactions", {
        userId,
        type: "buy_vas_pipro",
        pointsDelta: 0,
        piproDelta: -coinPrice,
        pointsBalanceAfter: wallet?.pointsBalance ?? 0,
        piproBalanceAfter: newPiproBal,
        note: `Purchased ${item.name} with PIPRO`,
      });

      balanceAfter = newPiproBal;
    } else {
      // Paid with POINTS — points are drawn ONLY from the pi-browser economy
      // ledger (requireEconomy above already asserted pi-browser).
      const price = item.pointsPrice;
      if (price === undefined) throw new Error("Reward not redeemable with points");

      const balance = await lastBalance(ctx, userId, "pi-browser");
      if (balance < price) throw new Error("Insufficient points");

      redemptionId = await ctx.db.insert("redemptions", {
        userId,
        economy: "pi-browser",
        catalogId,
        paidWith: "POINTS",
        amount: price,
        phoneNumber: phoneNumber.trim(),
        status: "processing",
      });

      balanceAfter = await appendLedger(
        ctx,
        userId,
        "pi-browser",
        -price,
        "REDEEM",
        redemptionId,
      );
    }

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

    if (r.paidWith === "PI") {
      // Pi purchases are refunded by cancelling the Pi payment (done by the
      // approveAndFulfill action); the Pi network returns the funds. The user
      // paid no points here, so there is no ledger entry to reverse.
      return;
    }

    if (r.paidWith === "PIPRO") {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", r.userId))
        .unique();
      if (wallet) {
        const newBal = wallet.piproBalance + r.amount;
        await ctx.db.patch(wallet._id, { piproBalance: newBal });
        await ctx.db.insert("walletTransactions", {
          userId: r.userId,
          type: "refund_vas_pipro",
          pointsDelta: 0,
          piproDelta: r.amount,
          pointsBalanceAfter: wallet.pointsBalance,
          piproBalanceAfter: newBal,
          note: `Refund for failed redemption: ${reason ?? "Failed"}`,
        });
      }
    } else {
      await ctx.runMutation(internal.points.creditHelper, {
        userId: r.userId,
        economy: r.economy ?? "pi-browser",
        delta: r.amount,
        reason: reason ?? "REFUND_REDEMPTION_FAILED",
        refId: `refund:${redemptionId}`,
      });
    }
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
    const { user, economy } = await requireUserAndEconomy(ctx, userId);

    const balance = await lastBalance(ctx, userId, economy);

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

export const applyReferralCode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, { userId, code }) => {
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.referredBy) {
      throw new Error("You have already applied a referral code.");
    }

    const cleanCode = code.trim().toUpperCase().replace(/^V2E-/, "");
    if (!cleanCode) throw new Error("Please enter a valid referral code.");

    const allUsers = await ctx.db.query("users").collect();
    const referrer = allUsers.find(
      (u) =>
        u._id.toUpperCase().endsWith(cleanCode) ||
        (u.username && u.username.toUpperCase() === cleanCode)
    );

    if (!referrer) {
      throw new Error("Invalid referral code. No Pioneer found with this code.");
    }

    if (referrer._id === userId) {
      throw new Error("You cannot use your own referral code.");
    }

    // Record referral
    const referralId = await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      refereeId: userId,
      qualifiedAt: Date.now(),
      rewarded: true,
    });

    await ctx.db.patch(userId, { referredBy: referrer._id });

    // Credit referee bonus (+100 PTS) into the referee's own economy.
    await appendLedger(ctx, userId, economy, 100, "REFERRAL_WELCOME_BONUS", referralId);

    // Credit referrer bonus (+250 PTS) into the referrer's own economy.
    await appendLedger(
      ctx,
      referrer._id,
      await economyOfUser(ctx, referrer._id),
      250,
      "REFERRAL_QUALIFIED_BONUS",
      referralId,
    );

    return {
      success: true,
      referrerName: referrer.username ?? referrer.name ?? "Pioneer",
      bonusPoints: 100,
    };
  },
});

// Dev seed so the Rewards screen has items before providers are wired.
// coinPrice = amount of Pi (π) required to buy the bundle (plan §7.8 purchase).
const CATALOG_SEED = [
  { itemType: "DATA", name: "1GB Data Bundle", pointsPrice: 500, coinPrice: 1.5, providerSku: "data-1gb" },
  { itemType: "DATA", name: "2GB Data Bundle", pointsPrice: 900, coinPrice: 2.5, providerSku: "data-2gb" },
  { itemType: "DATA", name: "5GB Data Bundle", pointsPrice: 2000, coinPrice: 5, providerSku: "data-5gb" },
  { itemType: "AIRTIME", name: "100 Airtime Top-Up", pointsPrice: 300, coinPrice: 0.8, providerSku: "air-100" },
  { itemType: "AIRTIME", name: "200 Airtime Top-Up", pointsPrice: 550, coinPrice: 1.5, providerSku: "air-200" },
  { itemType: "AIRTIME", name: "500 Airtime Top-Up", pointsPrice: 1200, coinPrice: 3, providerSku: "air-500" },
] as const;

export const seedCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("catalog").collect();
    if (existing.length > 0) {
      // Update any existing seeded items that contain ₦ symbol, and backfill
      // coinPrice for seeded items that predate Pi purchases.
      for (const item of existing) {
        const patch: Record<string, string | number> = {};
        if (item.name.includes("₦")) patch.name = item.name.replace("₦", "");
        if (item.coinPrice === undefined) {
          const seed = CATALOG_SEED.find((s) => s.providerSku === item.providerSku);
          if (seed) patch.coinPrice = seed.coinPrice;
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(item._id, patch);
        }
      }
      return "updated existing catalog items";
    }
    for (const eco of ["SIDRA", "PI"] as const) {
      for (const item of CATALOG_SEED) {
        await ctx.db.insert("catalog", {
          ecosystem: eco,
          itemType: item.itemType,
          name: item.name,
          pointsPrice: item.pointsPrice,
          coinPrice: item.coinPrice,
          providerSku: item.providerSku,
          countries: ["GLOBAL"],
          enabled: true,
        });
      }
    }
    return `seeded ${CATALOG_SEED.length * 2} catalog items`;
  },
});
