import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Completes "Sign in with Telegram": the client calls signIn("telegram", { nonce })
// once the bot webhook has marked the nonce verified. We consume the nonce, then
// find-or-create the account keyed by the Telegram user id (one account per TG
// user). App fields are filled by the createOrUpdateUser callback in auth.ts.
// Return types are annotated explicitly to break Convex's circular inference.
export const TelegramProvider = ConvexCredentials({
  id: "telegram",
  authorize: async (credentials, ctx): Promise<{ userId: Id<"users"> }> => {
    const nonce = credentials.nonce as string | undefined;
    if (!nonce) throw new Error("Missing nonce");

    const consumed: { telegramUserId: string; telegramName: string } = await ctx.runMutation(
      internal.telegramAuth.consumeNonce,
      { nonce },
    );

    const account = { id: `telegram:${consumed.telegramUserId}` };
    const existing = await retrieveAccount(ctx, { provider: "telegram", account }).catch(
      () => null,
    );
    if (existing) return { userId: existing.user._id as Id<"users"> };

    const created = await createAccount(ctx, {
      provider: "telegram",
      account,
      profile: { name: consumed.telegramName, telegramId: consumed.telegramUserId },
    });
    return { userId: created.user._id as Id<"users"> };
  },
});
