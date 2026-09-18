import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Stamps which app surface (economy) the sign-in in progress belongs to. Must
// run in the same auth transaction that creates the session, so that
// authSessions._creationTime === users.pendingSurfaceAt (see lib/guards.ts).
export const markPending = internalMutation({
  args: {
    userId: v.id("users"),
    surface: v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram")),
  },
  handler: async (ctx, { userId, surface }) => {
    await ctx.db.patch(userId, { pendingSurface: surface, pendingSurfaceAt: Date.now() });
  },
});
