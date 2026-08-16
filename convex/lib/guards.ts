import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Just requires an authenticated session; returns the auth user id.
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) throw new Error("Not authenticated");
  return authUserId as string;
}

// Enforces that the caller is authenticated AND is acting as their own user —
// the client passes userId, but it must match the Convex Auth session. This is
// the trust boundary: it stops a client from acting as anyone else.
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"users">> {
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) throw new Error("Not authenticated");
  if (authUserId !== userId) throw new Error("Unauthorized");
  const userDoc = await ctx.db.get(userId as any) as Doc<"users"> | null;
  if (!userDoc) throw new Error("User not found");
  if (userDoc.accountStatus === "suspended") throw new Error("ACCOUNT_SUSPENDED");
  return userDoc;
}

// Safe optional user lookup for queries during session refresh / token expiration.
export async function getOptionalUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"users"> | null> {
  try {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId || authUserId !== userId) return null;
    const user = await ctx.db.get(userId as any);
    return (user as Doc<"users">) ?? null;
  } catch {
    return null;
  }
}

export async function requireEcosystem(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  ecosystem: "PI" | "SIDRA",
): Promise<Doc<"users">> {
  const user = await requireUser(ctx, userId);
  if (user.ecosystem !== ecosystem) {
    throw new Error("Wrong ecosystem");
  }
  return user;
}

export async function requireTier(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  minTier: number,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx, userId);
  if (user.tier < minTier) {
    throw new Error(`Tier ${minTier} required`);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Two-economy enforcement (ONE verified user, TWO separate earning economies).
//
// Economy is DERIVED SERVER-SIDE from the user's identity anchor — never from
// a client-supplied argument. This is the trust boundary: a malicious client
// cannot flip "android" → "pi-browser" (TEST 6) because the economy comes from
// the user row, which is only ever set by the verified sign-in flow (auth.ts /
// PiProvider), not by the request payload.
//
//   "pi-browser" — identity anchored to a Pi account (externalUid "pi:<uid>").
//                  Redeemable for Pi / Airtime / Data.
//   "android"     — identity anchored to email/Telegram/Sidra (private PTS).
//                  Never withdrawable.
// ---------------------------------------------------------------------------

export type Economy = "android" | "pi-browser";

export function deriveEconomy(user: Doc<"users">): Economy {
  return user.externalUid?.startsWith("pi:") ? "pi-browser" : "android";
}

// requireUser + the derived economy of that user, resolved server-side.
export async function requireUserAndEconomy(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<{ user: Doc<"users">; economy: Economy }> {
  const user = await requireUser(ctx, userId);
  if (user.accountStatus === "paused") throw new Error("ACCOUNT_PAUSED");
  return { user, economy: deriveEconomy(user) };
}

// requireUser + assert the derived economy equals the expected one. Every
// economy-sensitive operation (earning a reward into a ledger, or spending
// from a ledger) must call this so the backend — not the client — decides
// which economy owns the transaction.
export async function requireEconomy(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  expected: Economy,
): Promise<Doc<"users">> {
  const { user, economy } = await requireUserAndEconomy(ctx, userId);
  if (economy !== expected) {
    throw new Error(
      `This ${expected} action is not available to your account economy (${economy}).`,
    );
  }
  return user;
}
