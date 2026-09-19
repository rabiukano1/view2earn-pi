import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { sessionEconomy, type Economy } from "./lib/guards";

// One leaderboard per surface: the Android app ranks android balances, the
// Telegram app telegram balances, the Pi app pi-browser balances. The surface
// is the CALLER's session economy (server-side), so no client changes.
async function callerEconomy(ctx: QueryCtx): Promise<Economy> {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  return user ? sessionEconomy(ctx, user) : "android";
}

async function rankedBalances(ctx: QueryCtx, economy: Economy) {
  const users = await ctx.db.query("users").collect();
  const rows = await Promise.all(
    users.map(async (u) => {
      const last = await ctx.db
        .query("pointsLedger")
        .withIndex("by_user_economy", (q) => q.eq("userId", u._id).eq("economy", economy))
        .order("desc")
        .first();
      return { _id: u._id, username: u.username, ecosystem: u.ecosystem, balance: last?.balanceAfter ?? 0 };
    }),
  );
  return rows.filter((u) => u.balance > 0).sort((a, b) => b.balance - a.balance);
}

export const topEarners = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const ranked = await rankedBalances(ctx, await callerEconomy(ctx));
    return ranked.slice(0, limit ?? 20);
  },
});

export const myRank = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const ranked = await rankedBalances(ctx, await callerEconomy(ctx));
    const pos = ranked.findIndex((u) => u._id === userId);
    return {
      rank: pos >= 0 ? pos + 1 : null,
      total: ranked.length,
      balance: pos >= 0 ? ranked[pos].balance : 0,
    };
  },
});
