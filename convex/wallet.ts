import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { buildSignInMessage, verifyPersonalSign } from "@view2earn/core/src/wallet";

// Web3 wallet login (SIWE), plan §7.1. Flow:
//   1. client connects wallet, gets the address
//   2. getNonce(address) → server issues a message to sign
//   3. wallet signs it (personal_sign)
//   4. walletAuth(address, signature) → server verifies + returns the user
// The wallet address is the identity — a real cryptographic account, no device
// fingerprint. Verification is server-side in @view2earn/core (tested).

const NONCE_TTL_MS = 10 * 60 * 1000;
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

export const getNonce = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const addr = address.toLowerCase();
    if (!ADDRESS_RE.test(addr)) throw new Error("Invalid wallet address");

    const issuedAt = Date.now();
    const message = buildSignInMessage(addr, crypto.randomUUID(), issuedAt);

    // One pending nonce per address — overwrite any previous one.
    const existing = await ctx.db
      .query("walletNonces")
      .withIndex("by_address", (q) => q.eq("address", addr))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { message, expiresAt: issuedAt + NONCE_TTL_MS, used: false });
    } else {
      await ctx.db.insert("walletNonces", {
        address: addr,
        message,
        expiresAt: issuedAt + NONCE_TTL_MS,
        used: false,
      });
    }
    return { message };
  },
});

export const walletAuth = mutation({
  args: { address: v.string(), signature: v.string() },
  handler: async (ctx, { address, signature }) => {
    const addr = address.toLowerCase();

    const rec = await ctx.db
      .query("walletNonces")
      .withIndex("by_address", (q) => q.eq("address", addr))
      .unique();
    if (!rec || rec.used) throw new Error("No pending sign-in — request a nonce first");
    if (Date.now() > rec.expiresAt) throw new Error("Sign-in request expired — try again");
    if (!verifyPersonalSign(rec.message, signature, addr)) {
      throw new Error("Signature does not match the address");
    }
    await ctx.db.patch(rec._id, { used: true }); // single-use → no replay

    const externalUid = `wallet:${addr}`;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalUid", (q) => q.eq("externalUid", externalUid))
      .unique();
    if (existing) return { userId: existing._id, isNew: false };

    const userId = await ctx.db.insert("users", {
      ecosystem: "SIDRA", // Sidra Chain is EVM-compatible; adjust once Pi web lands.
      externalUid,
      username: `0x${addr.slice(2, 6)}…${addr.slice(-4)}`,
      tier: 0,
      fraudScore: 0,
      deviceFingerprint: "wallet",
      signupIp: "unknown",
      country: "unknown",
    });
    return { userId, isNew: true };
  },
});
