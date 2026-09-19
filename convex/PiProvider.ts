import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount, getAuthUserId } from "@convex-dev/auth/server";
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

    // DUPLICATE-PI PROTECTION (plan §17): if this Pi is already linked to an
    // existing V2E account, and the CURRENT session is a DIFFERENT account,
    // that means a second account is trying to connect an already-linked Pi.
    // Flag the offending second account as DUPLICATE/FRAUD and reject the link.
    // The original verified account is never touched.
    const currentUserId = await getAuthUserId(ctx);
    const current: { accountStatus?: string; mergedInto?: string } | null = currentUserId
      ? await ctx.runQuery(internal.piLink.getUserMergeState, { userId: currentUserId as Id<"users"> })
      : null;
    const isMergedIntoOwner =
      !!existing?.user && current?.accountStatus === "merged" && current.mergedInto === existing.user._id;
    if (existing && existing.user && currentUserId && existing.user._id !== currentUserId && !isMergedIntoOwner) {
      await ctx.runMutation(internal.fraud.flagDuplicateLink, {
        userId: currentUserId as Id<"users">,
        identity: `pi:${verified.uid}`,
        ownerUserId: existing.user._id as Id<"users">,
      });
      throw new Error(
        "This Pi account is already linked to another View2Earn account. Your account has been flagged for duplicate-identity review.",
      );
    }

    if (existing && existing.user) {
      await ctx.runMutation(internal.surfaces.markPending, {
        userId: existing.user._id as Id<"users">,
        surface: "pi-browser",
      });
      if (verified.username && existing.user.piUsername !== verified.username) {
        await ctx.runMutation(internal.piWallet.setPiUsernameInternal, {
          userId: existing.user._id as Id<"users">,
          piUsername: verified.username,
        });
      }
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
      piUsername: verified.username,
    };
    if (walletAddress) profile.piWalletAddress = walletAddress;
    if (credentials.country) profile.country = credentials.country as string;

    const created = await createAccount(ctx, {
      provider: "pi",
      account,
      profile,
    });
    await ctx.runMutation(internal.surfaces.markPending, {
      userId: created.user._id as Id<"users">,
      surface: "pi-browser",
    });
    return { userId: created.user._id as Id<"users"> };
  },
});
