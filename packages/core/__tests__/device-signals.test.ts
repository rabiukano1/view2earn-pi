import { hashString, compositeFingerprint } from "../src/device-signals";
import { isImpossibleSpeed, MIN_TASK_MS } from "../src/fraud";

describe("device fingerprint", () => {
  it("is deterministic", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
  });

  it("differs for different input", () => {
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("same device parts → same fingerprint (clone-app catch)", () => {
    const parts = ["android", "Samsung", "SM-S911", "build/xyz", 1080, 2340];
    expect(compositeFingerprint(parts)).toBe(compositeFingerprint([...parts]));
  });

  it("order of parts matters", () => {
    expect(compositeFingerprint(["a", "b"])).not.toBe(compositeFingerprint(["b", "a"]));
  });

  it("null/undefined parts don't throw and are stable", () => {
    expect(compositeFingerprint(["a", null, undefined])).toBe(compositeFingerprint(["a", null, undefined]));
  });
});

describe("impossible speed", () => {
  it("flags a sub-threshold claim→proof gap", () => {
    expect(isImpossibleSpeed(1500)).toBe(true);
  });

  it("passes a human-paced gap", () => {
    expect(isImpossibleSpeed(MIN_TASK_MS + 1)).toBe(false);
  });

  it("ignores negative/zero clock skew", () => {
    expect(isImpossibleSpeed(-100)).toBe(false);
  });
});
