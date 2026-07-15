import {
  isCountShortfall,
  COUNT_DELTA_MIN_SAMPLE,
} from "../src/count-delta";

describe("count-delta fraud signal", () => {
  it("ignores samples below the minimum, even a total shortfall", () => {
    expect(isCountShortfall(0, COUNT_DELTA_MIN_SAMPLE - 1)).toBe(false);
  });

  it("flags growth far below claimed follows", () => {
    // 100 users claimed to follow, page grew by 10 → shortfall
    expect(isCountShortfall(10, 100)).toBe(true);
  });

  it("passes healthy campaigns where growth tracks claims", () => {
    expect(isCountShortfall(95, 100)).toBe(false);
  });

  it("passes when count grew more than claimed (organic)", () => {
    expect(isCountShortfall(200, 100)).toBe(false);
  });
});
