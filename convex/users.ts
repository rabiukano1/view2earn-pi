import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserAndEconomy } from "./lib/guards";

// Identity is via Convex Auth (email/password now; Sidra KYC later).

// The currently signed-in user, or null. The client reads this for its session.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// Live points balance for the caller's OWN economy (derived server-side).
export const balance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { economy } = await requireUserAndEconomy(ctx, args.userId);
    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", args.userId).eq("economy", economy),
      )
      .order("desc")
      .first();
    return last?.balanceAfter ?? 0;
  },
});

// Self-deletion for the user's own account. Deletes the primary users table row,
// which permanently orphans their ledgers and disables their active sessions.
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Clean up auth records to prevent null pointer exceptions on re-signup
    const accounts = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", userId)).collect();
    for (const a of accounts) await ctx.db.delete(a._id);
    
    const sessions = await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", userId)).collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    await ctx.db.delete(userId);
  },
});
