// Fraud scoring (plan §7.9). Turns the signals the app already records —
// flagged fraud events + a user's verification outcomes — into a 0..100 score.
// The score feeds trust-based sampling (verifications.shouldVerify): >= 50 forces
// 100% verification. Recent events already force verification on their own; the
// score is the slower-moving reputation signal that persists after they age out.

export type FraudSignals = {
  fraudEvents: number; // flagged events in the lookback window
  rejected: number; // verifications rejected (bad proof / caught)
  released: number; // verifications paid out (good history)
  cancelled: number; // clawed back after release (unfollow / post-pay fraud)
};

// ponytail: weights are hand-tuned guesses; calibrate against real labelled
// fraud once there's data. Kept as one function so there's a single knob.
export function computeFraudScore(s: FraudSignals): number {
  const decided = s.rejected + s.released;
  const rejectRatio = decided > 0 ? s.rejected / decided : 0;
  const score =
    s.fraudEvents * 25 + // each flagged event is serious
    Math.round(rejectRatio * 40) + // a high reject rate is suspicious
    s.cancelled * 15; // clawbacks are strong signals
  return Math.max(0, Math.min(100, score));
}

// Layer 4 behavioral signal (plan §7.9): a real follow/join + screenshot can't
// happen in a few seconds. A claim→proof gap below this is bot-fast.
// ponytail: 4s heuristic; tune once real completion times are observed.
export const MIN_TASK_MS = 4000;

export function isImpossibleSpeed(elapsedMs: number, minMs: number = MIN_TASK_MS): boolean {
  return elapsedMs >= 0 && elapsedMs < minMs;
}

// Score → action tier for the admin panel and containment (plan §7.9 Layer 5).
// "restricted" starts at 50 to match verifications.HIGH_FRAUD_SCORE (forces 100%
// verification).
export type FraudTier = "normal" | "watch" | "restricted" | "banned";

export function fraudTier(score: number): FraudTier {
  if (score >= 90) return "banned";
  if (score >= 50) return "restricted";
  if (score >= 25) return "watch";
  return "normal";
}
