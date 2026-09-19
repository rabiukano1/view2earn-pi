import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/guards";
import { recordDuplicateLink } from "./fraud";

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

// "Link Telegram" for an existing account (email sign-ups included).
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
    await attachTelegram(ctx, userId, telegramUserId);
    return { telegramUserId };
  },
});

// One user <-> one Telegram account, and logging into the Telegram Mini App
// is enough to "own" a Telegram ID. When a user links a Telegram ID that the
// Mini App already created a separate account for, that Telegram-only account
// is MERGED into this one: its telegram-surface ledger, spins and task claims
// move over, its auth account is re-pointed, and it is marked "merged". The
// next Mini App sign-in then lands on this user.
export async function attachTelegram(
  ctx: MutationCtx,
  userId: Id<"users">,
  telegramUserId: string,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Account not found");
  if (user.telegramUserId && user.telegramUserId !== telegramUserId) {
    throw new Error("This account already has a different Telegram linked");
  }
  const accountId = `telegram:${telegramUserId}`;
  const acct = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) => q.eq("provider", "telegram").eq("providerAccountId", accountId))
    .first();
  const owner = await ctx.db
    .query("users")
    .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", telegramUserId))
    .first();
  const other = [acct?.userId, owner?._id].find((id) => id && id !== userId) as Id<"users"> | undefined;

  if (other) {
    const o = await ctx.db.get(other);
    if (!o) throw new Error("Account not found");
    // A real, populated account on ANOTHER surface owns this Telegram: refuse.
    // (Only a Telegram-first account — no Pi/Android login — can be absorbed.)
    const otherAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", other))
      .collect();
    if (otherAccounts.some((a) => a.provider !== "telegram")) {
      await recordDuplicateLink(ctx, { userId, identity: `telegram:${telegramUserId}`, ownerUserId: other });
      throw new Error("This Telegram account is already linked to another View2Earn account");
    }
    await mergeTelegramOnlyAccount(ctx, other, userId);
  }

  if (!acct) {
    await ctx.db.insert("authAccounts", { userId, provider: "telegram", providerAccountId: accountId });
  } else if (acct.userId !== userId) {
    await ctx.db.patch(acct._id, { userId });
  }
  await ctx.db.patch(userId, { telegramUserId });
}

// Move everything the Telegram-only account earned on the telegram surface to
// the target, then retire it. The target has no telegram ledger yet (checked by
// the caller), so the moved balanceAfter chain stays consistent.
async function mergeTelegramOnlyAccount(ctx: MutationCtx, from: Id<"users">, to: Id<"users">) {
  for (const r of await ctx.db
    .query("pointsLedger")
    .withIndex("by_user_economy", (q) => q.eq("userId", from).eq("economy", "telegram"))
    .collect()) {
    await ctx.db.patch(r._id, { userId: to });
  }
  for (const r of await ctx.db
    .query("dailySpins")
    .withIndex("by_user_economy", (q) => q.eq("userId", from).eq("economy", "telegram"))
    .collect()) {
    await ctx.db.patch(r._id, { userId: to });
  }
  for (const r of await ctx.db
    .query("verifications")
    .withIndex("by_user", (q) => q.eq("userId", from))
    .collect()) {
    if (r.economy === "telegram") await ctx.db.patch(r._id, { userId: to });
  }
  await ctx.db.patch(from, {
    accountStatus: "merged",
    mergedInto: to,
    telegramUserId: undefined,
    externalUid: `merged:${from}`,
  });
}

// Mini App sign-in for a Telegram ID that has no auth account yet but WAS
// linked from Android (telegramUserId on a user): adopt that user instead of
// creating a duplicate. Returns null when nobody owns the ID.
export const adoptLinkedUser = internalMutation({
  args: { telegramUserId: v.string() },
  handler: async (ctx, { telegramUserId }): Promise<Id<"users"> | null> => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_telegramUserId", (q) => q.eq("telegramUserId", telegramUserId))
      .first();
    if (!owner || owner.accountStatus === "merged") return null;
    await attachTelegram(ctx, owner._id, telegramUserId);
    return owner._id;
  },
});

// Telegram Mini App sign-in: verifies `window.Telegram.WebApp.initData` per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// (HMAC-SHA256 keyed by HMAC("WebAppData", BOT_TOKEN)). Web Crypto, no Node.
const INIT_DATA_MAX_AGE_S = 24 * 60 * 60;

export const verifyInitData = internalAction({
  args: { initData: v.string() },
  handler: async (_ctx, { initData }): Promise<{ telegramUserId: string; telegramName: string }> => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) throw new Error("Missing Telegram hash");
    params.delete("hash");
    const checkString = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, val]) => `${k}=${val}`)
      .join("\n");

    const enc = new TextEncoder();
    const hmac = async (key: BufferSource, data: string) => {
      const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return crypto.subtle.sign("HMAC", k, enc.encode(data));
    };
    const secret = await hmac(enc.encode("WebAppData") as BufferSource, token);
    const sig = new Uint8Array(await hmac(secret, checkString));
    const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== hash) throw new Error("Invalid Telegram signature");

    const authDate = Number(params.get("auth_date") ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_S) {
      throw new Error("Telegram session expired — reopen the app");
    }
    const user = JSON.parse(params.get("user") ?? "{}") as {
      id?: number; first_name?: string; last_name?: string; username?: string;
    };
    if (!user.id) throw new Error("Missing Telegram user");
    const telegramName =
      user.username ?? [user.first_name, user.last_name].filter(Boolean).join(" ") ?? `tg_${user.id}`;
    return { telegramUserId: String(user.id), telegramName };
  },
});
