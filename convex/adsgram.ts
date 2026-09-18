import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Called from the /adsgram/reward HTTP route (convex/http.ts).
export const record = internalMutation({
  args: { telegramUserId: v.string() },
  handler: async (ctx, { telegramUserId }) => {
    await ctx.db.insert("adsgramRewards", { telegramUserId, at: Date.now() });
  },
});
