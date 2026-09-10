import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Extract the channel/group username from a Telegram URL (t.me/<name>).
function channelFromUrl(url: string): string | null {
  const m = url.match(/t\.me\/([A-Za-z0-9_]+)/i);
  return m ? m[1] : null;
}

// Data the membership check needs: the user's linked Telegram id + the task's
// channel username.
export const getCheckData = internalQuery({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    const verification = await ctx.db.get(verificationId);
    if (!verification) return null;
    const [user, task] = await Promise.all([
      ctx.db.get(verification.userId),
      ctx.db.get(verification.taskId),
    ]);
    if (!user || !task) return null;
    return {
      telegramUserId: user.telegramUserId ?? null,
      channelUsername: channelFromUrl(task.targetUrl),
    };
  },
});

// Real membership verification (§7.3 / Tier 4). Kicked off by
// verifications.verifyTelegram. The bot MUST be an admin of the target channel
// for getChatMember to work — otherwise Telegram returns an error and we reject.
// Fails closed: no token / no linked Telegram id / no channel → reject.
export const check = internalAction({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const data = await ctx.runQuery(internal.telegram.getCheckData, { verificationId });

    if (!token || !data?.telegramUserId || !data?.channelUsername) {
      console.log("[Telegram check] skipped — missing config", {
        hasToken: !!token,
        telegramUserId: data?.telegramUserId ?? null,
        channelUsername: data?.channelUsername ?? null,
      });
      await ctx.runMutation(internal.telegram.applyResult, { verificationId, isMember: false });
      return;
    }

    let isMember = false;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${data.channelUsername}&user_id=${data.telegramUserId}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        result?: { status: string };
        description?: string;
      };
      if (!json.ok) {
        // Bot not admin / channel private / invalid handle — log for setup.
        console.log(
          `[Telegram check] API error for @${data.channelUsername}: ${json.description ?? "unknown"}`,
        );
      }
      isMember =
        json.ok &&
        ["member", "administrator", "creator"].includes(json.result?.status ?? "");
    } catch (err) {
      console.error("[Telegram check] getChatMember error:", err);
      isMember = false;
    }

    await ctx.runMutation(internal.telegram.applyResult, { verificationId, isMember });
  },
});

export const applyResult = internalMutation({
  args: { verificationId: v.id("verifications"), isMember: v.boolean() },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification || verification.state !== "PROOF_SUBMITTED") return;

    if (args.isMember) {
      const task = await ctx.db.get(verification.taskId);
      if (!task) return;
      // TODO(prod): 48h per plan §5. Short hold in dev so the flow is testable.
      const holdUntil = Date.now() + 60 * 1000;
      await ctx.db.patch(args.verificationId, { state: "PENDING_HOLD", holdUntil });
      await ctx.scheduler.runAt(holdUntil, internal.verifications.release, {
        verificationId: args.verificationId,
      });
    } else {
      await ctx.db.patch(args.verificationId, { state: "REJECTED" });
    }
  },
});
