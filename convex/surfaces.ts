import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Stamps which app surface (economy) the sign-in in progress belongs to. Must
// run in the same auth transaction that creates the session, so that
// authSessions._creationTime === users.pendingSurfaceAt (see lib/guards.ts).
export const markPending = internalMutation({
  args: {
    userId: v.id("users"),
    surface: v.union(v.literal("android"), v.literal("pi-browser"), v.literal("telegram"), v.literal("wallet")),
  },
  handler: async (ctx, { userId, surface }) => {
    await ctx.db.patch(userId, { pendingSurface: surface, pendingSurfaceAt: Date.now() });
  },
});

// Self-heal for sessions that were bound to the wrong surface (e.g. a Telegram
// session persisted before surface binding worked). The Telegram Mini App
// calls this on every launch with its signed initData; once verified, the
// CURRENT session is rebound to the telegram ledger. Nothing here can be
// spoofed: the HMAC is checked against the bot token, and the Telegram user in
// it must be the one linked to the signed-in account.
export const bindTelegramSession = action({
  args: { initData: v.string() },
  handler: async (ctx, { initData }): Promise<{ surface: "telegram" }> => {
    const verified: { telegramUserId: string } = await ctx.runAction(
      internal.telegramAuth.verifyInitData,
      { initData },
    );
    await ctx.runMutation(internal.surfaces.rebindCurrentSession, {
      surface: "telegram",
      telegramUserId: verified.telegramUserId,
    });
    return { surface: "telegram" };
  },
});

export const rebindCurrentSession = internalMutation({
  args: { surface: v.literal("telegram"), telegramUserId: v.string() },
  handler: async (ctx, { surface, telegramUserId }) => {
    const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    const sessionId = await getAuthSessionId(ctx);
    if (!userId || !sessionId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user || user.telegramUserId !== telegramUserId) {
      throw new Error("This Telegram account is not linked to the signed-in user");
    }
    const bound = await ctx.db
      .query("sessionSurfaces")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (bound) {
      if (bound.surface !== surface) await ctx.db.patch(bound._id, { surface });
    } else {
      await ctx.db.insert("sessionSurfaces", { sessionId, userId, surface });
    }
  },
});
