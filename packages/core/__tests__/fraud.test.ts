import { computeFraudScore, fraudTier } from "../src/fraud";

describe("fraud score", () => {
  it("clean user scores 0", () => {
    expect(computeFraudScore({ fraudEvents: 0, rejected: 0, released: 20, cancelled: 0 })).toBe(0);
  });

  it("one flagged event adds weight", () => {
    expect(computeFraudScore({ fraudEvents: 1, rejected: 0, released: 10, cancelled: 0 })).toBe(25);
  });

  it("high reject ratio raises the score", () => {
    // 8 rejected / 10 decided = 0.8 → round(32)
    expect(computeFraudScore({ fraudEvents: 0, rejected: 8, released: 2, cancelled: 0 })).toBe(32);
  });

  it("clamps at 100", () => {
    expect(computeFraudScore({ fraudEvents: 5, rejected: 10, released: 0, cancelled: 5 })).toBe(100);
  });

  it("a clawback counts even with an otherwise clean record", () => {
    expect(computeFraudScore({ fraudEvents: 0, rejected: 0, released: 5, cancelled: 1 })).toBe(15);
  });

  it("tiers map to the right bands (restricted starts at the verify threshold)", () => {
    expect(fraudTier(0)).toBe("normal");
    expect(fraudTier(24)).toBe("normal");
    expect(fraudTier(25)).toBe("watch");
    expect(fraudTier(50)).toBe("restricted");
    expect(fraudTier(90)).toBe("banned");
  });
});
