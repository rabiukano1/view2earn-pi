import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Kicked off by verifications.verifyTelegram. In prod, a real getChatMember
// check needs TELEGRAM_BOT_TOKEN plus the user's linked Telegram numeric id +
// channel username (not yet captured for dev users), so until those exist this
// mock-approves — mirroring the mocked aiCheck confidence in verifications.ts.
export const check = internalAction({
  args: { verificationId: v.id("verifications") },
  handler: async (ctx, { verificationId }) => {
    // TODO(prod): read process.env.TELEGRAM_BOT_TOKEN + the user's telegram id
    // and call verifyMembership; reject when getChatMember says "left".
    await ctx.runMutation(internal.telegram.applyResult, {
      verificationId,
      isMember: true,
    });
  },
});

export const verifyMembership = action({
  args: {
    verificationId: v.id("verifications"),
    botToken: v.string(),
    channelUsername: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${args.botToken}/getChatMember?chat_id=@${args.channelUsername}&user_id=${args.userId}`,
      );

      if (!response.ok) {
        await ctx.runMutation(internal.telegram.applyResult, {
          verificationId: args.verificationId,
          isMember: false,
        });
        return;
      }

      const data = await response.json() as { ok: boolean; result?: { status: string } };
      const isMember = data.ok && (
        data.result?.status === "member" ||
        data.result?.status === "creator" ||
        data.result?.status === "administrator"
      );

      await ctx.runMutation(internal.telegram.applyResult, {
        verificationId: args.verificationId,
        isMember,
      });
    } catch {
      await ctx.runMutation(internal.telegram.applyResult, {
        verificationId: args.verificationId,
        isMember: false,
      });
    }
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
      await ctx.db.patch(args.verificationId, {
        state: "PENDING_HOLD",
        holdUntil,
      });
      await ctx.scheduler.runAt(holdUntil, internal.verifications.release, {
        verificationId: args.verificationId,
      });
    } else {
      await ctx.db.patch(args.verificationId, {
        state: "REJECTED",
      });
    }
  },
});
