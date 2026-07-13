import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

const router = httpRouter();
router.route({ path: "/survey/postback", method: "POST", handler: handleSurveyPostback });
router.route({ path: "/vas/webhook", method: "POST", handler: handleVasWebhook });
export default router;
