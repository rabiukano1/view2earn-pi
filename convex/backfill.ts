import { internalMutation } from "./_generated/server";
import { deriveEconomy } from "./lib/guards";

// One-time backfill for the two-economy migration.
//
// Legacy rows in pointsLedger / piWithdrawals / redemptions predate the
// `economy` field (added in the ONE-user-two-economies refactor). Stamp each
// legacy row with the economy derived from its user's identity anchor:
//   pi-anchored (externalUid "pi:...")  -> "pi-browser"
//   email/Telegram/Sidra-anchored       -> "android"
//
// piWithdrawals and redemptions are ALWAYS Pi-Browser-economy constructs, so
// their legacy rows are stamped "pi-browser" regardless.
export const backfillEconomy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ledgers = await ctx.db.query("pointsLedger").collect();
    let ledgerCount = 0;
    for (const row of ledgers) {
      if (row.economy) continue;
      const user = await ctx.db.get(row.userId);
      const economy = user ? deriveEconomy(user) : "android";
      await ctx.db.patch(row._id, { economy });
      ledgerCount++;
    }

    const withdrawals = await ctx.db.query("piWithdrawals").collect();
    let withdrawalCount = 0;
    for (const row of withdrawals) {
      if (row.economy) continue;
      await ctx.db.patch(row._id, { economy: "pi-browser" });
      withdrawalCount++;
    }

    const redemptions = await ctx.db.query("redemptions").collect();
    let redemptionCount = 0;
    for (const row of redemptions) {
      if (row.economy) continue;
      await ctx.db.patch(row._id, { economy: "pi-browser" });
      redemptionCount++;
    }

    return { ledgerCount, withdrawalCount, redemptionCount };
  },
});
