// Daily spin wheel (plan §7.11b) — a free once-a-day spin, weighted toward
// small prizes. The prize table lives here so the server (authoritative pick)
// and the UI (which animates to the chosen segment) share one source and can
// never disagree about what a segment is worth.

export type SpinPrize = { pts: number; weight: number };

export const SPIN_PRIZES: SpinPrize[] = [
  { pts: 5, weight: 30 },
  { pts: 10, weight: 24 },
  { pts: 15, weight: 18 },
  { pts: 25, weight: 13 },
  { pts: 40, weight: 9 },
  { pts: 75, weight: 4 },
  { pts: 150, weight: 1.5 },
  { pts: 500, weight: 0.5 },
];

// Weighted index into SPIN_PRIZES. rand is injectable so it can be tested
// deterministically; defaults to Math.random on the server.
export function pickSpinIndex(rand: () => number = Math.random): number {
  const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = rand() * total;
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    if (r < SPIN_PRIZES[i].weight) return i;
    r -= SPIN_PRIZES[i].weight;
  }
  return SPIN_PRIZES.length - 1; // rounding fallthrough → last segment
}
