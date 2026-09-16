import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { appendLedger, economyOfUser } from "./lib/ledger";

// ─── Real Sidra Chain (EVM) deposits ─────────────────────────────────────────
//
// Users send native SIDRA from their registered Sidra address (users.payoutEvm)
// to the platform address. A deposit is credited only after the transaction is
// verified straight from a Sidra Chain RPC node:
//
//   • receipt status is success
//   • `to`   is the platform address
//   • `from` is the user's registered address   ← attribution + anti-theft
//   • value > 0, and it has enough confirmations
//
// Two ways a deposit gets in:
//   manual — user pastes the tx hash            (submitSidraDeposit)
//   scan   — the poller sees it on the explorer  (scanPlatformDeposits, cron)
// Both funnel into verifyDeposit, so the RPC node is always the source of truth
// and one tx hash can never be credited twice.
//
// SIDRA is NEVER held as a wallet balance. A verified deposit is converted to
// POINTS at the pointsPerSidra rate in force at that instant, and a "withdraw
// to SIDRA" debits points at the rate in force at request time (wallets.ts).
// The platform therefore never carries a SIDRA liability whose value users
// could time against a moving price.

/** Admin-set conversion rate (platformSettings key "pointsPerSidra"). 0 = unset. */
export async function readPointsPerSidra(ctx: QueryCtx | MutationCtx): Promise<number> {
  const setting = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", "pointsPerSidra"))
    .unique();
  const n = Number(setting?.value ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const RPC_URL = () => process.env.SIDRA_RPC_URL ?? "https://node.sidrachain.com";
const EXPLORER_API = () => process.env.SIDRA_EXPLORER_API_URL ?? "https://ledger.sidrachain.com/api";
const MIN_CONFIRMATIONS = () => Number(process.env.SIDRA_MIN_CONFIRMATIONS ?? "3");
const RETRY_MS = 30_000;
const MAX_ATTEMPTS = 60; // 60 × 30 s = 30 min before giving up on a tx that never appears
const WEI = 10n ** 18n;

const TX_HASH_RE = /^0x[0-9a-f]{64}$/;

function weiToSidra(hex: string): number {
  const wei = BigInt(hex);
  const whole = wei / WEI;
  const frac = wei % WEI;
  return Number(whole) + Number(frac) / 1e18;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Sidra RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(`Sidra RPC: ${json.error.message ?? "unknown error"}`);
  return json.result as T;
}

type RpcTx = { hash: string; from: string; to: string | null; value: string; blockNumber: string | null };
type RpcReceipt = { status: string; blockNumber: string };

// ─── Public ──────────────────────────────────────────────────────────────────

/** Platform's receiving Sidra Chain address (admin-set platformSettings key). */
export const getPlatformSidraAddress = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "platformSidraAddress"))
      .unique();
    return setting?.value ?? null;
  },
});

/** Current SIDRA ⇄ points rate shown in the app. */
export const getSidraRate = query({
  args: {},
  handler: async (ctx) => ({ pointsPerSidra: await readPointsPerSidra(ctx) }),
});

/** User pastes the hash of a SIDRA transfer they sent to the platform address. */
export const submitSidraDeposit = mutation({
  args: { userId: v.id("users"), txHash: v.string() },
  handler: async (ctx, { userId, txHash }) => {
    const user = await requireUser(ctx, userId);
    const hash = txHash.trim().toLowerCase();
    if (!TX_HASH_RE.test(hash)) {
      throw new Error("That doesn't look like a Sidra Chain transaction hash (0x + 64 hex characters).");
    }

    const from = user.payoutEvm?.trim().toLowerCase();
    if (!from) {
      throw new Error(
        "Add your Sidra Chain address in Settings first — deposits are credited to the address they were sent from.",
      );
    }

    const existing = await ctx.db
      .query("sidraDeposits")
      .withIndex("by_txHash", (q) => q.eq("txHash", hash))
      .unique();
    if (existing) {
      // A hash that failed verification (e.g. rate wasn't configured yet, or
      // it hadn't confirmed in time) may be retried; a live or paid one may not.
      if (existing.status !== "failed") throw new Error("This transaction has already been submitted.");
      await ctx.db.patch(existing._id, {
        userId,
        fromAddress: from,
        status: "pending",
        failReason: undefined,
        attempts: 0,
      });
      await ctx.scheduler.runAfter(0, internal.sidra.verifyDeposit, { depositId: existing._id });
      return { depositId: existing._id, status: "pending" as const };
    }

    const depositId = await ctx.db.insert("sidraDeposits", {
      userId,
      txHash: hash,
      fromAddress: from,
      amount: 0,
      status: "pending",
      source: "manual",
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.sidra.verifyDeposit, { depositId });
    return { depositId, status: "pending" as const };
  },
});

export const getSidraDepositHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    return await ctx.db
      .query("sidraDeposits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

// ─── Internal ────────────────────────────────────────────────────────────────

export const getDepositInternal = internalQuery({
  args: { depositId: v.id("sidraDeposits") },
  handler: async (ctx, { depositId }) => ctx.db.get(depositId),
});

export const getPlatformAddressInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "platformSidraAddress"))
      .unique();
    return setting?.value?.trim().toLowerCase() ?? null;
  },
});

export const bumpAttempts = internalMutation({
  args: { depositId: v.id("sidraDeposits") },
  handler: async (ctx, { depositId }) => {
    const d = await ctx.db.get(depositId);
    if (!d) return 0;
    const attempts = (d.attempts ?? 0) + 1;
    await ctx.db.patch(depositId, { attempts });
    return attempts;
  },
});

export const getRateInternal = internalQuery({
  args: {},
  handler: async (ctx) => readPointsPerSidra(ctx),
});

/**
 * Credits a verified deposit as POINTS at the current rate. Returns 0 (and
 * leaves the row pending) if the rate isn't configured, so the caller can
 * retry rather than lose the user's funds.
 */
export const confirmSidraDeposit = internalMutation({
  args: { depositId: v.id("sidraDeposits"), amount: v.number(), blockNumber: v.number() },
  handler: async (ctx, { depositId, amount, blockNumber }): Promise<number> => {
    const deposit = await ctx.db.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status === "confirmed") return deposit.pointsCredited ?? 0; // idempotent

    const rate = await readPointsPerSidra(ctx);
    if (rate <= 0) return 0;

    const points = Math.floor(amount * rate);
    await ctx.db.patch(depositId, {
      status: "confirmed",
      amount,
      blockNumber,
      pointsPerSidra: rate,
      pointsCredited: points,
      confirmedAt: Date.now(),
    });
    if (points <= 0) return 0;

    const economy = await economyOfUser(ctx, deposit.userId);
    await appendLedger(ctx, deposit.userId, economy, points, "SIDRA_DEPOSIT", `sidra-${deposit.txHash}`);

    // Mirror onto the wallet doc + history, matching every other points credit.
    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", deposit.userId))
      .unique();
    if (!wallet) {
      const id = await ctx.db.insert("wallets", {
        userId: deposit.userId,
        pointsBalance: 0,
        piproBalance: 0,
        vintaBalance: 100,
      });
      wallet = (await ctx.db.get(id))!;
    }
    const newPoints =
      economy === "pi-browser"
        ? (wallet.piBrowserPointsBalance ?? 0) + points
        : wallet.pointsBalance + points;
    await ctx.db.patch(
      wallet._id,
      economy === "pi-browser" ? { piBrowserPointsBalance: newPoints } : { pointsBalance: newPoints },
    );
    await ctx.db.insert("walletTransactions", {
      userId: deposit.userId,
      type: "deposit_sidra",
      pointsDelta: points,
      piproDelta: 0,
      pointsBalanceAfter: newPoints,
      piproBalanceAfter: wallet.piproBalance,
      note: `Sidra deposit: ${amount} SIDRA → ${points} PTS at 1 SIDRA = ${rate} PTS (tx: ${deposit.txHash.slice(0, 12)}…)`,
    });
    return points;
  },
});

export const rejectSidraDeposit = internalMutation({
  args: { depositId: v.id("sidraDeposits"), reason: v.string() },
  handler: async (ctx, { depositId, reason }) => {
    const d = await ctx.db.get(depositId);
    if (!d || d.status === "confirmed") return;
    await ctx.db.patch(depositId, { status: "failed", failReason: reason });
  },
});

/**
 * Verifies one pending deposit against a Sidra Chain RPC node and credits it.
 * Re-schedules itself while the tx is unmined / under-confirmed, so a user who
 * pastes the hash the moment they pay is credited automatically once it lands.
 */
export const verifyDeposit = internalAction({
  args: { depositId: v.id("sidraDeposits") },
  handler: async (ctx, { depositId }): Promise<void> => {
    const deposit = await ctx.runQuery(internal.sidra.getDepositInternal, { depositId });
    if (!deposit || deposit.status !== "pending") return;

    const platform = await ctx.runQuery(internal.sidra.getPlatformAddressInternal, {});
    if (!platform) {
      await ctx.runMutation(internal.sidra.rejectSidraDeposit, {
        depositId,
        reason: "Platform Sidra address is not configured. Contact support.",
      });
      return;
    }

    const retry = async (): Promise<void> => {
      const attempts: number = await ctx.runMutation(internal.sidra.bumpAttempts, { depositId });
      if (attempts >= MAX_ATTEMPTS) {
        await ctx.runMutation(internal.sidra.rejectSidraDeposit, {
          depositId,
          reason: "Couldn't complete this deposit yet (not confirmed on Sidra Chain in time, or the conversion rate wasn't available). Submit the hash again later — nothing is lost.",
        });
        return;
      }
      await ctx.scheduler.runAfter(RETRY_MS, internal.sidra.verifyDeposit, { depositId });
    };

    let tx: RpcTx | null;
    let receipt: RpcReceipt | null;
    let head: string;
    try {
      tx = await rpc<RpcTx | null>("eth_getTransactionByHash", [deposit.txHash]);
      if (!tx) return retry(); // not propagated yet
      receipt = await rpc<RpcReceipt | null>("eth_getTransactionReceipt", [deposit.txHash]);
      if (!receipt || !receipt.blockNumber) return retry(); // still in the mempool
      head = await rpc<string>("eth_blockNumber", []);
    } catch {
      return retry(); // RPC hiccup — try again shortly
    }

    if (receipt.status !== "0x1") {
      await ctx.runMutation(internal.sidra.rejectSidraDeposit, { depositId, reason: "Transaction failed on-chain." });
      return;
    }
    if ((tx.to ?? "").toLowerCase() !== platform) {
      await ctx.runMutation(internal.sidra.rejectSidraDeposit, {
        depositId,
        reason: "This transaction was not sent to the platform's Sidra address.",
      });
      return;
    }
    if (tx.from.toLowerCase() !== deposit.fromAddress) {
      await ctx.runMutation(internal.sidra.rejectSidraDeposit, {
        depositId,
        reason: "This transaction was sent from an address that isn't your registered Sidra address.",
      });
      return;
    }

    const amount = weiToSidra(tx.value);
    if (!(amount > 0)) {
      await ctx.runMutation(internal.sidra.rejectSidraDeposit, { depositId, reason: "Transaction carried no SIDRA." });
      return;
    }

    const blockNumber = Number(BigInt(receipt.blockNumber));
    const confirmations = Number(BigInt(head)) - blockNumber + 1;
    if (confirmations < MIN_CONFIRMATIONS()) return retry();

    // The tx is good. If the points rate isn't configured the deposit stays
    // pending and we keep retrying — it can also be re-submitted later.
    const rate: number = await ctx.runQuery(internal.sidra.getRateInternal, {});
    if (rate <= 0) return retry();

    await ctx.runMutation(internal.sidra.confirmSidraDeposit, { depositId, amount, blockNumber });
  },
});

// ─── Auto-detection ──────────────────────────────────────────────────────────

export const findUserByPayoutEvm = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_payoutEvm", (q) => q.eq("payoutEvm", address))
      .first();
    return u ? { _id: u._id } : null;
  },
});

export const hasDepositForHash = internalQuery({
  args: { txHash: v.string() },
  handler: async (ctx, { txHash }) => {
    const d = await ctx.db
      .query("sidraDeposits")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .unique();
    return d !== null;
  },
});

export const insertScannedDeposit = internalMutation({
  args: { userId: v.id("users"), txHash: v.string(), fromAddress: v.string() },
  handler: async (ctx, { userId, txHash, fromAddress }) => {
    const dup = await ctx.db
      .query("sidraDeposits")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .unique();
    if (dup) return null;
    const depositId = await ctx.db.insert("sidraDeposits", {
      userId,
      txHash,
      fromAddress,
      amount: 0,
      status: "pending",
      source: "scan",
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.sidra.verifyDeposit, { depositId });
    return depositId;
  },
});

type ExplorerTx = {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  isError?: string;
  txreceipt_status?: string;
};

/**
 * Cron: look at recent transfers INTO the platform address on the block
 * explorer and queue any from a registered user address that we haven't seen.
 * The explorer is only used for discovery — verifyDeposit still checks the RPC
 * node before a single SIDRA is credited. Best-effort: any explorer problem
 * just means users fall back to pasting the hash themselves.
 */
export const scanPlatformDeposits = internalAction({
  args: {},
  handler: async (ctx): Promise<{ queued: number }> => {
    const platform = await ctx.runQuery(internal.sidra.getPlatformAddressInternal, {});
    if (!platform) return { queued: 0 };

    let txs: ExplorerTx[];
    try {
      const url = `${EXPLORER_API()}?module=account&action=txlist&address=${platform}&sort=desc&page=1&offset=50`;
      const res = await fetch(url);
      if (!res.ok) return { queued: 0 };
      const json = (await res.json()) as { status?: string; result?: unknown };
      if (!Array.isArray(json.result)) return { queued: 0 };
      txs = json.result as ExplorerTx[];
    } catch {
      return { queued: 0 };
    }

    let queued = 0;
    for (const t of txs) {
      const hash = t.hash?.toLowerCase();
      const from = t.from?.toLowerCase();
      const to = t.to?.toLowerCase();
      if (!hash || !from || to !== platform) continue;
      if (t.isError === "1" || t.txreceipt_status === "0") continue;
      if (!TX_HASH_RE.test(hash)) continue;
      let value = 0n;
      try { value = BigInt(t.value ?? "0"); } catch { continue; }
      if (value <= 0n) continue;

      const seen: boolean = await ctx.runQuery(internal.sidra.hasDepositForHash, { txHash: hash });
      if (seen) continue;
      const user: { _id: Id<"users"> } | null = await ctx.runQuery(internal.sidra.findUserByPayoutEvm, { address: from });
      if (!user) continue; // sender isn't a registered address — nothing to attribute to

      const id: Id<"sidraDeposits"> | null = await ctx.runMutation(internal.sidra.insertScannedDeposit, {
        userId: user._id as Id<"users">,
        txHash: hash,
        fromAddress: from,
      });
      if (id) queued++;
    }
    return { queued };
  },
});
