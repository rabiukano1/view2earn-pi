import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";

// "Sign in with View2Earn" for the companion wallet app.
//
//   wallet  → start()            creates a nonce, returns the deep link to open
//   wallet  → opens view2earn://wallet-auth/<nonce>
//   main    → approve()          signed-in main app binds its user to the nonce
//   main    → opens view2earnwallet://auth/<nonce>   (bounce back; optional)
//   wallet  → signIn("wallet-handoff", { nonce })    provider consumes the nonce
//
// The wallet also polls status() so the sign-in completes even if the
// bounce-back link never fires. No password ever leaves the main app.

const NONCE_TTL_MS = 5 * 60 * 1000;

export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    await ctx.db.insert("walletAuthNonces", {
      nonce,
      approved: false,
      used: false,
      expiresAt: Date.now() + NONCE_TTL_MS,
    });
    return { nonce, url: `view2earn://wallet-auth/${nonce}` };
  },
});

export const status = query({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("walletAuthNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row) return { state: "unknown" as const };
    if (row.used) return { state: "used" as const };
    if (Date.now() > row.expiresAt) return { state: "expired" as const };
    return { state: row.approved ? ("approved" as const) : ("pending" as const) };
  },
});

// Called by the main app while signed in. requireUser ties the nonce to the
// session's own user, so a client can never approve a nonce as someone else.
export const approve = mutation({
  args: { userId: v.id("users"), nonce: v.string() },
  handler: async (ctx, { userId, nonce }) => {
    await requireUser(ctx, userId);
    const row = await ctx.db
      .query("walletAuthNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row || row.used || Date.now() > row.expiresAt) {
      throw new Error("This wallet sign-in link has expired. Go back to the wallet and try again.");
    }
    await ctx.db.patch(row._id, { approved: true, userId });
    return { ok: true, bounceUrl: `view2earnwallet://auth/${nonce}` };
  },
});

// Consumed exactly once by the "wallet-handoff" auth provider.
export const consumeNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("walletAuthNonces")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row || row.used || !row.approved || !row.userId || Date.now() > row.expiresAt) {
      throw new Error("Wallet sign-in not approved or expired");
    }
    await ctx.db.patch(row._id, { used: true });
    return { userId: row.userId };
  },
});
