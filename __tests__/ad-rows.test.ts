import { AD_EVERY, isAdRow, withAdRows } from '../src/components/adRows';

const notes = (n: number) => Array.from({ length: n }, (_, i) => ({ _id: `n${i}` }));
const ads = (rows: { _id: string }[]) => rows.filter(isAdRow).length;

describe('withAdRows', () => {
  it('puts a banner after every AD_EVERY items', () => {
    const rows = withAdRows(notes(13));
    expect(ads(rows)).toBe(2);
    expect(isAdRow(rows[AD_EVERY])).toBe(true);
    expect(isAdRow(rows[AD_EVERY * 2 + 1])).toBe(true);
  });

  it('never ends on an ad row', () => {
    for (const n of [6, 12, 18, 24]) {
      const rows = withAdRows(notes(n));
      expect(isAdRow(rows[rows.length - 1])).toBe(false);
      expect(ads(rows)).toBe(n / AD_EVERY - 1);
    }
  });

  it('adds nothing to a list shorter than the interval', () => {
    for (const n of [0, 1, 5, 6]) {
      expect(ads(withAdRows(notes(n)))).toBe(0);
      expect(withAdRows(notes(n))).toHaveLength(n);
    }
  });

  it('keeps every item, in order', () => {
    const rows = withAdRows(notes(20));
    expect(rows.filter((r) => !isAdRow(r)).map((r) => r._id)).toEqual(
      notes(20).map((n) => n._id),
    );
  });

  it('gives ad rows distinct keys', () => {
    const keys = withAdRows(notes(30)).map((r) => r._id);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
