import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";
import { TelegramProvider } from "./TelegramProvider";
import { PiProvider } from "./PiProvider";

// Sign-in methods: email+password, email OTP (Resend), Telegram,
// and Pi Network (Pi Browser, plan §7.1). Sidra KYC is added later.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({ 
      verify: ResendOTP,
      reset: ResendOTP,
      profile: (params) => {
        const email = params.email as string;
        const profile: Record<string, any> & { email: string } = { email };
        if (params.name) profile.name = params.name as string;
        if (params.country) profile.country = params.country as string;
        return profile;
      }
    }), 
    ResendOTP, 
    TelegramProvider, 
    PiProvider
  ],
  // Long-lived mobile sessions: 90 days total duration, 30 days inactive duration.
  session: {
    totalDurationMs: 90 * 24 * 60 * 60 * 1000,
    inactiveDurationMs: 30 * 24 * 60 * 60 * 1000,
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
      const country = profile.country as string | undefined;
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
        country: country || "unknown",
        telegramUserId,
        piWalletAddress,
      });
    },
  },
});
