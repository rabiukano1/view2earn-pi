import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireUser, requireUserAndEconomy } from "./lib/guards";

// Pi web-app wallet (plan §7): a points wallet + the user's Pi blockchain
// wallet. Points are the app balance (pointsLedger is authoritative); Pi is the
// on-chain balance read live from Pi's Stellar-fork Horizon API. No custody —
// we only ever store the public wallet address.

// Stellar/Pi public addresses are strkey-encoded: G + 55 base32 chars using
// the RFC 4648 alphabet (A-Z, 2-7). Unlike base58, this DOES include I/O/L.
const PI_ADDR_RE = /^G[A-Z2-7]{55}$/;

function horizonBase(): string {
  // Dev/sandbox uses Pi Testnet; set PI_NETWORK=mainnet for production.
  return process.env.PI_NETWORK === "mainnet"
    ? "https://api.mainnet.minepi.com"
    : "https://api.testnet.minepi.com";
}

function networkLabel(): string {
  return process.env.PI_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

// Summary of the authenticated user's wallet: points + linked Pi address.
export const getMyWallet = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { user, economy } = await requireUserAndEconomy(ctx, userId);

    const last = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user_economy", (q) =>
        q.eq("userId", userId).eq("economy", economy),
      )
      .order("desc")
      .first();

    return {
      pointsBalance: last?.balanceAfter ?? 0,
      piWalletAddress: user.piWalletAddress ?? null,
      network: networkLabel(),
      economy,
    };
  },
});

// Link the user's Pi wallet address (from Pi.authenticate with the
// wallet_address scope). Public address only — no seed/private key, no custody.
export const linkPiWallet = mutation({
  args: { userId: v.id("users"), walletAddress: v.string() },
  handler: async (ctx, { userId, walletAddress }) => {
    await requireUser(ctx, userId);
    const user = await ctx.db.get(userId);
    if (!user || user.ecosystem !== "PI") {
      throw new Error("Pi wallet linking is for Pi Network accounts only");
    }
    const addr = walletAddress.trim();
    if (!PI_ADDR_RE.test(addr)) {
      throw new Error("That doesn't look like a valid Pi wallet address");
    }
    await ctx.db.patch(userId, { piWalletAddress: addr });
    return { piWalletAddress: addr };
  },
});

// Internal: persist a user's Pi wallet address (used by the Pi auth provider —
// the provider action context has no db access, so it defers here).
export const setPiWalletAddressInternal = internalMutation({
  args: { userId: v.id("users"), walletAddress: v.string() },
  handler: async (ctx, { userId, walletAddress }) => {
    await ctx.db.patch(userId, { piWalletAddress: walletAddress });
  },
});

// Live Pi balance for a wallet address, read from Pi's Horizon API.
export const getPiBalance = action({  args: { walletAddress: v.string() },
  handler: async (_ctx, { walletAddress }) => {
    if (!PI_ADDR_RE.test(walletAddress)) {
      throw new Error("Invalid Pi wallet address");
    }
    const res = await fetch(`${horizonBase()}/accounts/${walletAddress}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Pi balance lookup failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as {
      balances?: Array<{ asset_type: string; asset_code?: string; balance?: string }>;
    };
    const balances = data.balances ?? [];
    const native = balances.find((b) => b.asset_type === "native");
    const piToken = balances.find(
      (b) => b.asset_code?.toLowerCase() === "pi",
    );
    const balance = parseFloat(piToken?.balance ?? native?.balance ?? "0");
    return {
      address: walletAddress,
      network: networkLabel(),
      piBalance: Number.isFinite(balance) ? balance : 0,
    };
  },
});