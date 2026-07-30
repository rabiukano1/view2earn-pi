import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { md5 } from "js-md5";

// CPX Research integration. The offerwall is opened with the user's id + a
// secure hash; CPX posts back completions to /survey/cpx (see http.ts), which
// verifies the hash and credits points. Secret stays server-side.
// Env: CPX_APP_ID, CPX_SECRET (the "Secure hash" from the CPX dashboard).

const OFFERWALL_BASE = "https://offers.cpx-research.com/index.php";

// CPX secure hash = md5("<value>-<secret>"). Same formula for the offerwall
// (value = ext_user_id) and the postback (value = trans_id).
export function cpxHash(value: string, secret: string): string {
  return md5(`${value}-${secret}`);
}

export const getOfferwallUrl = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const appId = process.env.CPX_APP_ID;
    const secret = process.env.CPX_SECRET;
    if (!appId || !secret) throw new Error("Surveys aren't set up yet — check back soon.");
    const hash = cpxHash(userId, secret);
    return `${OFFERWALL_BASE}?app_id=${appId}&ext_user_id=${userId}&secure_hash=${hash}`;
  },
});
