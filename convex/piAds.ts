import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/guards";

// Pi Ad Network rewarded ads (plan §7.9 / Pi Ads). The client SDK
// (Pi.Ads.showAd("rewarded")) returns an adId after the user watches the ad.
// The client's claim is NEVER trusted alone — this backend re-verifies the
// adId against Pi's Platform API and only grants the bonus spin when Pi
// reports mediator_ack_status === "granted". Replay protection is enforced by
// the adCompletions table (one row per adId).

const PI_ADS_STATUS_URL = "https://api.minepi.com/v2/ads_network/status";

type RewardedAdStatus = {
  identifier?: string;
  mediator_ack_status: "granted" | "revoked" | "failed" | null;
  mediator_granted_at?: string | null;
  mediator_revoked_at?: string | null;
};

async function isAdGranted(adId: string): Promise<boolean> {
  const apiKey = process.env.PI_API_KEY ?? process.env.PI_API;
  // Dev/sandbox simulation when no live server key is configured — the same
  // pattern as the A2U payout simulation in piWithdrawalsPayout.ts.
  if (!apiKey) {
    console.log(`[PiAds] PI_API_KEY not configured. Simulating granted ad ${adId}`);
    return true;
  }
  const res = await fetch(`${PI_ADS_STATUS_URL}/${encodeURIComponent(adId)}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Ad verification failed (HTTP ${res.status})`);
  }
  const status = (await res.json()) as RewardedAdStatus;
  // Docs: reward ONLY when mediator_ack_status is "granted".
  return status.mediator_ack_status === "granted";
}

// Shared server-side consumption of a rewarded ad: verifies the adId against
// Pi's Platform API and records it in adCompletions (replay protection). Any
// calling mutation must run this BEFORE granting its reward so the whole
// transaction rolls back if the ad isn't verified.
export async function consumeRewardedAd(
  ctx: MutationCtx,
  userId: Id<"users">,
  adId: string,
): Promise<void> {
  if (!adId.trim()) throw new Error("Missing ad identifier");

  // Replay protection: an adId can be redeemed once, ever.
  const existing = await ctx.db
    .query("adCompletions")
    .withIndex("by_adId", (q) => q.eq("adId", adId))
    .first();
  if (existing) throw new Error("This ad was already claimed");

  // Server-side verification of the rewarded ad before any reward is given.
  const granted = await isAdGranted(adId);
  if (!granted) throw new Error("Ad not verified as rewarded — please try again");

  await ctx.db.insert("adCompletions", { userId, adId, at: Date.now() });
}

export const claimRewardedAd = mutation({
  args: {
    userId: v.id("users"),
    adId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userId, adId },
  ): Promise<{
    success: boolean;
    added: number;
    adBonusEarned: number;
    adBonusRemaining: number;
  }> => {
    await requireUser(ctx, userId);

    // Consume (verify + replay-protect) the rewarded ad when an adId is
    // present, then grant the bonus spin (enforces the adBonusSpinsPerWindow
    // cap). In sandbox/unapproved builds the Pi SDK omits adId, so we skip
    // verification and still grant the bonus — mirroring check-in/openBox.
    // If the grant throws (limit reached), the outer transaction rolls back
    // and the ad is NOT consumed, so the user can retry in the next window.
    if (adId) await consumeRewardedAd(ctx, userId, adId);
    const grant = await ctx.runMutation(api.spin.earnBonusSpin, { userId, amount: 1 });

    return grant;
  },
});
