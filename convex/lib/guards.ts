import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";

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
  if (userDoc.accountStatus === "merged") throw new Error("ACCOUNT_MERGED"); // linked into another account: sign in again
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

// "wallet" is not a surface: it is the pool of points a user has CLAIMED from
// a surface after reaching the withdraw level there. The wallet app binds its
// sessions to it, so every economy-aware spend path draws from the pool.
export type Economy = "android" | "pi-browser" | "telegram" | "wallet";
// An earning surface. Points are only ever EARNED on a surface; the pool is
// fed by claims and real-money deposits alone.
export type Surface = Exclude<Economy, "wallet">;

// One user, three surfaces. A user's ledgers are keyed by the surface the
// request comes from (Pi Browser / Telegram Mini App / Android app), not by
// the user row. The surface is fixed per auth session:
//   - Pi/Telegram providers and beforeSessionCreation stamp
//     users.pendingSurface(+At) in the same transaction that creates the
//     session, so session._creationTime matches pendingSurfaceAt.
//   - The first mutation on that session persists the match in sessionSurfaces.
//   - Sessions created before this scheme fall back to deriveEconomy (legacy).
const PENDING_MATCH_MS = 1500;

// Legacy / session-less resolution (cron, postbacks, admin): the user's "home"
// economy from their identity anchor.
export function deriveEconomy(user: Doc<"users">): Surface {
  if (user.externalUid?.startsWith("pi:")) return "pi-browser";
  if (user.externalUid?.startsWith("telegram:")) return "telegram";
  return "android";
}

export async function sessionEconomy(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<Economy> {
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) return deriveEconomy(user);
  const bound = await ctx.db
    .query("sessionSurfaces")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
  if (bound) return bound.surface;

  const session = await ctx.db.get(sessionId);
  const matches =
    session &&
    user.pendingSurface &&
    user.pendingSurfaceAt !== undefined &&
    Math.abs(session._creationTime - user.pendingSurfaceAt) <= PENDING_MATCH_MS;
  const surface: Economy = matches ? user.pendingSurface! : deriveEconomy(user);
  if ("scheduler" in ctx) {
    // MutationCtx: persist once so later requests (and queries) are stable.
    await (ctx as MutationCtx).db.insert("sessionSurfaces", { sessionId, userId: user._id, surface });
  }
  return surface;
}

// requireUser + the economy of the calling session, resolved server-side.
export async function requireUserAndEconomy(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<{ user: Doc<"users">; economy: Economy }> {
  const user = await requireUser(ctx, userId);
  if (user.accountStatus === "paused") throw new Error("ACCOUNT_PAUSED");
  return { user, economy: await sessionEconomy(ctx, user) };
}

// requireUserAndEconomy for actions that EARN or spend on a surface ledger
// (spin, tasks, referrals…). The wallet app can only claim/spend the pool.
export async function requireUserAndSurface(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<{ user: Doc<"users">; economy: Surface }> {
  const r = await requireUserAndEconomy(ctx, userId);
  if (r.economy === "wallet") throw new Error("This action isn't available in the wallet app");
  return { user: r.user, economy: r.economy };
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
