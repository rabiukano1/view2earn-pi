import { internalMutation } from "./_generated/server";
import { computeFraudScore } from "@view2earn/core";

// Fraud scoring (plan §7.9). Recomputes users.fraudScore from stored signals so
// verifications.shouldVerify's `fraudScore >= 50` branch actually fires. Call
// recomputeUserScore wherever a signal changes; the daily cron catches the rest.

const FRAUD_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // matches verifications.ts

// Plain helper (like lib/guards.requireUser) so callers recompute inline within
// their own transaction — no cross-function mutation hop.
export async function recomputeUserScore(ctx: any, userId: any): Promise<void> {
  const cutoff = Date.now() - FRAUD_LOOKBACK_MS;

  const events = await ctx.db
    .query("fraudEvents")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const fraudEvents = events.filter((e: any) => e._creationTime >= cutoff).length;

  const verifs = await ctx.db
    .query("verifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  let released = 0;
  let rejected = 0;
  let cancelled = 0;
  for (const v of verifs) {
    if (v.state === "RELEASED") released++;
    else if (v.state === "REJECTED") rejected++;
    else if (v.state === "CANCELLED") cancelled++;
  }

  const score = computeFraudScore({ fraudEvents, rejected, released, cancelled });
  const user = await ctx.db.get(userId);
  if (user && user.fraudScore !== score) {
    await ctx.db.patch(userId, { fraudScore: score });
  }
}

// Daily sweep so scores decay as old events age out of the lookback window.
// ponytail: full-table scan; move to incremental/event-driven if the user
// count makes a daily O(users × rows) pass too heavy.
export const recomputeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await recomputeUserScore(ctx, user._id);
    }
  },
});
