import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Adsgram (Telegram Mini App ads) server-side reward verification.
//
// Adsgram's Reward URL carries only [userId] — the viewer's Telegram id. There
// is no per-impression token, so a claim cannot be matched to one exact ad the
// way AdMob's SSV customData allows. Instead each postback is stored as a
// single-use TICKET, and a reward claim consumes the most recent unconsumed
// ticket for that Telegram user. One ad therefore pays exactly one reward.
//
// Tickets expire: a claim must land close to the ad, or the ticket is ignored.
const TICKET_MAX_AGE_MS = 10 * 60 * 1000;

/** Written by the /adsgram/reward route when Adsgram reports a REWARD event. */
export const record = internalMutation({
  args: { telegramUserId: v.string() },
  handler: async (ctx, { telegramUserId }) => {
    await ctx.db.insert("adsgramRewards", { telegramUserId, at: Date.now() });
  },
});

/**
 * Consume a ticket for this viewer. Returns false when none is available, so
 * the caller can fall back to the allowRewardWithoutAd switch rather than
 * silently granting or silently refusing.
 */
export async function consumeTicket(
  ctx: MutationCtx,
  userId: Id<"users">,
  telegramUserId: string,
): Promise<boolean> {
  if (!telegramUserId) return false;
  const cutoff = Date.now() - TICKET_MAX_AGE_MS;

  const tickets = await ctx.db
    .query("adsgramRewards")
    .withIndex("by_tg_consumed", (q) =>
      q.eq("telegramUserId", telegramUserId).eq("consumedAt", undefined),
    )
    .order("desc")
    .take(5);

  const fresh = tickets.find((t) => t.at >= cutoff);
  if (!fresh) return false;

  await ctx.db.patch(fresh._id, { consumedAt: Date.now(), consumedBy: userId });
  return true;
}
