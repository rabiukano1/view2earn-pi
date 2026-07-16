import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

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

const handleVasWebhook = httpAction(async (_ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = await request.json() as { ref?: string };
    if (!body.ref) {
      return new Response("Missing ref", { status: 400 });
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

const router = httpRouter();
auth.addHttpRoutes(router); // Convex Auth sign-in/OAuth callback routes
router.route({ path: "/survey/postback", method: "POST", handler: handleSurveyPostback });
router.route({ path: "/vas/webhook", method: "POST", handler: handleVasWebhook });
router.route({ path: "/telegram/webhook", method: "POST", handler: handleTelegramWebhook });
export default router;
