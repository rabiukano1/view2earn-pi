import { query } from "./_generated/server";
import { v } from "convex/values";

export const topEarners = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = limit ?? 20;
    const users = await ctx.db.query("users").collect();

    const withBalance = await Promise.all(
      users.map(async (u) => {
        const last = await ctx.db
          .query("pointsLedger")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .order("desc")
          .first();
        return {
          _id: u._id,
          username: u.username,
          ecosystem: u.ecosystem,
          balance: last?.balanceAfter ?? 0,
        };
      }),
    );

    return withBalance
      .filter((u) => u.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, take);
  },
});

export const myRank = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db.query("users").collect();
    let myBalance = 0;
    let myEcosystem = "SIDRA";

    const withBalance = await Promise.all(
      all.map(async (u) => {
        const last = await ctx.db
          .query("pointsLedger")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .order("desc")
          .first();
        const bal = last?.balanceAfter ?? 0;
        if (u._id === userId) {
          myBalance = bal;
          myEcosystem = u.ecosystem;
        }
        return { userId: u._id, balance: bal, ecosystem: u.ecosystem };
      }),
    );

    const ranked = withBalance
      .filter((u) => u.balance > 0 && u.ecosystem === myEcosystem)
      .sort((a, b) => b.balance - a.balance);

    const pos = ranked.findIndex((u) => u.userId === userId);
    return {
      rank: pos >= 0 ? pos + 1 : null,
      total: ranked.length,
      balance: myBalance,
    };
  },
});
