import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireUser } from "./lib/guards";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getNum } from "./rewardsConfig";

// Qualified referral flow (plan §7.7):
//   1. User A signs up → gets deterministic referral code V2E-XXXXXX
//   2. User B signs up and enters A's code → applyReferralCode creates referral row
//   3. User B completes N released tasks → checkQualification fires, rewards both

// ---------------------------------------------------------------------------
// Resolve a referral code to a user ID. Codes are deterministic: V2E-<last 6
// chars of the Convex user _id, uppercased>. Since IDs are unique the suffix
// is effectively unique at our scale.
// ---------------------------------------------------------------------------
export const resolveCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const match = code.trim().toUpperCase().match(/^V2E-([A-Z0-9]{6})$/);
    if (!match) return { valid: false as const, referrerId: null };

    const suffix = match[1].toLowerCase();

    // Scan users — the code embeds the trailing 6 chars of the _id. IDs are
    // URL-safe base-64, so we compare case-insensitively. In production with
    // many users this should be an index; at current scale a collect is fine.
    const users = await ctx.db.query("users").collect();
    const referrer = users.find(
      (u) => u._id.slice(-6).toLowerCase() === suffix,
    );
    if (!referrer) return { valid: false as const, referrerId: null };
    return { valid: true as const, referrerId: referrer._id };
  },
});

// ---------------------------------------------------------------------------
// Apply a referral code to the currently signed-in user. Called once right
// after signup. Creates the referrals row and stamps referredBy on the user.
// ---------------------------------------------------------------------------
export const applyReferralCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Already referred — no-op (idempotent).
    if (user.referredBy) return { ok: false, reason: "already_referred" };

    // Resolve the code.
    const match = code.trim().toUpperCase().match(/^V2E-([A-Z0-9]{6})$/);
    if (!match) return { ok: false, reason: "invalid_code" };

    const suffix = match[1].toLowerCase();
    const users = await ctx.db.query("users").collect();
    const referrer = users.find(
      (u) => u._id.slice(-6).toLowerCase() === suffix,
    );
    if (!referrer) return { ok: false, reason: "invalid_code" };

    // Cannot self-refer.
    if (referrer._id === userId) return { ok: false, reason: "self_refer" };

    // Already a referral row for this referee? (belt-and-suspenders).
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referee", (q) => q.eq("refereeId", userId))
      .first();
    if (existing) return { ok: false, reason: "already_referred" };

    // Record the referral.
    await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      refereeId: userId,
      rewarded: false,
    });
    await ctx.db.patch(userId, { referredBy: referrer._id });

    return { ok: true, reason: null };
  },
});

// ---------------------------------------------------------------------------
// Check whether a user just qualified a referral (called when a verification
// reaches RELEASED). Idempotent — only rewards once.
// ---------------------------------------------------------------------------
export const checkQualification = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Does this user have an unrewarded referral?
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_referee", (q) => q.eq("refereeId", userId))
      .first();
    if (!referral || referral.rewarded) return;

    // Count released verifications for this user.
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const released = verifications.filter((v) => v.state === "RELEASED").length;
    const qualTasks = await getNum(ctx, "referralQualificationTasks");
    if (released < qualTasks) return;

    // Fraud check: referee's fraud score must be clean.
    const referee = await ctx.db.get(userId);
    if (!referee || referee.fraudScore >= 50) return;

    // Fraud guard: device-cluster overlap between referrer and referee. If they
    // share a fingerprint on the same platform it's a clone/farm — no reward.
    const refereeSignals = await ctx.db
      .query("deviceSignals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const referrerSignals = await ctx.db
      .query("deviceSignals")
      .withIndex("by_user", (q) => q.eq("userId", referral.referrerId))
      .collect();

    const refereeHashes = new Set(
      refereeSignals.map((s) => `${s.platform}:${s.canvasHash}`).filter(Boolean),
    );
    const overlap = referrerSignals.some(
      (s) => s.canvasHash && refereeHashes.has(`${s.platform}:${s.canvasHash}`),
    );

    if (overlap) {
      // Log fraud event but do NOT reward.
      await ctx.db.insert("fraudEvents", {
        userId,
        type: "referral-device-overlap",
        detailsJson: JSON.stringify({
          referrerId: referral.referrerId,
          refereeId: userId,
        }),
      });
      // Mark as rewarded to prevent re-checking.
      await ctx.db.patch(referral._id, { rewarded: true });
      return;
    }

    // --- All checks passed — reward both users ---
    const now = Date.now();
    await ctx.db.patch(referral._id, {
      qualifiedAt: now,
      rewarded: true,
    });

    const referrerBonus = await getNum(ctx, "referralQualifiedBonus");
    const refereeBonus = await getNum(ctx, "referralRefereeBonus");

    // Referrer gets referralQualifiedBonus points.
    await ctx.runMutation(internal.points.creditHelper, {
      userId: referral.referrerId,
      delta: referrerBonus,
      reason: "Qualified referral reward",
      refId: `referral:${referral._id}:referrer`,
    });

    // Referee gets a smaller bonus.
    await ctx.runMutation(internal.points.creditHelper, {
      userId,
      delta: refereeBonus,
      reason: "Referral welcome bonus",
      refId: `referral:${referral._id}:referee`,
    });
  },
});
