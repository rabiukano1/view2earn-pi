import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Completes "Sign in with View2Earn" in the wallet app: the wallet calls
// signIn("wallet-handoff", { nonce }) once the main app has approved the
// nonce. Unlike the Telegram/Pi providers this never creates an account —
// it signs the wallet in as the exact user who approved from the main app.
export const WalletHandoffProvider = ConvexCredentials({
  id: "wallet-handoff",
  authorize: async (credentials, ctx): Promise<{ userId: Id<"users"> }> => {
    const nonce = credentials.nonce as string | undefined;
    if (!nonce) throw new Error("Missing nonce");
    const consumed: { userId: Id<"users"> } = await ctx.runMutation(
      internal.walletAuth.consumeNonce,
      { nonce },
    );
    await ctx.runMutation(internal.surfaces.markPending, { userId: consumed.userId, surface: "wallet" });
    return { userId: consumed.userId };
  },
});
