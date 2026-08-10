import { Email } from "@convex-dev/auth/providers/Email";

// Email OTP via Resend (free tier). Sends a 6-digit code; Convex Auth stores +
// verifies it. Delivery uses Resend's REST API directly (no SDK dependency).
// Set the key: npx convex env set AUTH_RESEND_KEY <resend-api-key>
// Set a verified sender: npx convex env set AUTH_RESEND_FROM "View2Earn <no-reply@view2earn.org>"
// (defaults to the sandbox onboarding@resend.dev, which only delivers to the
// Resend account owner's own email).
export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: 60 * 15, // code valid for 15 minutes
  async generateVerificationToken() {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    return String(n % 1_000_000).padStart(6, "0");
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) throw new Error("AUTH_RESEND_KEY is not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_RESEND_FROM ?? "View2Earn <onboarding@resend.dev>",
        to: [email],
        subject: "Your View2Earn sign-in code",
        text: `Your sign-in code is ${token}\n\nIt expires in 15 minutes.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: ${await res.text()}`);
    }
  },
});
