import { SPIN_PRIZES, pickSpinIndex } from "../src/spin";

describe("spin wheel", () => {
  it("rand=0 picks the first segment", () => {
    expect(pickSpinIndex(() => 0)).toBe(0);
  });

  it("rand just below 1 picks the last segment", () => {
    expect(pickSpinIndex(() => 0.999999)).toBe(SPIN_PRIZES.length - 1);
  });

  it("always returns a valid segment index", () => {
    for (let i = 0; i < 200; i++) {
      const idx = pickSpinIndex(() => i / 200);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(SPIN_PRIZES.length);
    }
  });

  it("respects weighting — rare 500 prize is far less likely than 5", () => {
    let fives = 0;
    let bigs = 0;
    for (let i = 0; i < 10000; i++) {
      const pts = SPIN_PRIZES[pickSpinIndex()].pts;
      if (pts === 5) fives++;
      if (pts === 500) bigs++;
    }
    expect(fives).toBeGreaterThan(bigs);
  });
});
