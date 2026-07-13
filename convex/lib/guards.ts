import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"users">> {
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
