import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/guards";

// "Sign in with Telegram" (deep-link bot flow). The client creates a nonce and
// opens t.me/<bot>?start=<nonce>; the bot webhook (http.ts) marks it verified
// with the Telegram user; the client then completes sign-in via the "telegram"
// Convex Auth provider (TelegramProvider.ts). Free — no SMS/email needed.
// The same nonce flow powers "Link Telegram" for already-signed-up users
// (linkStart/linkComplete), which is what unlocks real channel-join
// verification (telegram.check → getChatMember).

const NONCE_TTL_MS = 10 * 60 * 1000;

// Create a login nonce + the Telegram deep link to open.
export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    await ctx.db.insert("telegramNonces", {
      nonce,
      verified: false,
      used: false,
      expiresAt: Date.now() + NONCE_TTL_MS,
    });
    const bot = process.env.TELEGRAM_BOT_USERNAME ?? "YourBot";
    return { nonce, url: `https://t.me/${bot}?start=${nonce}` };
  },
});

// Client polls this after opening the deep link.
export const status = query({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("telegramNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    return { verified: row?.verified === true && row?.used === false };
  },
});

// Called by the bot webhook when the user presses Start in Telegram.
export const markVerified = internalMutation({
  args: { nonce: v.string(), telegramUserId: v.string(), telegramName: v.string() },
  handler: async (ctx, { nonce, telegramUserId, telegramName }) => {
    const row = await ctx.db
      .query("telegramNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row || row.used || Date.now() > row.expiresAt) return false;
    await ctx.db.patch(row._id, { verified: true, telegramUserId, telegramName });
    return true;
  },
});

// Consumed once by the "telegram" auth provider to complete sign-in. Single-use.
export const consumeNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("telegramNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row || row.used || !row.verified || Date.now() > row.expiresAt) {
      throw new Error("Telegram sign-in not completed or expired");
    }
    await ctx.db.patch(row._id, { used: true });
    return {
      telegramUserId: row.telegramUserId!,
      telegramName: row.telegramName ?? "Telegram user",
    };
  },
});

// "Link Telegram" for an existing account (email/Google sign-ups included).
// Same deep-link flow as sign-in, but instead of creating a new auth account we
// stamp telegramUserId onto the current user, which is what the real channel-join
// check (telegram.check → getChatMember) needs to verify membership.
export const linkStart = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    await ctx.db.insert("telegramNonces", {
      nonce,
      verified: false,
      used: false,
      expiresAt: Date.now() + NONCE_TTL_MS,
    });
    const bot = process.env.TELEGRAM_BOT_USERNAME ?? "YourBot";
    return { nonce, url: `https://t.me/${bot}?start=${nonce}` };
  },
});

export const linkComplete = mutation({
  args: { userId: v.id("users"), nonce: v.string() },
  handler: async (ctx, { userId, nonce }) => {
    await requireUser(ctx, userId);
    const row = await ctx.db
      .query("telegramNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row || row.used || !row.verified || Date.now() > row.expiresAt) {
      throw new Error("Telegram link not completed or expired");
    }
    const telegramUserId = row.telegramUserId;
    if (!telegramUserId) {
      throw new Error("Telegram link not completed");
    }
    await ctx.db.patch(row._id, { used: true });
    // One Telegram account maps to one app account — never let a second user
    // adopt an id that's already claimed.
    const colliding = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.eq(q.field("telegramUserId"), telegramUserId),
          q.neq(q.field("_id"), userId),
        ),
      )
      .first();
    if (colliding) {
      throw new Error("This Telegram account is already linked to another account");
    }
    await ctx.db.patch(userId, { telegramUserId });
    return { telegramUserId };
  },
});
