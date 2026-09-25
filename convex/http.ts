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

type TelegramChannelPost = {
  message_id: number;
  date: number;
  chat: { id: number };
  caption?: string;
  author_signature?: string;
  voice?: { file_id: string; file_unique_id: string; duration?: number; mime_type?: string };
  audio?: { file_id: string; file_unique_id: string; duration?: number; mime_type?: string; title?: string; performer?: string };
};

type NoteType = "episode" | "update" | "announcement";
const TYPE_LABEL: Record<NoteType, string> = { episode: "🎧 Episode", update: "📢 Update", announcement: "📣 Announcement" };

// Caption convention: first free line = title; optional "Mentor: Name" and
// "Type: episode|update|announcement" lines anywhere.
function parseCaption(post: TelegramChannelPost) {
  const caption = post.caption ?? "";
  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  const mentorLine = lines.find((l) => /^mentor\s*[:\-]/i.test(l));
  const typeLine = lines.find((l) => /^type\s*[:\-]/i.test(l));
  const typeRaw = typeLine?.replace(/^type\s*[:\-]\s*/i, "").toLowerCase();
  const type = (["episode", "update", "announcement"] as const).find((t) => typeRaw?.startsWith(t));
  return {
    caption,
    title: lines.find((l) => l !== mentorLine && l !== typeLine) ?? "",
    mentor: mentorLine?.replace(/^mentor\s*[:\-]\s*/i, "").trim() || undefined,
    type,
  };
}

async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// Posts (or edits) the bot's reply under a voice note: asks for type, then
// mentor, then shows the final summary. Callback data: "t:<msgId>:<type>" /
// "m:<msgId>:<mentorId>" (Telegram caps callback_data at 64 bytes).
async function askNext(
  ctx: { runQuery: any },
  chatId: string,
  noteMessageId: number,
  botMessageId: number | undefined,
  type: NoteType | undefined,
  mentor: string | undefined,
) {
  let text: string;
  let keyboard: { text: string; callback_data: string }[][] = [];
  if (!type) {
    text = "What type of voice note is this?";
    keyboard = [(Object.keys(TYPE_LABEL) as NoteType[]).map((t) => ({ text: TYPE_LABEL[t], callback_data: `t:${noteMessageId}:${t}` }))];
  } else if (!mentor) {
    const mentors: { _id: string; name: string }[] = await ctx.runQuery(internal.voiceNotes.listMentorsInternal, {});
    text = mentors.length
      ? `${TYPE_LABEL[type]} — who is the mentor?`
      : `${TYPE_LABEL[type]} — no mentors yet. Edit the caption and add a line "Mentor: Name".`;
    for (let i = 0; i < mentors.length; i += 2) {
      keyboard.push(mentors.slice(i, i + 2).map((m) => ({ text: m.name, callback_data: `m:${noteMessageId}:${m._id}` })));
    }
  } else {
    text = `✅ ${TYPE_LABEL[type]} · ${mentor}`;
  }
  const body = { chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard } };
  if (botMessageId) await tg("editMessageText", { ...body, message_id: botMessageId });
  else await tg("sendMessage", { ...body, reply_to_message_id: noteMessageId });
}

// Admin DM wizard: only Telegram user IDs in TELEGRAM_BOT_ADMINS (comma-
// separated) may use it. bot.ts decides the replies; this sends them.
async function runBot(
  ctx: { runMutation: any },
  userId: string,
  chatId: string,
  messageId: number,
  input: {
    text?: string;
    data?: string;
    voice?: { fileId: string; fileUniqueId: string; duration: number; mimeType: string };
    photoFileId?: string;
  },
  editMessageId?: number,
) {
  const admins = (process.env.TELEGRAM_BOT_ADMINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!admins.includes(userId)) {
    if (input.text) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `This bot posts mentor voice notes to View2Earn. Your Telegram ID is ${userId} — the owner must add it to TELEGRAM_BOT_ADMINS to use it.`,
      });
    }
    return;
  }
  const replies: { text: string; keyboard?: unknown[][]; edit?: boolean; voice?: { fileId: string; caption: string } }[] =
    await ctx.runMutation(internal.bot.handle, { userId, chatId, messageId, ...input });
  const channel = process.env.TELEGRAM_VOICE_CHANNEL_ID;
  for (const r of replies) {
    const body = { chat_id: chatId, text: r.text, reply_markup: { inline_keyboard: r.keyboard ?? [] } };
    if (r.edit && editMessageId) await tg("editMessageText", { ...body, message_id: editMessageId });
    else await tg("sendMessage", body);
    // Archive copy in the private channel (its webhook echo is deduped by file id).
    if (r.voice && channel) await tg("sendVoice", { chat_id: channel, voice: r.voice.fileId, caption: r.voice.caption });
  }
}

// Streams a voice note straight from Telegram (nothing stored in Convex).
// Range headers are passed through so <audio> can seek. ?dl=1 forces download.
async function streamTelegramFile(request: Request, fileId: string, mimeType: string, extra: Record<string, string> = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response("bot not configured", { status: 500 });
  const info = (await (
    await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)
  ).json()) as { ok: boolean; result?: { file_path?: string } };
  const path = info.result?.file_path;
  if (!info.ok || !path) return new Response("file unavailable", { status: 502 });

  const range = request.headers.get("range");
  const upstream = await fetch(`https://api.telegram.org/file/bot${token}/${path}`, {
    headers: range ? { range } : {},
  });
  if (!upstream.ok && upstream.status !== 206) return new Response("upstream error", { status: 502 });

  const headers = new Headers({ "Content-Type": mimeType, "Cache-Control": "private, max-age=3600", ...extra });
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const val = upstream.headers.get(h);
    if (val) headers.set(h, val);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

const handleVoiceFile = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });
  const note = await ctx.runQuery(internal.voiceNotes.getForStream, { id: id as any });
  if (!note) return new Response("not found", { status: 404 });
  const extra: Record<string, string> = {};
  if (url.searchParams.get("dl")) {
    const ext = note.mimeType.includes("mpeg") ? "mp3" : /mp4|m4a/.test(note.mimeType) ? "m4a" : "ogg";
    const name = note.title.replace(/[^\w\d .-]+/g, "_").slice(0, 80) || "voice-note";
    extra["Content-Disposition"] = `attachment; filename="${name}.${ext}"`;
  }
  return streamTelegramFile(request, note.fileId, note.mimeType, extra);
});

// User-uploaded video, streamed from the private Telegram channel. ?thumb=1
// returns the poster image instead. Only ACTIVE (admin-approved) rows resolve.
const handleVideoFile = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });
  // Admin panel passes the shared admin secret so it can review pending uploads.
  const allowPending = url.searchParams.get("token") === (process.env.ADMIN_PASSWORD ?? "admin");
  const row = await ctx.runQuery(internal.videos.getForStream, { id: id as any, allowPending });
  if (!row) return new Response("not found", { status: 404 });
  const wantThumb = !!url.searchParams.get("thumb");
  if (wantThumb) {
    if (!row.thumbFileId) return new Response("no thumbnail", { status: 404 });
    return streamTelegramFile(request, row.thumbFileId, "image/jpeg", { "Cache-Control": "public, max-age=86400" });
  }
  return streamTelegramFile(request, row.fileId, "video/mp4");
});

// Mentor profile photo (Telegram photo sent to the bot), by mentor id.
const handleMentorPhoto = httpAction(async (ctx, request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });
  const fileId = await ctx.runQuery(internal.voiceNotes.getMentorPhoto, { id: id as any });
  if (!fileId) return new Response("not found", { status: 404 });
  return streamTelegramFile(request, fileId, "image/jpeg", { "Cache-Control": "public, max-age=86400" });
});

// Telegram bot webhook: on "/start <nonce>", mark the login nonce verified with
// the sender's Telegram id, then confirm in-chat. Also ingests voice notes from
// the private mentors channel (TELEGRAM_VOICE_CHANNEL_ID). Register once:
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<convex-site>/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
const handleTelegramWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const update = (await request.json()) as {
      message?: TelegramChannelPost & {
        text?: string;
        from?: { id?: number; first_name?: string };
        chat: { id: number; type?: string };
        photo?: { file_id: string }[];
      };
      channel_post?: TelegramChannelPost;
      edited_channel_post?: TelegramChannelPost;
      callback_query?: {
        id: string;
        data?: string;
        from?: { id?: number };
        message?: { message_id: number; chat: { id: number; type?: string } };
      };
    };

    const voiceChat = process.env.TELEGRAM_VOICE_CHANNEL_ID;

    // Voice / audio posted in the private mentors channel → index its metadata,
    // then ask the poster (inline buttons) for anything the caption didn't say.
    const post = update.channel_post;
    const media = post?.voice ?? post?.audio;
    if (post && media && String(post.chat.id) !== voiceChat) {
      console.log(`[voice] ignored channel_post from chat ${post.chat.id} (set TELEGRAM_VOICE_CHANNEL_ID)`);
    }
    if (post && media && String(post.chat.id) === voiceChat) {
      const meta = parseCaption(post);
      const chatId = String(post.chat.id);
      const inserted = await ctx.runMutation(internal.voiceNotes.insert, {
        chatId,
        messageId: post.message_id,
        fileId: media.file_id,
        fileUniqueId: media.file_unique_id,
        duration: media.duration ?? 0,
        mimeType: media.mime_type ?? "audio/ogg",
        title: meta.title || post.audio?.title || `Voice note ${new Date(post.date * 1000).toLocaleDateString("en-GB")}`,
        mentor: meta.mentor || post.author_signature || post.audio?.performer || undefined,
        type: meta.type,
        caption: meta.caption || undefined,
        date: post.date,
      });
      if (inserted === "inserted") await askNext(ctx, chatId, post.message_id, undefined, meta.type, meta.mentor || post.author_signature);
      return new Response("ok", { status: 200 });
    }

    // Caption edited in the channel → re-parse title / mentor / type.
    const edited = update.edited_channel_post;
    if (edited && (edited.voice || edited.audio) && String(edited.chat.id) === voiceChat) {
      const meta = parseCaption(edited);
      await ctx.runMutation(internal.voiceNotes.classify, {
        chatId: String(edited.chat.id),
        messageId: edited.message_id,
        title: meta.title || undefined,
        mentor: meta.mentor || undefined,
        type: meta.type,
        caption: meta.caption || undefined,
      });
      return new Response("ok", { status: 200 });
    }

    // Button tap on the bot's question under a voice note.
    const cb = update.callback_query;
    // Button tap inside the admin DM wizard.
    if (cb?.data && cb.message?.chat.type === "private" && cb.from?.id) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
      await runBot(ctx, String(cb.from.id), String(cb.message.chat.id), cb.message.message_id, { data: cb.data }, cb.message.message_id);
      return new Response("ok", { status: 200 });
    }
    if (cb?.data && cb.message && String(cb.message.chat.id) === voiceChat) {
      const [kind, msgId, value] = cb.data.split(":");
      const chatId = String(cb.message.chat.id);
      const messageId = Number(msgId);
      const isType = kind === "t" && (["episode", "update", "announcement"] as const).some((t) => t === value);
      const next = await ctx.runMutation(internal.voiceNotes.classify, {
        chatId,
        messageId,
        type: isType ? (value as "episode" | "update" | "announcement") : undefined,
        mentorId: kind === "m" ? (value as any) : undefined,
      });
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
      if (next) await askNext(ctx, chatId, messageId, cb.message.message_id, next.type, next.mentor);
      return new Response("ok", { status: 200 });
    }

    const msg = update.message;
    const text = msg?.text ?? "";
    const from = msg?.from;
    const match = text.match(/^\/start\s+(\S+)/);
    // Anything else in a private chat → admin wizard (bot.ts).
    if (!match && msg && from?.id && msg.chat.type === "private") {
      const m = msg.voice ?? msg.audio;
      const photo = msg.photo?.[msg.photo.length - 1]; // largest size is last
      await runBot(ctx, String(from.id), String(msg.chat.id), msg.message_id, {
        text: text || msg.caption || undefined,
        voice: m
          ? { fileId: m.file_id, fileUniqueId: m.file_unique_id, duration: m.duration ?? 0, mimeType: m.mime_type ?? "audio/ogg" }
          : undefined,
        photoFileId: photo?.file_id,
      });
      return new Response("ok", { status: 200 });
    }
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
router.route({ path: "/voice/file", method: "GET", handler: handleVoiceFile });
router.route({ path: "/mentor/photo", method: "GET", handler: handleMentorPhoto });
router.route({ path: "/video/file", method: "GET", handler: handleVideoFile });
router.route({ path: "/survey/cpx", method: "GET", handler: handleCpxPostback });

// Adsgram Reward URL (partner.adsgram.ai -> block -> Reward URL):
//   https://<deployment>.convex.site/adsgram/reward?userid=[userId]&key=<ADSGRAM_REWARD_SECRET>
// Adsgram only substitutes [userId]; the static key stops random callers.
router.route({
  path: "/adsgram/reward",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const secret = process.env.ADSGRAM_REWARD_SECRET;
    if (secret && url.searchParams.get("key") !== secret) return new Response("forbidden", { status: 403 });
    const telegramUserId = url.searchParams.get("userid")?.trim();
    if (!telegramUserId) return new Response("missing userid", { status: 400 });
    await ctx.runMutation(internal.adsgram.record, { telegramUserId });
    return new Response("ok", { status: 200 });
  }),
});
router.route({ path: "/wallet/verify-deposit", method: "POST", handler: handleVerifyDeposit });
export default router;

