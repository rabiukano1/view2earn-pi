import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// AdMob rewarded Server-Side Verification (SSV).
// https://developers.google.com/admob/android/ssv
//
// Why: `ads.rewardForAd` credits points as soon as the CLIENT says the ad was
// watched. A modified client can claim that without watching anything. SSV is
// Google's fix — their servers call us directly, signed, when a reward is
// genuinely earned.
//
// How this is wired:
//   1. RewardedAdModal attaches { userId, customData: <nonce> } to the request.
//   2. The client credit (rewardForAd) records that nonce, unverified.
//   3. Google calls /admob/ssv; we verify the signature and mark it verified.
//   4. reconcileAdmobRewards (cron) flags credits that never got a callback.
//
// The client credit is kept so the user is not left waiting on a network
// round trip, but it is now auditable rather than taken on trust.

export const SSV_UNVERIFIED_GRACE_MS = 15 * 60 * 1000;

/** Record a client-side reward claim awaiting Google's callback. */
export const recordClientClaim = internalMutation({
  args: {
    userId: v.id("users"),
    nonce: v.string(),
    adType: v.string(),
    points: v.number(),
  },
  handler: async (ctx, { userId, nonce, adType, points }) => {
    if (!nonce) return;
    await ctx.db.insert("admobRewards", {
      userId,
      nonce,
      adType,
      points,
      verified: false,
      claimedAt: Date.now(),
    });
  },
});

/**
 * Mark a claim verified from Google's callback. Replay-protected on
 * transactionId: Google can retry, and a retry must not count twice.
 */
export const markVerified = internalMutation({
  args: {
    nonce: v.string(),
    transactionId: v.string(),
    userId: v.optional(v.string()),
    rewardAmount: v.optional(v.number()),
  },
  handler: async (ctx, { nonce, transactionId, userId, rewardAmount }) => {
    const dup = await ctx.db
      .query("admobRewards")
      .withIndex("by_transaction", (q) => q.eq("transactionId", transactionId))
      .first();
    if (dup) return { ok: true, duplicate: true };

    const row = await ctx.db
      .query("admobRewards")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .first();

    if (row) {
      await ctx.db.patch(row._id, {
        verified: true,
        transactionId,
        verifiedAt: Date.now(),
        rewardAmount,
      });
      return { ok: true, duplicate: false };
    }

    // Callback arrived before (or without) a client claim. Record it only when
    // the user id is a real one — AdMob's "Verify URL" test sends placeholder
    // ids, and inserting those would throw and fail Google's verification.
    const owner = userId ? await ctx.db.get(userId as Id<"users">).catch(() => null) : null;
    if (!owner) return { ok: true, duplicate: false, orphan: true, stored: false };

    await ctx.db.insert("admobRewards", {
      userId: owner._id,
      nonce,
      adType: "unknown",
      points: 0,
      verified: true,
      transactionId,
      claimedAt: Date.now(),
      verifiedAt: Date.now(),
      rewardAmount,
    });
    return { ok: true, duplicate: false, orphan: true, stored: true };
  },
});

/**
 * Credits that never received a Google callback are the signal that someone is
 * faking rewards. We do not auto-reverse points (a dropped callback would
 * punish an honest user); we raise a fraud event, which feeds the existing
 * score and forces verification on that account.
 */
export const reconcileAdmobRewards = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SSV_UNVERIFIED_GRACE_MS;
    const stale = await ctx.db
      .query("admobRewards")
      .withIndex("by_verified_claimedAt", (q) =>
        q.eq("verified", false).lt("claimedAt", cutoff),
      )
      .take(200);

    let flagged = 0;
    for (const row of stale) {
      await ctx.db.patch(row._id, { reconciled: true });
      await ctx.db.insert("fraudEvents", {
        userId: row.userId,
        type: "admob-ssv-missing",
        detailsJson: JSON.stringify({
          nonce: row.nonce,
          adType: row.adType,
          points: row.points,
          claimedAt: row.claimedAt,
        }),
      });
      flagged++;
    }
    return { scanned: stale.length, flagged };
  },
});

export const unverifiedCount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("admobRewards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((r) => !r.verified).length;
  },
});
