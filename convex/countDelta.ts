import { internalMutation } from "./_generated/server";
import { isCountShortfall } from "@view2earn/core";
import { recomputeUserScore } from "./fraud";

// Tier 3 (plan §4): periodically read each active campaign's public follower/
// member count and compare its growth to how many users claimed to follow.
// A large shortfall is a campaign-level fraud SIGNAL (written to fraudEvents
// against the task creator) — never a per-user pay gate.

// A follow shows up in the public count once the proof is accepted.
const CLAIMED_STATES = new Set(["PENDING_HOLD", "RELEASED"]);

// ponytail: mocked count source, like verifications.aiCheck / telegram.check.
// Real version fetches the platform's public count (needs an action + per-platform
// API/scrape) — plan §4 Tier 3. Honest stub: count tracks claims, so dev shows
// no false alarms; the shortfall logic is unit-tested in @view2earn/core.
function mockPublicCount(_pageId: string, claims: number): number {
  return claims;
}

export const scan = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const task of tasks) {
      if (!task.pageId) continue; // nothing countable

      const verifs = await ctx.db
        .query("verifications")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      const claims = verifs.filter((v) => CLAIMED_STATES.has(v.state)).length;
      const count = mockPublicCount(task.pageId, claims);

      if (task.lastCount !== undefined && task.lastCountClaims !== undefined) {
        const countDelta = count - task.lastCount;
        const claimedDelta = claims - task.lastCountClaims;
        if (isCountShortfall(countDelta, claimedDelta) && task.creatorUserId) {
          await ctx.db.insert("fraudEvents", {
            userId: task.creatorUserId,
            type: "count-delta",
            detailsJson: JSON.stringify({
              taskId: task._id,
              claimedFollows: claimedDelta,
              observedGrowth: countDelta,
            }),
          });
          await recomputeUserScore(ctx, task.creatorUserId);
        }
      }

      await ctx.db.patch(task._id, {
        lastCount: count,
        lastCountClaims: claims,
        lastCountAt: Date.now(),
      });
    }
  },
});
