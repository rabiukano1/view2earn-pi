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
