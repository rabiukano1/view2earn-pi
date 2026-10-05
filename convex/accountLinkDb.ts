import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Database half of the account-linking flow in accountLink.ts, plus the plain
// profile editor. Kept out of that file because it runs in the Node runtime.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const passwordAccountOwner = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<Id<"users"> | null> => {
    const acct = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .first();
    return (acct?.userId as Id<"users">) ?? null;
  },
});

// Move a freshly created password account onto the real user and remove the
// throwaway user createAccount() made. One transaction: no orphans.
export const adoptPasswordAccount = internalMutation({
  args: {
    accountId: v.id("authAccounts"),
    toUserId: v.id("users"),
    throwawayUserId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, { accountId, toUserId, throwawayUserId, email }) => {
    await ctx.db.patch(accountId, { userId: toUserId });

    // Anything else createAccount attached to the placeholder goes too.
    for (const a of await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", throwawayUserId))
      .collect()) {
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(throwawayUserId);

    // Record the email on the real user if it has none yet.
    const user = await ctx.db.get(toUserId);
    if (user && !user.email) await ctx.db.patch(toUserId, { email });
  },
});

// What sign-in methods does the caller have, and what is on their profile?
export const myAccount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    const providers = new Set(accounts.map((a) => a.provider));

    return {
      name: user.name ?? "",
      username: user.username,
      email: user.email ?? "",
      phone: user.phone ?? "",
      methods: {
        password: providers.has("password"),
        email: providers.has("resend-otp"),
        telegram: providers.has("telegram") || !!user.telegramUserId,
        pi: providers.has("pi") || !!user.externalUid?.startsWith("pi:"),
      },
    };
  },
});

// Edit the plain profile fields. Email here is a contact detail; it only
// becomes a sign-in method once a password is linked (accountLink.linkPassword).
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { name, email, phone }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const patch: Record<string, string> = {};

    if (name !== undefined) {
      const n = name.trim();
      if (n.length < 2 || n.length > 40) throw new Error("Name must be 2–40 characters");
      patch.name = n;
    }

    if (email !== undefined && email.trim() !== "") {
      const e = email.trim().toLowerCase();
      if (!EMAIL_RE.test(e)) throw new Error("Enter a valid email address");
      // One email per account, so a later password link can't collide.
      const clash = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", e))
        .first();
      if (clash && clash._id !== userId) {
        throw new Error("That email is already used by another account");
      }
      patch.email = e;
    }

    if (phone !== undefined && phone.trim() !== "") {
      const p = phone.trim();
      if (!/^\+?[0-9][0-9 ()-]{6,19}$/.test(p)) throw new Error("Enter a valid phone number");
      patch.phone = p;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return { ok: true };
  },
});
