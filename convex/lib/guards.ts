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
  const user = await ctx.db.get(userId as any);
  if (!user) throw new Error("User not found");
  return user as Doc<"users">;
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
