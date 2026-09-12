import { mutation } from "./_generated/server";

export const cleanupOrphanedAuth = mutation({
  args: {},
  handler: async (ctx) => {
    let cleaned = 0;
    const accounts = await ctx.db.query("authAccounts").collect();
    
    for (const account of accounts) {
      const user = await ctx.db.get(account.userId as any);
      if (!user) {
        // Orphaned!
        await ctx.db.delete(account._id);
        cleaned++;
      }
    }
    
    const sessions = await ctx.db.query("authSessions").collect();
    for (const session of sessions) {
      const user = await ctx.db.get(session.userId as any);
      if (!user) {
        // Orphaned!
        await ctx.db.delete(session._id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
});

// One-off: strip the legacy `doubled` field from pendingSpins rows written by an
// earlier revision of the 2x flow. Safe to run once; re-running is a no-op.
export const stripLegacyPendingSpinDoubled = mutation({
  args: {},
  handler: async (ctx) => {
    let cleaned = 0;
    const rows = await ctx.db.query("pendingSpins").collect();
    for (const row of rows) {
      if ((row as { doubled?: boolean }).doubled !== undefined) {
        await ctx.db.patch(row._id, { doubled: undefined });
        cleaned++;
      }
    }
    return cleaned;
  },
});

