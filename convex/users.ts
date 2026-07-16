import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Identity is via Convex Auth (email/password now; Google + Sidra KYC later).

// The currently signed-in user, or null. The client reads this for its session.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// Live points balance = balanceAfter of the latest ledger entry.
export const balance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    return last?.balanceAfter ?? 0;
  },
});
