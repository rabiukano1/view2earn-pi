import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "purge-old-screenshots",
  { hours: 24 },
  internal.verifications.purgeOldScreenshots,
);

crons.interval(
  "generate-pi-quiz-questions",
  { hours: 6 },
  internal.quiz.generateQuestions,
  { ecosystem: "PI", count: 5 },
);

crons.interval(
  "generate-sidra-quiz-questions",
  { hours: 6 },
  internal.quiz.generateQuestions,
  { ecosystem: "SIDRA", count: 5 },
);

// Tier 3 count-delta fraud signal (plan §4).
crons.interval("count-delta-scan", { hours: 12 }, internal.countDelta.scan);

// Recompute fraud scores so they decay as old events age out (plan §7.9).
crons.interval("recompute-fraud-scores", { hours: 24 }, internal.fraud.recomputeAll);

// Recover spin points orphaned by old clients (spin consumed, claim never
// landed). Hourly; only touches pendings older than 15 minutes.
crons.interval("recover-unclaimed-spins", { hours: 1 }, internal.spin.recoverStalePendingSpins, {});

// Auto-detect SIDRA sent to the platform address from registered user
// addresses, so deposits credit without the user pasting a hash.
crons.interval("scan-sidra-deposits", { minutes: 2 }, internal.sidra.scanPlatformDeposits, {});

// Credit Stellar anchor deposits into the platform account by memo (anchor.ts).
crons.interval("scan-anchor-deposits", { minutes: 1 }, internal.anchor.scanPayments, {});

// Keep data plans/prices in sync with ClubKonnect (vas.ts).
crons.interval("refresh-vas-plans", { hours: 12 }, internal.vas.refreshPlans, {});

export default crons;
