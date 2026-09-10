import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Pi Network sign-in (plan §7.1 / Phase 6). The Pi SDK runs in the Pi Browser
// on the client; it returns a short-lived access token bound to a Pi UID. This
// action exchanges that token with Pi's API so the server never trusts a
// client-sent UID — it reads the UID back from Pi itself.
//
// Endpoint used for both sandbox and mainnet access tokens.
const PI_VERIFY_URL = "https://api.minepi.com/v2/me";

export const verifyPiToken = internalAction({
  args: { accessToken: v.string() },
  handler: async (_ctx, { accessToken }): Promise<{ uid: string; username: string }> => {
    const res = await fetch(PI_VERIFY_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Pi token verification failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { uid?: string; username?: string };
    if (!data.uid) throw new Error("Invalid Pi API response");
    return { uid: data.uid, username: data.username ?? "" };
  },
});
