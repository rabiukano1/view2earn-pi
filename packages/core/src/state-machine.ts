import type { VerificationState } from "./types";

type TransitionMap = Record<VerificationState, VerificationState[]>;

export const VERIFICATION_TRANSITIONS: TransitionMap = {
  CREATED: ["USER_CLAIMED_DONE"],
  USER_CLAIMED_DONE: ["PROOF_SUBMITTED"],
  PROOF_SUBMITTED: ["AI_APPROVED", "AI_UNCERTAIN", "AI_REJECTED"],
  AI_APPROVED: ["PENDING_HOLD"],
  AI_UNCERTAIN: ["ADMIN_REVIEW"],
  AI_REJECTED: ["REJECTED"],
  ADMIN_REVIEW: ["PENDING_HOLD", "REJECTED"],
  PENDING_HOLD: ["RELEASED", "CANCELLED"],
  RELEASED: [],
  CANCELLED: [],
  REJECTED: ["USER_CLAIMED_DONE"],
};

export function canTransition(
  from: VerificationState,
  to: VerificationState,
): boolean {
  return VERIFICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: VerificationState,
  to: VerificationState,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid state transition: ${from} → ${to}`,
    );
  }
}

export const TERMINAL_STATES: Set<VerificationState> = new Set([
  "RELEASED",
  "CANCELLED",
]);

export const PENDING_STATES: Set<VerificationState> = new Set([
  "CREATED",
  "USER_CLAIMED_DONE",
  "PROOF_SUBMITTED",
  "AI_APPROVED",
  "AI_UNCERTAIN",
  "AI_REJECTED",
  "ADMIN_REVIEW",
  "PENDING_HOLD",
  "REJECTED",
]);
