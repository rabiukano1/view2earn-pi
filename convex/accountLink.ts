"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId, createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";

// Let a user who signed up with Telegram or Pi add an email + password to the
// SAME account, so they can also sign in the normal way (and recover access if
// they lose the Telegram/Pi side).
//
// Convex Auth has no "add a credential to this user" helper: createAccount()
// always makes a new user. So we let it create the account (which hashes the
// password with the provider's own crypto — we must never reimplement that),
// then re-point the account row at the real user and delete the throwaway.
// That is done in one mutation (internal.accountLinkDb.adoptPasswordAccount)
// so a failure cannot leave an orphan user behind.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export const linkPassword = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }): Promise<{ linked: true; email: string }> => {
    const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (!userId) throw new Error("Not signed in");

    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) throw new Error("Enter a valid email address");
    if (password.length < MIN_PASSWORD) {
      throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
    }

    // Is this email already a password login? Whose?
    const owner: Id<"users"> | null = await ctx.runQuery(
      internal.accountLinkDb.passwordAccountOwner,
      { email: normalized },
    );
    if (owner && owner !== userId) {
      throw new Error("That email is already used by another View2Earn account");
    }

    if (owner === userId) {
      // Already linked — treat this as "change my password".
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: normalized, secret: password },
      });
    } else {
      // Let Convex Auth hash the secret, then move the account to this user.
      const created = await createAccount(ctx, {
        provider: "password",
        account: { id: normalized, secret: password },
        profile: {
          email: normalized,
          // Placeholder user — deleted in the same mutation below.
          ecosystem: "SIDRA",
          externalUid: `pending-link:${userId}:${Date.now()}`,
          username: normalized.split("@")[0],
          tier: 0,
          fraudScore: 0,
          deviceFingerprint: "account-link",
          signupIp: "unknown",
          country: "unknown",
        } as any,
      });
      await ctx.runMutation(internal.accountLinkDb.adoptPasswordAccount, {
        accountId: created.account._id as Id<"authAccounts">,
        toUserId: userId,
        throwawayUserId: created.user._id as Id<"users">,
        email: normalized,
      });
    }

    return { linked: true, email: normalized };
  },
});
