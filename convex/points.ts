import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Append-only ledger (plan §6): every change is a new row carrying the
// resulting balance; rows are never edited.
export async function creditHelper(
  ctx: MutationCtx,
  args: { userId: Id<"users">; delta: number; reason: string; refId?: string },
) {
  const last = await ctx.db
    .query("pointsLedger")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .order("desc")
    .first();
  const balanceAfter = (last?.balanceAfter ?? 0) + args.delta;
  if (balanceAfter < 0) {
    throw new Error("Insufficient points");
  }
  await ctx.db.insert("pointsLedger", { ...args, balanceAfter });
  return balanceAfter;
}

export const credit = internalMutation({
  args: {
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await creditHelper(ctx, args);
  },
});
