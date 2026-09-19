import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/guards";
import { appendLedger, lastBalance } from "./lib/ledger";
import { recordDuplicateLink } from "./fraud";

// Pi account linking (plan §7.1). The Android app and the Pi Browser run in
// two DIFFERENT Convex auth sessions, so a Pi sign-in inside the Pi Browser
// creates a separate user row instead of updating the Android user. To let an
// existing Android account "become" a Pi account, we use a short-lived,
// one-time token:
//
//   1. Android (authenticated)   → createLinkToken() → returns token
//   2. Android opens pi://…/link?token=<t> in the Pi Browser
//   3. Pi web app runs Pi.authenticate() then completeLink({ token, … })
//   4. The Pi UID is verified server-side and stamped onto the Android user
//      (ecosystem "PI", externalUid "pi:<uid>") — the same economy derived by
//      guards.ts:deriveEconomy now becomes "pi-browser".
//
// The token IS the authorization for linking (like a magic link), so the Pi
// web app does not need its own session.

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Generates a one-time link token for the CALLER's own user.
export const createLinkToken = mutation({
  handler: async (ctx) => {
    const userId = (await requireAuth(ctx)) as Id<"users">;

    // Prune this user's expired tokens; only the freshest is ever needed.
    const now = Date.now();
    const old = await ctx.db
      .query("piLinkTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of old) {
      if (now - row.createdAt > TOKEN_TTL_MS) {
        await ctx.db.delete(row._id);
      }
    }

    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    await ctx.db.insert("piLinkTokens", {
      userId,
      token,
      createdAt: now,
    });
    return token;
  },
});

// Exchanges a link token + a verified Pi identity for a promoted user row.
// No auth session required — the token authorizes the link. Runs as an action
// because verifying the Pi access token requires internal.piAuth.verifyPiToken;
// the actual writes happen in finishLink (a single transaction).
export const completeLink = action({
  args: {
    token: v.string(),
    accessToken: v.string(),
    uid: v.string(),
    walletAddress: v.optional(v.string()),
    piUsername: v.optional(v.string()),
  },
  handler: async (ctx, { token, accessToken, uid, walletAddress, piUsername }) => {
    // Server-side verification: never trust a client-sent UID on its own.
    const verified = await ctx.runAction(internal.piAuth.verifyPiToken, {
      accessToken,
    });
    if (verified.uid !== uid) throw new Error("Pi UID mismatch");

    await ctx.runMutation(internal.piLink.finishLink, {
      token,
      piUid: verified.uid,
      walletAddress,
      piUsername,
    });
  },
});

// Internal: validate the token and stamp the Pi identity onto the target user.
export const finishLink = internalMutation({
  args: {
    token: v.string(),
    piUid: v.string(),
    walletAddress: v.optional(v.string()),
    piUsername: v.optional(v.string()),
  },
  handler: async (ctx, { token, piUid, walletAddress, piUsername }) => {
    const row = await ctx.db
      .query("piLinkTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!row) {
      throw new Error("Invalid or expired link. Tap 'Open Pi Browser to verify' again.");
    }
    if (Date.now() - row.createdAt > TOKEN_TTL_MS) {
      await ctx.db.delete(row._id);
      throw new Error("Link expired. Tap 'Open Pi Browser to verify' again.");
    }

    const target = await ctx.db.get(row.userId);
    if (!target) throw new Error("Account not found");

    // This Pi UID may already own a separate account — typically the one
    // created by simply signing in on pi.view2earn.org before linking. Fold it
    // into the target: every ledger balance it holds is transferred as a
    // single audited row per economy (keeps each balanceAfter chain intact),
    // then the old row is marked merged. externalUid is required by the
    // schema, so it is re-pointed to a "merged:" marker, never cleared.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", `pi:${piUid}`))
      .first();
    if (existing && existing._id !== row.userId) {
      const ownerLogins = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", existing._id))
        .collect();
      if (ownerLogins.some((a) => a.provider !== "pi") || existing.telegramUserId) {
        // A real account on another surface owns this Pi. The requester is
        // the one trying to double-link — flag it, never touch the owner.
        await recordDuplicateLink(ctx, { userId: row.userId, identity: `pi:${piUid}`, ownerUserId: existing._id });
        throw new Error("This Pi account is already linked to another View2Earn account.");
      }
      for (const economy of ["pi-browser", "android", "telegram", "wallet"] as const) {
        const bal = await lastBalance(ctx, existing._id, economy);
        if (bal > 0) {
          await appendLedger(ctx, existing._id, economy, -bal, "ACCOUNT_MERGE_OUT", String(row.userId));
          await appendLedger(ctx, row.userId, economy, bal, "ACCOUNT_MERGE_IN", String(existing._id));
        }
      }
      await ctx.db.patch(existing._id, {
        accountStatus: "merged",
        mergedInto: row.userId,
        externalUid: `merged:${existing._id}`,
        telegramUserId: undefined,
      });
    }

    await ctx.db.patch(row.userId, {
      ecosystem: "PI",
      externalUid: `pi:${piUid}`,
      ...(walletAddress ? { piWalletAddress: walletAddress } : {}),
      ...(piUsername ? { username: piUsername, piUsername } : {}),
    });

    const existingAuth = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "pi").eq("providerAccountId", `pi:${piUid}`)
      )
      .first();
      
    if (existingAuth) {
      if (existingAuth.userId !== row.userId) {
        await ctx.db.patch(existingAuth._id, { userId: row.userId });
      }
    } else {
      await ctx.db.insert("authAccounts", {
        userId: row.userId,
        provider: "pi",
        providerAccountId: `pi:${piUid}`,
      });
    }

    await ctx.db.delete(row._id);
  },
});
export const getUserMergeState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    return u ? { accountStatus: u.accountStatus, mergedInto: u.mergedInto } : null;
  },
});
