// Tier 3 count-delta fraud signal (plan §4).
// Compare a target page's public follower/member growth against how many users
// CLAIMED to follow. A large shortfall is a campaign-level fraud SIGNAL — input
// to scoring only, never a per-user pay gate: rounded + cached public counts make
// it unreliable, so it only speaks in aggregate.

export const COUNT_DELTA_MIN_SAMPLE = 10; // too few claimed follows to judge
export const COUNT_DELTA_SHORTFALL_RATIO = 0.5; // observed growth < 50% of claims → flag
// ponytail: thresholds are guesses; tune against real campaign data once live.

// True when public-count growth falls far short of claimed follows.
export function isCountShortfall(countDelta: number, claimedDelta: number): boolean {
  if (claimedDelta < COUNT_DELTA_MIN_SAMPLE) return false;
  return countDelta < claimedDelta * COUNT_DELTA_SHORTFALL_RATIO;
}
