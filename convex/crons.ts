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

export default crons;
