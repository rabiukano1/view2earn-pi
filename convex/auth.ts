import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { ResendOTP } from "./ResendOTP";
import { TelegramProvider } from "./TelegramProvider";

// Sign-in methods: email+password, email OTP (Resend), Google OAuth, Telegram.
// Sidra KYC is added later as another provider.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password(), Google({}), ResendOTP, TelegramProvider],
  callbacks: {
    // Central user creation for every provider — fills our app fields so each
    // user row is complete (ecosystem, tier, fraudScore, …). Existing users
    // (sign-in, or linking a second method) are returned untouched.
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId) return existingUserId;
      const email = profile.email as string | undefined;
      const name = profile.name as string | undefined;
      const image = profile.image as string | undefined;
      return await ctx.db.insert("users", {
        email,
        name,
        image,
        emailVerificationTime: profile.emailVerified ? Date.now() : undefined,
        ecosystem: "SIDRA",
        externalUid: email ? `auth:${email}` : `auth:${crypto.randomUUID()}`,
        username: name ?? email?.split("@")[0] ?? "user",
        tier: 0,
        fraudScore: 0,
        deviceFingerprint: "auth",
        signupIp: "unknown",
        country: "unknown",
      });
    },
  },
});
