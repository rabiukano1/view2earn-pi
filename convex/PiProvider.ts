import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Completes "Sign in with Pi" (plan §7.1): the client runs Pi.authenticate()
// in the Pi Browser, then calls signIn("pi", { accessToken, uid }). We verify
// the token server-side (internal.piAuth.verifyPiToken) and find-or-create the
// account keyed by the Pi UID — one account per KYC'd Pi identity (Layer 1
// identity anchor). App fields are filled by the createOrUpdateUser callback
// in auth.ts (ecosystem: "PI").
export const PiProvider = ConvexCredentials({
  id: "pi",
  authorize: async (credentials, ctx): Promise<{ userId: Id<"users"> }> => {
    const accessToken = credentials.accessToken as string | undefined;
    const uid = credentials.uid as string | undefined;
    const walletAddress = credentials.walletAddress as string | undefined;
    if (!accessToken || !uid) throw new Error("Missing Pi credentials");

    // Server-side verification: never trust a client-sent UID on its own.
    const verified = await ctx.runAction(internal.piAuth.verifyPiToken, {
      accessToken,
    });
    if (verified.uid !== uid) throw new Error("Pi UID mismatch");

    const account = { id: `pi:${verified.uid}` };
    const existing = await retrieveAccount(ctx, { provider: "pi", account }).catch(
      () => null,
    );
    if (existing) {
      // Refresh the wallet address on re-login if the Pioneer has one.
      if (walletAddress && existing.user.piWalletAddress !== walletAddress) {
        await ctx.runMutation(internal.piWallet.setPiWalletAddressInternal, {
          userId: existing.user._id as Id<"users">,
          walletAddress,
        });
      }
      return { userId: existing.user._id as Id<"users"> };
    }

    const profile: Record<string, string> = {
      name: verified.username,
      piUid: verified.uid,
    };
    if (walletAddress) profile.piWalletAddress = walletAddress;

    const created = await createAccount(ctx, {
      provider: "pi",
      account,
      profile,
    });
    return { userId: created.user._id as Id<"users"> };
  },
});
