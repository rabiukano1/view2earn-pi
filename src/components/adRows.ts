// Interleaving ad rows into a list is pure index arithmetic, and the two edge
// cases that matter are easy to get wrong: never put an ad after the last item
// (it reads as broken content), and never return an ad row for a list shorter
// than the interval. Kept out of the component so it can be checked directly.

/** Voices between banners. Six keeps at most one banner in a phone viewport. */
export const AD_EVERY = 6;

export type AdRow = { _id: string; __ad: true };

export function isAdRow<T extends { _id: string }>(row: T | AdRow): row is AdRow {
  return '__ad' in row;
}

export function withAdRows<T extends { _id: string }>(
  items: T[],
  every: number = AD_EVERY,
): (T | AdRow)[] {
  const out: (T | AdRow)[] = [];
  items.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % every === 0 && i + 1 < items.length) {
      out.push({ _id: `ad-${i}`, __ad: true });
    }
  });
  return out;
}
