import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// "Sign in with Telegram" (deep-link bot flow). The client creates a nonce and
// opens t.me/<bot>?start=<nonce>; the bot webhook (http.ts) marks it verified
// with the Telegram user; the client then completes sign-in via the "telegram"
// Convex Auth provider (TelegramProvider.ts). Free — no SMS/email needed.

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
