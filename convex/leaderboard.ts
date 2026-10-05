import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { sessionEconomy, type Economy } from "./lib/guards";

// One leaderboard per surface: the Android app ranks android balances, the
// Telegram app telegram balances, the Pi app pi-browser balances. The surface
// is the CALLER's session economy (server-side), so no client changes.
//
// Rankings read the `economyBalances` cache (maintained by
// lib/ledger.ts:insertLedgerRow), indexed by ["economy", "balance"]. That is
// why these queries read a page of rows instead of every user's ledger — and
// why a point earned by a user outside the page no longer invalidates them.
//
// ponytail: rank/total are computed from the top RANK_SCAN_LIMIT entries. A
// user below that gets rank = null. Raise the constant (or keep a running
// count) if an exact rank deep in the table ever matters.
const RANK_SCAN_LIMIT = 200;

async function callerEconomy(ctx: QueryCtx): Promise<Economy> {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  return user ? sessionEconomy(ctx, user) : "android";
}

// Highest balances first, positive balances only.
async function topBalances(ctx: QueryCtx, economy: Economy, take: number) {
  const rows = await ctx.db
    .query("economyBalances")
    .withIndex("by_economy_balance", (q) => q.eq("economy", economy))
    .order("desc")
    .take(take);
  return rows.filter((r) => r.balance > 0);
}

export const topEarners = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await topBalances(ctx, await callerEconomy(ctx), limit ?? 20);
    // One get() per shown row — 20 reads, not one per user in the database.
    const withUsers = await Promise.all(
      rows.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        if (!u || u.accountStatus === "merged") return null;
        return { _id: r.userId, username: u.username, ecosystem: u.ecosystem, balance: r.balance };
      }),
    );
    return withUsers.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const myRank = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const economy = await callerEconomy(ctx);
    const rows = await topBalances(ctx, economy, RANK_SCAN_LIMIT);
    const pos = rows.findIndex((r) => r.userId === userId);

    // Outside the scanned page: still report the real balance, rank unknown.
    if (pos < 0) {
      const mine = await ctx.db
        .query("economyBalances")
        .withIndex("by_user_economy", (q) => q.eq("userId", userId).eq("economy", economy))
        .unique();
      return { rank: null, total: rows.length, balance: mine?.balance ?? 0 };
    }
    return { rank: pos + 1, total: rows.length, balance: rows[pos].balance };
  },
});
