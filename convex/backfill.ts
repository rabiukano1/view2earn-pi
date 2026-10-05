import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { deriveEconomy } from "./lib/guards";
import { accountKeyOf } from "@view2earn/core";

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

// One-time: build the economyBalances cache from the existing ledger.
// Run once after a data import:  npx convex run backfill:backfillEconomyBalances
//
// Convex mutations are limited to ~1s of execution, and this has to read every
// pointsLedger row once (56k+ at the time of writing). So it works in SMALL
// batches of users, reading each user's ledger with ONE indexed query and
// bucketing in memory, then reschedules itself until every user is done.
// Each user is recomputed completely, so the whole thing is idempotent and
// doubles as a repair tool.
// Convex caps a mutation at ~1s AND at a few thousand DB operations. Ledger
// sizes vary from 0 to 3000+ rows per user, so instead of guessing a user
// count we stop on whichever budget runs out first, then reschedule.
const BATCH_BUDGET_MS = 400;
const BATCH_BUDGET_OPS = 1500;
type Acc = { balance: number; lifetimeEarned: number };

export const backfillEconomyBalances = internalMutation({
  args: { cursor: v.optional(v.string()), processed: v.optional(v.number()) },
  handler: async (ctx, { cursor, processed }) => {
    // Convex allows only ONE .paginate() per function, so the cursor is the
    // last _creationTime seen, walked with the implicit by_creation_time index.
    const started = Date.now();
    let since = cursor ? Number(cursor) : 0;
    let isDone = false;
    let batchUsers = 0;
    let written = 0;

    let ops = 0;
    while (!isDone && Date.now() - started < BATCH_BUDGET_MS && ops < BATCH_BUDGET_OPS) {
      const next = await ctx.db
        .query("users")
        .withIndex("by_creation_time", (q) => q.gt("_creationTime", since))
        .take(1);
      if (next.length === 0) {
        isDone = true;
        break;
      }
      batchUsers += 1;

      for (const user of next) {
        since = user._creationTime;
        // One query per user, not one per economy. Legacy rows without `economy`
        // count as "android", matching deriveEconomy's default.
        const rows = await ctx.db
          .query("pointsLedger")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        ops += rows.length + 1;

        const acc = new Map<string, Acc>();
        for (const r of rows) {
          const economy = r.economy ?? "android";
          const cur = acc.get(economy) ?? { balance: 0, lifetimeEarned: 0 };
          cur.balance = r.balanceAfter; // rows are append-ordered: last wins
          if (r.delta > 0) cur.lifetimeEarned += r.delta;
          acc.set(economy, cur);
        }

        for (const [economy, value] of acc) {
          const existing = await ctx.db
            .query("economyBalances")
            .withIndex("by_user_economy", (q) =>
              q.eq("userId", user._id).eq("economy", economy as any),
            )
            .unique();
          ops += 2;
          if (existing) {
            if (
              existing.balance !== value.balance ||
              (existing.lifetimeEarned ?? -1) !== value.lifetimeEarned
            ) {
              await ctx.db.patch(existing._id, {
                balance: value.balance,
                lifetimeEarned: value.lifetimeEarned,
              });
              written++;
            }
          } else {
            await ctx.db.insert("economyBalances", {
              userId: user._id,
              economy: economy as any,
              balance: value.balance,
              lifetimeEarned: value.lifetimeEarned,
            });
            written++;
          }
        }
      }
    }

    const total = (processed ?? 0) + batchUsers;
    const continueFrom = String(since);
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.backfill.backfillEconomyBalances, {
        cursor: continueFrom,
        processed: total,
      });
    }
    // continueFrom lets you resume by hand if the scheduler cannot run.
    return { usersProcessed: total, written, done: isDone, continueFrom: isDone ? null : continueFrom };
  },
});

// One-time: stamp accountKey onto completedTargets rows written before the
// account-level de-duplication existed. Without this, a user who already
// finished a task would still see that account re-listed under a different
// URL form. Idempotent; time-boxed and self-rescheduling like the others.
//   npx convex run backfill:backfillCompletedAccountKeys
export const backfillCompletedAccountKeys = internalMutation({
  args: { cursor: v.optional(v.string()), processed: v.optional(v.number()) },
  handler: async (ctx, { cursor, processed }) => {
    const started = Date.now();
    let since = cursor ? Number(cursor) : 0;
    let isDone = false;
    let scanned = 0;
    let stamped = 0;

    while (!isDone && Date.now() - started < BATCH_BUDGET_MS && scanned < 400) {
      const next = await ctx.db
        .query("completedTargets")
        .withIndex("by_creation_time", (q) => q.gt("_creationTime", since))
        .take(1);
      if (next.length === 0) {
        isDone = true;
        break;
      }
      const row = next[0];
      since = row._creationTime;
      scanned++;
      if (!row.accountKey) {
        // normalizedUrl has lost its protocol; accountKeyOf copes, and infers
        // the platform from the host when none is stored.
        const key = accountKeyOf(undefined, `https://${row.normalizedUrl}`);
        if (key) {
          await ctx.db.patch(row._id, { accountKey: key });
          stamped++;
        }
      }
    }

    const total = (processed ?? 0) + scanned;
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.backfill.backfillCompletedAccountKeys, {
        cursor: String(since),
        processed: total,
      });
    }
    return { scanned: total, stamped, done: isDone, continueFrom: isDone ? null : String(since) };
  },
});
