"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Asset, BASE_FEE, Keypair, Operation, Server, StellarTomlResolver, TransactionBuilder, Utils } from "stellar-sdk";

// Stellar anchor deposits (SEP-10 + SEP-24), testnet first.
//
// One platform Stellar account receives for everyone; each user is told apart
// by a numeric memo (users.stellarMemo). The anchor treats "G…:memo" as its own
// customer, so KYC is per user and done entirely on the anchor's page.
//
//   startDeposit  — SEP-10 login as platform+memo, then SEP-24 interactive
//                   deposit; returns the anchor's URL for the app to open.
//   scanPayments  — cron: reads the platform account's payments from Horizon
//                   and credits wallet points by memo (anchorDb.recordPayments).
//
// The anchor's signing key, asset issuer and network all come from its
// stellar.toml, so switching anchors = changing the anchorDomain setting.
// Env: STELLAR_PLATFORM_SECRET (the platform account's secret key).

function platformKeypair(): Keypair {
  const secret = process.env.STELLAR_PLATFORM_SECRET;
  if (!secret) throw new Error("STELLAR_PLATFORM_SECRET is not configured in Convex environment variables.");
  return Keypair.fromSecret(secret);
}

async function anchorInfo(domain: string, assetCode: string) {
  const toml = await StellarTomlResolver.resolve(domain);
  const passphrase = toml.NETWORK_PASSPHRASE as string;
  const currency = (toml.CURRENCIES ?? []).find((c: { code?: string }) => c.code === assetCode);
  if (!currency?.issuer) throw new Error(`${domain} doesn't list ${assetCode}`);
  return {
    authUrl: toml.WEB_AUTH_ENDPOINT as string,
    sep24Url: toml.TRANSFER_SERVER_SEP0024 as string,
    signingKey: toml.SIGNING_KEY as string,
    passphrase,
    issuer: currency.issuer as string,
    horizon: passphrase.startsWith("Test")
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org",
  };
}

export const startDeposit = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ url: string; id: string }> => {
    if ((await getAuthUserId(ctx)) !== userId) throw new Error("Unauthorized");
    const { memo, domain, assetCode } = await ctx.runMutation(internal.anchorDb.prepareDeposit, { userId });
    const kp = platformKeypair();
    const a = await anchorInfo(domain, assetCode);

    // SEP-10. readChallengeTx verifies the anchor signed it and that it only
    // holds harmless manage_data ops before we put our signature on it.
    const chRes = await fetch(`${a.authUrl}?account=${kp.publicKey()}&memo=${memo}`);
    if (!chRes.ok) throw new Error(`Anchor auth failed (HTTP ${chRes.status})`);
    const { transaction } = (await chRes.json()) as { transaction: string };
    const { tx } = Utils.readChallengeTx(transaction, a.signingKey, a.passphrase, domain, new URL(a.authUrl).host);
    tx.sign(kp);
    const tokRes = await fetch(a.authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: tx.toXDR() }),
    });
    const { token } = (await tokRes.json()) as { token?: string };
    if (!token) throw new Error("Anchor didn't return an auth token");

    // SEP-24 interactive deposit: the anchor pays the platform account with
    // this user's memo once they finish KYC + payment on its page.
    const depRes = await fetch(`${a.sep24Url}/transactions/deposit/interactive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ asset_code: assetCode, account: kp.publicKey(), memo: String(memo), memo_type: "id" }),
    });
    const dep = (await depRes.json()) as { url?: string; id?: string; error?: string };
    if (!depRes.ok || !dep.url || !dep.id) throw new Error(dep.error ?? `Anchor deposit failed (HTTP ${depRes.status})`);
    return { url: dep.url, id: dep.id };
  },
});

type HorizonPayment = {
  id: string;
  paging_token: string;
  type: string;
  transaction_successful: boolean;
  transaction_hash: string;
  to?: string;
  amount?: string;
  asset_code?: string;
  asset_issuer?: string;
  to_muxed_id?: string;
  transaction?: { memo?: string; memo_type?: string };
  // Soroban token transfers (invoke_host_function): the anchor may pay this
  // way, with the user's memo as the muxed id instead of a tx memo.
  asset_balance_changes?: {
    type: string;
    to?: string;
    amount: string;
    asset_code?: string;
    asset_issuer?: string;
    destination_muxed_id?: string;
  }[];
};

export const scanPayments = internalAction({
  args: {},
  handler: async (ctx): Promise<{ recorded: number }> => {
    if (!process.env.STELLAR_PLATFORM_SECRET) return { recorded: 0 };
    const cfg = await ctx.runQuery(internal.anchorDb.scanConfig, {});
    if (cfg.pointsPerUnit <= 0) return { recorded: 0 }; // deposits off: leave the cursor so nothing is skipped
    const account = platformKeypair().publicKey();
    const a = await anchorInfo(cfg.domain, cfg.assetCode);

    const url = `${a.horizon}/accounts/${account}/payments?order=asc&limit=100&join=transactions&cursor=${cfg.cursor}`;
    const res = await fetch(url);
    if (res.status === 404) return { recorded: 0 }; // account not funded yet
    if (!res.ok) throw new Error(`Horizon HTTP ${res.status}`);
    const records = ((await res.json()) as { _embedded: { records: HorizonPayment[] } })._embedded.records;
    if (!records.length) return { recorded: 0 };

    // Only real transfers of the anchor's exact asset (code AND issuer: anyone
    // can mint a fake "SRT") into the platform account count. The user is the
    // tx memo (MEMO_ID) or the muxed id, whichever the sender used.
    const payments = records.filter((p) => p.transaction_successful).flatMap((p) => {
      const txMemo = p.transaction?.memo_type === "id" ? p.transaction.memo : undefined;
      const transfers = ["payment", "path_payment_strict_receive", "path_payment_strict_send"].includes(p.type)
        ? [{ to: p.to, amount: p.amount!, asset_code: p.asset_code, asset_issuer: p.asset_issuer, muxed: p.to_muxed_id, key: p.id }]
        : p.type === "invoke_host_function"
          ? (p.asset_balance_changes ?? [])
              .filter((c) => c.type === "transfer")
              .map((c, i) => ({ ...c, muxed: c.destination_muxed_id, key: `${p.id}:${i}` }))
          : [];
      return transfers
        .filter((t) => t.to === account && t.asset_code === cfg.assetCode && t.asset_issuer === a.issuer)
        .map((t) => {
          const memo = txMemo ?? t.muxed;
          return {
            opId: t.key,
            txHash: p.transaction_hash,
            amount: Number(t.amount),
            memo: memo !== undefined && /^\d+$/.test(memo) ? Number(memo) : undefined,
          };
        });
    });

    await ctx.runMutation(internal.anchorDb.recordPayments, {
      payments,
      cursor: records[records.length - 1].paging_token,
    });
    return { recorded: payments.length };
  },
});

// One-off testnet setup: fund the platform account from friendbot and add the
// trustline for the anchor's asset. `npx convex run anchor:setupAccount`
export const setupAccount = internalAction({
  args: {},
  handler: async (ctx): Promise<{ account: string; trusts: string }> => {
    const cfg = await ctx.runQuery(internal.anchorDb.scanConfig, {});
    const kp = platformKeypair();
    const a = await anchorInfo(cfg.domain, cfg.assetCode);
    const server = new Server(a.horizon);
    let account = await server.loadAccount(kp.publicKey()).catch(() => null);
    if (!account) {
      if (!a.passphrase.startsWith("Test")) throw new Error(`Fund ${kp.publicKey()} with XLM first`);
      await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
      account = await server.loadAccount(kp.publicKey());
    }
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: a.passphrase })
      .addOperation(Operation.changeTrust({ asset: new Asset(cfg.assetCode, a.issuer) }))
      .setTimeout(60)
      .build();
    tx.sign(kp);
    await server.submitTransaction(tx);
    return { account: kp.publicKey(), trusts: `${cfg.assetCode}:${a.issuer}` };
  },
});
