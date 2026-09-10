import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/guards";
import { economyOfUser, appendLedger } from "./lib/ledger";

export const listAvailable = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUser(ctx, userId);
    const providers = await ctx.db
      .query("providers")
      .filter((q) => q.and(
        q.eq(q.field("kind"), "SURVEY"),
        q.eq(q.field("enabled"), true),
      ))
      .collect();

    if (providers.length > 0) {
      return providers.map((p) => ({
        id: p._id,
        name: p.name,
        platform: p.platform,
      }));
    }

    // ponytail: fallback survey providers list when database table is unseeded
    return [
      { id: "cpx_research", name: "CPX Research Survey Wall", platform: "both" },
      { id: "bitlabs_surveys", name: "BitLabs Global Surveys", platform: "both" },
      { id: "in_app_feedback", name: "Daily Community Survey", platform: "both" },
    ];
  },
});

export const recordCompletion = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    amount: v.number(),
    txId: v.string(),
  },
  handler: async (ctx, args) => {
    // Providers retry postbacks — credit each transaction exactly once.
    const refId = `${args.provider}:${args.txId}`;
    const existing = await ctx.db
      .query("pointsLedger")
      .withIndex("by_refId", (q) => q.eq("refId", refId))
      .first();
    if (existing) return; // already credited this txId

    // Survey postbacks come from the provider, not a client session — resolve
    // the economy server-side from the user's identity anchor.
    const economy = await economyOfUser(ctx, args.userId);
    await appendLedger(ctx, args.userId, economy, args.amount, "SURVEY_COMPLETED", refId);
  },
});
