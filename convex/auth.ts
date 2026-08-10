import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";
import { TelegramProvider } from "./TelegramProvider";
import { PiProvider } from "./PiProvider";

// Sign-in methods: email+password, email OTP (Resend), Telegram,
// and Pi Network (Pi Browser, plan §7.1). Sidra KYC is added later.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password(), ResendOTP, TelegramProvider, PiProvider],
  // Short-lived sessions: expire after 10 minutes of inactivity and force a
  // fresh Pi/OTP sign-in after 1 hour total (default is 30 days each).
  session: {
    totalDurationMs: 60 * 60 * 1000,
    inactiveDurationMs: 10 * 60 * 1000,
  },
  callbacks: {
    // Central user creation for every provider — fills our app fields so each
    // user row is complete (ecosystem, tier, fraudScore, …). Existing users
    // (sign-in, or linking a second method) are returned untouched.
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId) return existingUserId;
      const email = profile.email as string | undefined;
      const name = profile.name as string | undefined;
      const image = profile.image as string | undefined;
      const telegramUserId = profile.telegramId as string | undefined;
      const piUid = profile.piUid as string | undefined;
      const piWalletAddress = profile.piWalletAddress as string | undefined;
      return await ctx.db.insert("users", {
        email,
        name,
        image,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        ecosystem: piUid ? "PI" : "SIDRA",
        externalUid: piUid
          ? `pi:${piUid}`
          : email
            ? `auth:${email}`
            : telegramUserId
              ? `telegram:${telegramUserId}`
              : `auth:${crypto.randomUUID()}`,
        username: name ?? email?.split("@")[0] ?? (piUid ? `pi_${piUid.slice(-8)}` : "user"),
        tier: 0,
        fraudScore: 0,
        deviceFingerprint: "auth",
        signupIp: "unknown",
        country: "unknown",
        telegramUserId,
        piWalletAddress,
      });
    },
  },
});
