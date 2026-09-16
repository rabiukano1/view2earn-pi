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
    const initData = credentials.initData as string | undefined;
    if (!nonce && !initData) throw new Error("Missing nonce");

    // Two entry points, same account key: the bot deep-link nonce flow, or a
    // Telegram Mini App session (initData verified against the bot token).
    const consumed: { telegramUserId: string; telegramName: string } = initData
      ? await ctx.runAction(internal.telegramAuth.verifyInitData, { initData })
      : await ctx.runMutation(internal.telegramAuth.consumeNonce, { nonce: nonce! });

    const account = { id: `telegram:${consumed.telegramUserId}` };
    const existing = await retrieveAccount(ctx, { provider: "telegram", account }).catch(
      () => null,
    );
    if (existing) return { userId: existing.user._id as Id<"users"> };

    const country = credentials.country as string | undefined;
    const profile: Record<string, string> = { name: consumed.telegramName, telegramId: consumed.telegramUserId };
    if (country) profile.country = country;

    const created = await createAccount(ctx, {
      provider: "telegram",
      account,
      profile,
    });
    return { userId: created.user._id as Id<"users"> };
  },
});
