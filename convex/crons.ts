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

export default crons;
