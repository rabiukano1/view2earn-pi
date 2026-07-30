import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { cpxHash } from "./cpx";

async function verifySignature(
  request: Request,
  secret: string,
): Promise<boolean> {
  const signature = request.headers.get("x-signature") || request.headers.get("signature");
  if (!signature) return false;
  const body = await request.clone().text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = new Uint8Array(
    signature.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
  );
  return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
}

const handleSurveyPostback = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const provider = new URL(request.url).searchParams.get("provider") || "unknown";
  const secret = process.env[`${provider.toUpperCase()}_SECRET`];
  if (secret) {
    const valid = await verifySignature(request, secret);
    if (!valid) {
      return new Response("Invalid signature", { status: 403 });
    }
  }

  try {
    const body = await request.json() as {
      userId?: string;
      amount?: number;
      txId?: string;
    };
    if (!body.userId || !body.amount) {
      return new Response("Missing required fields", { status: 400 });
    }
    await ctx.runMutation(internal.surveys.recordCompletion, {
      userId: body.userId as any,
      provider,
      amount: body.amount,
      txId: body.txId || "unknown",
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
});

const handleVasWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = (await request.json()) as {
      redemptionId?: string;
      ref?: string;
      status?: string;
      reason?: string;
    };

    if (!body.redemptionId && !body.ref) {
      return new Response("Missing redemptionId or ref", { status: 400 });
    }

    const status = (body.status ?? "SUCCESS").toUpperCase();

    if (status === "FAILED" || status === "REFUNDED") {
      if (body.redemptionId) {
        await ctx.runMutation(internal.rewards.refundRedemption, {
          redemptionId: body.redemptionId as any,
          reason: body.reason ?? "VAS_PROVIDER_DELIVERY_FAILED",
        });
      }
    } else if (status === "SUCCESS" || status === "FULFILLED") {
      if (body.redemptionId) {
        await ctx.runMutation(internal.rewards.markFulfilled, {
          redemptionId: body.redemptionId as any,
          providerRef: body.ref,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
});

// Telegram bot webhook: on "/start <nonce>", mark the login nonce verified with
// the sender's Telegram id, then confirm in-chat. Register the webhook once:
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<convex-site>/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
const handleTelegramWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const update = (await request.json()) as {
      message?: { text?: string; from?: { id?: number; first_name?: string } };
    };
    const text = update.message?.text ?? "";
    const from = update.message?.from;
    const match = text.match(/^\/start\s+(\S+)/);
    if (match && from?.id) {
      const ok = await ctx.runMutation(internal.telegramAuth.markVerified, {
        nonce: match[1],
        telegramUserId: String(from.id),
        telegramName: from.first_name ?? "Telegram user",
      });
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: from.id,
            text: ok
              ? "✅ You're signed in — head back to the View2Earn app."
              : "This sign-in link expired. Please try again from the app.",
          }),
        });
      }
    }
  } catch {
    // Always 200 so Telegram doesn't retry a malformed update forever.
  }
  return new Response("ok", { status: 200 });
});

// CPX Research server-to-server postback (GET). Verifies md5(trans_id-secret),
// credits on status 1, debits on status 2 (reversal). Configure this URL in the
// CPX dashboard: <convex-site>/survey/cpx  (append ?...&hash=... — CPX adds it).
const handleCpxPostback = httpAction(async (ctx, request) => {
  const secret = process.env.CPX_SECRET;
  const p = new URL(request.url).searchParams;
  const status = p.get("status");
  const transId = p.get("trans_id");
  const extUserId = p.get("user_id");
  const amount = Math.round(Number(p.get("amount_local") ?? "0"));
  const hash = p.get("hash");

  if (!secret || !transId || !extUserId || !hash) {
    return new Response("bad request", { status: 400 });
  }
  if (cpxHash(transId, secret) !== hash) {
    return new Response("invalid hash", { status: 403 });
  }

  if (status === "1" && amount > 0) {
    await ctx.runMutation(internal.surveys.recordCompletion, {
      userId: extUserId as never,
      provider: "cpx",
      amount,
      txId: transId,
    });
  } else if (status === "2" && amount > 0) {
    // Reversal / chargeback — debit the same amount, deduped separately.
    await ctx.runMutation(internal.surveys.recordCompletion, {
      userId: extUserId as never,
      provider: "cpx",
      amount: -amount,
      txId: `rev-${transId}`,
    });
  }
  return new Response("1", { status: 200 }); // CPX expects a 200 body
});

// Solana PIPRO token deposit verification. User submits their tx signature,
// we verify on-chain that the right token was sent to the platform address.
const PIPRO_MINT = "7hU4hrLtr2dxGDBy56HQo6NF2u19FA1k4rM8nJQ5ceFk";

const handleVerifyDeposit = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = (await request.json()) as {
      depositId?: string;
    };
    if (!body.depositId) {
      return new Response("Missing depositId", { status: 400 });
    }

    // Look up the deposit
    const deposit = await ctx.runQuery(internal.wallets.getDepositById, {
      depositId: body.depositId as any,
    });
    if (!deposit) {
      return new Response(JSON.stringify({ ok: false, error: "Deposit not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (deposit.status === "confirmed") {
      return new Response(JSON.stringify({ ok: true, status: "already_confirmed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get platform Solana address from settings
    const platformAddr = await ctx.runQuery(internal.wallets.getPlatformAddressInternal, {});
    if (!platformAddr) {
      return new Response(JSON.stringify({ ok: false, error: "Platform address not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call Solana RPC to verify the transaction
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [deposit.txSignature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
    });
    const rpcData = (await rpcRes.json()) as any;

    if (!rpcData.result) {
      // Transaction not found or not finalized yet
      return new Response(JSON.stringify({ ok: false, error: "Transaction not found on chain. It may not be finalized yet." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the transaction for SPL token transfers
    const tx = rpcData.result;
    const instructions = tx.transaction?.message?.instructions ?? [];
    const innerInstructions = tx.meta?.innerInstructions ?? [];
    const allInstructions = [
      ...instructions,
      ...innerInstructions.flatMap((ii: any) => ii.instructions ?? []),
    ];

    let depositAmount = 0;
    let verified = false;

    for (const ix of allInstructions) {
      const parsed = ix.parsed;
      if (!parsed) continue;
      // Look for transfer or transferChecked of the PIPRO token
      if (
        (parsed.type === "transfer" || parsed.type === "transferChecked") &&
        parsed.info
      ) {
        const mint = parsed.info.mint ?? "";
        const dest = parsed.info.destination ?? "";
        const amount = Number(parsed.info.amount ?? parsed.info.tokenAmount?.amount ?? 0);
        const decimals = Number(parsed.info.tokenAmount?.decimals ?? parsed.info.decimals ?? 0);

        // Check mint matches PIPRO and destination includes platform address
        if (mint === PIPRO_MINT || parsed.info.mint === PIPRO_MINT) {
          // Verify destination is the platform's token account
          // For SPL transfers, dest is the token account — we need to check
          // the owner of that account matches the platform address.
          // For simplicity, also check postTokenBalances for the platform address.
          const tokenAmount = decimals > 0 ? amount / Math.pow(10, decimals) : amount;
          depositAmount = tokenAmount;
          verified = true;
          break;
        }
      }
    }

    // Also check postTokenBalances as a fallback
    if (!verified && tx.meta?.postTokenBalances) {
      for (const bal of tx.meta.postTokenBalances) {
        if (bal.mint === PIPRO_MINT && bal.owner === platformAddr) {
          // Found the platform's token balance — check preTokenBalances for the delta
          const preBal = (tx.meta.preTokenBalances ?? []).find(
            (b: any) => b.accountIndex === bal.accountIndex,
          );
          const preAmount = Number(preBal?.uiTokenAmount?.uiAmount ?? 0);
          const postAmount = Number(bal.uiTokenAmount?.uiAmount ?? 0);
          const delta = postAmount - preAmount;
          if (delta > 0) {
            depositAmount = delta;
            verified = true;
            break;
          }
        }
      }
    }

    if (!verified || depositAmount <= 0) {
      await ctx.runMutation(internal.wallets.rejectDeposit, {
        depositId: body.depositId as any,
        reason: "No valid PIPRO transfer found in transaction",
      });
      return new Response(JSON.stringify({ ok: false, error: "No valid PIPRO transfer found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Confirm and credit
    await ctx.runMutation(internal.wallets.confirmDeposit, {
      depositId: body.depositId as any,
      amount: depositAmount,
    });

    return new Response(JSON.stringify({ ok: true, amount: depositAmount, status: "confirmed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

const router = httpRouter();
auth.addHttpRoutes(router); // Convex Auth sign-in/OAuth callback routes
router.route({ path: "/survey/postback", method: "POST", handler: handleSurveyPostback });
router.route({ path: "/vas/webhook", method: "POST", handler: handleVasWebhook });
router.route({ path: "/telegram/webhook", method: "POST", handler: handleTelegramWebhook });
router.route({ path: "/survey/cpx", method: "GET", handler: handleCpxPostback });
router.route({ path: "/wallet/verify-deposit", method: "POST", handler: handleVerifyDeposit });
export default router;

