import { canTransition, assertTransition, TERMINAL_STATES } from "../src/state-machine";

describe("state-machine", () => {
  it("allows CREATED → USER_CLAIMED_DONE", () => {
    expect(canTransition("CREATED", "USER_CLAIMED_DONE")).toBe(true);
  });

  it("disallows CREATED → RELEASED", () => {
    expect(canTransition("CREATED", "RELEASED")).toBe(false);
  });

  it("allows full happy path", () => {
    expect(canTransition("CREATED", "USER_CLAIMED_DONE")).toBe(true);
    expect(canTransition("USER_CLAIMED_DONE", "PROOF_SUBMITTED")).toBe(true);
    expect(canTransition("PROOF_SUBMITTED", "AI_APPROVED")).toBe(true);
    expect(canTransition("AI_APPROVED", "PENDING_HOLD")).toBe(true);
    expect(canTransition("PENDING_HOLD", "RELEASED")).toBe(true);
  });

  it("allows AI_UNCERTAIN → ADMIN_REVIEW → PENDING_HOLD", () => {
    expect(canTransition("AI_UNCERTAIN", "ADMIN_REVIEW")).toBe(true);
    expect(canTransition("ADMIN_REVIEW", "PENDING_HOLD")).toBe(true);
  });

  it("allows reject then retry", () => {
    expect(canTransition("AI_REJECTED", "REJECTED")).toBe(true);
    expect(canTransition("REJECTED", "USER_CLAIMED_DONE")).toBe(true);
  });

  it("terminal states have no outgoing transitions", () => {
    for (const state of TERMINAL_STATES) {
      expect(canTransition(state as any, "CREATED")).toBe(false);
      expect(canTransition(state as any, "RELEASED")).toBe(false);
    }
  });

  it("assertTransition throws on invalid", () => {
    expect(() => assertTransition("CREATED", "RELEASED")).toThrow();
  });

  it("assertTransition passes on valid", () => {
    expect(() => assertTransition("CREATED", "USER_CLAIMED_DONE")).not.toThrow();
  });
});
