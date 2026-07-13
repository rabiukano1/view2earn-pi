import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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
      const holdUntil = Date.now() + 48 * 60 * 60 * 1000;
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
