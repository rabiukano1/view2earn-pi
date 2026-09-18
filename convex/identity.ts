import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser, requireUserAndEconomy, type Economy } from "./lib/guards";
import { lastBalance } from "./lib/ledger";
import { getNum } from "./rewardsConfig";
import { levelsWithOverrides, levelForXp } from "./xp";

// 3-in-1 identity: one View2Earn user, three surfaces (Pi Browser, Telegram,
// Android), each with its own ledger + level. Cashing out (withdraw / redeem
// points) requires all three surfaces linked AND level >= withdrawMinLevel on
// each. Spending points on Promote Hub is always allowed.
export const SURFACES: Economy[] = ["pi-browser", "telegram", "android"];
const ANDROID_PROVIDERS = new Set(["password", "resend-otp"]);

export async function linkedSurfaces(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Record<Economy, boolean>> {
  const user = await ctx.db.get(userId);
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  const providers = new Set(accounts.map((a) => a.provider));
  return {
    "pi-browser": providers.has("pi") || !!user?.externalUid?.startsWith("pi:"),
    telegram: providers.has("telegram") || !!user?.telegramUserId,
    android: [...providers].some((p) => ANDROID_PROVIDERS.has(p)),
  };
}

// Per-surface level = level of lifetime points earned on that surface.
async function surfaceLevels(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const levels = await levelsWithOverrides(ctx);
  const rows = await ctx.db
    .query("pointsLedger")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const earned: Record<Economy, number> = { "pi-browser": 0, telegram: 0, android: 0 };
  for (const r of rows) {
    if (r.delta > 0) earned[(r.economy ?? "android") as Economy] += r.delta;
  }
  return {
    "pi-browser": levelForXp(levels, earned["pi-browser"]),
    telegram: levelForXp(levels, earned.telegram),
    android: levelForXp(levels, earned.android),
  };
}

export async function cashOutStatus(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const minLevel = await getNum(ctx, "withdrawMinLevel");
  const [linked, levels] = await Promise.all([linkedSurfaces(ctx, userId), surfaceLevels(ctx, userId)]);
  const reasons: string[] = [];
  for (const s of SURFACES) {
    if (!linked[s]) reasons.push(`Link your ${label(s)} account`);
    else if (levels[s] < minLevel) reasons.push(`Reach level ${minLevel} on ${label(s)} (now ${levels[s]})`);
  }
  return { ok: reasons.length === 0, reasons, minLevel, linked, levels };
}

// Call from every withdraw/redeem mutation. Throws a user-readable error.
export async function assertCanCashOut(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const status = await cashOutStatus(ctx, userId);
  if (!status.ok) {
    throw new Error(
      `Withdrawals unlock once all three View2Earn apps are linked and at level ${status.minLevel}: ` +
        status.reasons.join("; ") +
        ". You can still spend points in Promote Hub.",
    );
  }
}

function label(s: Economy) {
  return s === "pi-browser" ? "Pi Browser" : s === "telegram" ? "Telegram" : "Android";
}

// Unified wallet: every surface's balance + level, what is linked, and whether
// the caller may cash out. `current` is the surface of the calling session.
export const overview = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const { economy } = await requireUserAndEconomy(ctx, userId);
    const status = await cashOutStatus(ctx, userId);
    const balances = {
      "pi-browser": await lastBalance(ctx, userId, "pi-browser"),
      telegram: await lastBalance(ctx, userId, "telegram"),
      android: await lastBalance(ctx, userId, "android"),
    };
    return { current: economy, balances, ...status };
  },
});

// ---------------------------------------------------------------------------
// Account linking by code (Pi <-> Telegram). Android keeps its own flows
// (piLink token, telegramAuth.linkStart/linkComplete).
//
//   surface A (target user T):  createLinkCode() -> "483920"
//   surface B (fresh user F):   redeemLinkCode("483920")
//     -> F's auth account for the CURRENT surface is re-pointed to T, T gets
//        the anchor (telegramUserId / pi externalUid), F is marked "merged".
//        B then signs in again and lands on T.
// Refused if F already earned points (would silently orphan a ledger) or if T
// already has that surface linked.
const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export const createLinkCode = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await ctx.db.insert("linkCodes", { code, userId, expiresAt: Date.now() + LINK_CODE_TTL_MS });
    return { code, expiresInMin: LINK_CODE_TTL_MS / 60000 };
  },
});

export const redeemLinkCode = mutation({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, { userId, code }) => {
    const { user: from, economy } = await requireUserAndEconomy(ctx, userId);
    const row = await ctx.db
      .query("linkCodes")
      .withIndex("by_code", (q) => q.eq("code", code.trim()))
      .first();
    if (!row || Date.now() > row.expiresAt) throw new Error("Invalid or expired code");
    await ctx.db.delete(row._id);
    if (row.userId === userId) throw new Error("That code belongs to this same account");
    const target = await ctx.db.get(row.userId);
    if (!target || target.accountStatus === "merged") throw new Error("Target account not found");

    const provider = economy === "pi-browser" ? "pi" : economy === "telegram" ? "telegram" : null;
    if (!provider) throw new Error("Use the Link Pi / Link Telegram options in the Android app instead");
    if ((await linkedSurfaces(ctx, target._id))[economy]) {
      throw new Error(`That account already has ${label(economy)} linked`);
    }
    const earned = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (earned) {
      throw new Error("This account already has points. Contact support to merge accounts.");
    }

    // Re-point this surface's auth account(s) to the target user.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", provider))
      .collect();
    if (accounts.length === 0) throw new Error(`No ${label(economy)} login on this account`);
    for (const a of accounts) await ctx.db.patch(a._id, { userId: target._id });

    // Copy the identity anchor.
    if (provider === "telegram") {
      await ctx.db.patch(target._id, { telegramUserId: from.telegramUserId });
    } else if (!target.externalUid?.startsWith("pi:")) {
      await ctx.db.patch(target._id, {
        ecosystem: "PI",
        externalUid: from.externalUid,
        ...(from.piWalletAddress ? { piWalletAddress: from.piWalletAddress } : {}),
      });
    }
    await ctx.db.patch(userId, {
      accountStatus: "merged",
      mergedInto: target._id,
      telegramUserId: undefined,
      externalUid: `merged:${userId}`,
    });
    return { linkedTo: target.username };
  },
});
