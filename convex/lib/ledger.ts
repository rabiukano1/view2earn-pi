import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { deriveEconomy, type Economy, type Surface } from "./guards";

// Shared economy-aware ledger helpers. Every earning/spending path writes and
// reads through these so the Android and Pi-Browser ledgers stay strictly
// separate and a ledger can never be driven negative by a spoofed/cross-economy
// request.

// Resolve a user's economy from their stored identity anchor (server-side),
// for internal mutations (postbacks, cron, admin) that have no client session.
export async function economyOfUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Surface> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return deriveEconomy(user);
}

// Latest balance for (userId, economy). Authoritative: balanceAfter of the
// newest row for that economy.
export async function lastBalance(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  economy: Economy,
): Promise<number> {
  const last = await ctx.db
    .query("pointsLedger")
    .withIndex("by_user_economy", (q) =>
      q.eq("userId", userId).eq("economy", economy),
    )
    .order("desc")
    .first();
  return last?.balanceAfter ?? 0;
}

// Append a ledger row for (userId, economy). Throws if the resulting balance
// would go negative. Returns the new balanceAfter.
export async function appendLedger(
  ctx: MutationCtx,
  userId: Id<"users">,
  economy: Economy,
  delta: number,
  reason: string,
  refId?: string,
): Promise<number> {
  const balanceAfter = (await lastBalance(ctx, userId, economy)) + delta;
  if (balanceAfter < 0) {
    throw new Error(`Insufficient ${economy} balance`);
  }
  await ctx.db.insert("pointsLedger", {
    userId,
    economy,
    delta,
    reason,
    refId,
    balanceAfter,
  });
  await bumpPointsTotal(ctx, delta);
  return balanceAfter;
}

/**
 * Running all-time totals for the admin dashboard. Replaying the whole ledger
 * on every dashboard load blew Convex's 32k-documents-per-query limit once the
 * ledger grew, so the totals are accumulated here instead (one extra small
 * read/write per ledger append) and read back in O(1).
 * Seed them for existing rows with `admin:backfillPointsTotals`.
 */
export const POINTS_ISSUED_KEY = "pointsIssuedTotal";
export const POINTS_SPENT_KEY = "pointsSpentTotal";

export async function bumpPointsTotal(ctx: MutationCtx, delta: number) {
  const key = delta >= 0 ? POINTS_ISSUED_KEY : POINTS_SPENT_KEY;
  const amount = Math.abs(delta);
  const row = await ctx.db
    .query("platformSettings")
    .filter((q) => q.eq(q.field("key"), key))
    .first();
  const next = (row ? Number(row.value) || 0 : 0) + amount;
  if (row) await ctx.db.patch(row._id, { value: String(next), updatedAt: Date.now() });
  else await ctx.db.insert("platformSettings", { key, value: String(next), updatedAt: Date.now() });
}
