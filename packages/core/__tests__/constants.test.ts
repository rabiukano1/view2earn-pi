import { POINTS, HOLD_DURATION_MS, PROFILE_LOCK_DAYS, FRAUD_THRESHOLDS } from "../src/constants";

describe("constants", () => {
  it("FOLLOW_PAGE points are positive", () => {
    expect(POINTS.FOLLOW_PAGE).toBeGreaterThan(0);
  });

  it("streak bonuses increase", () => {
    expect(POINTS.STREAK_BONUS.DAY_7).toBeGreaterThan(POINTS.STREAK_BONUS.DAY_1);
  });

  it("hold duration is 48 hours", () => {
    expect(HOLD_DURATION_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("profile lock is 30 days", () => {
    expect(PROFILE_LOCK_DAYS).toBe(30);
  });

  it("new users start at 100% verification rate", () => {
    expect(FRAUD_THRESHOLDS.NEW_USER_VERIFICATION_RATE).toBe(1.0);
  });

  it("established users have lower verification rate", () => {
    expect(FRAUD_THRESHOLDS.ESTABLISHED_USER_VERIFICATION_RATE).toBeLessThan(FRAUD_THRESHOLDS.NEW_USER_VERIFICATION_RATE);
  });
});
