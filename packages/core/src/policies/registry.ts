import type { PolicyDoc, PolicyKey } from "./types";
import { PRIVACY_POLICY } from "./privacy";
import { COOKIE_POLICY } from "./cookies";
import { ANTI_FRAUD_POLICY } from "./anti-fraud";
import { REWARDS_POLICY } from "./rewards";

export const ALL_POLICIES: Record<PolicyKey, PolicyDoc> = {
  privacy: PRIVACY_POLICY,
  cookies: COOKIE_POLICY,
  "anti-fraud": ANTI_FRAUD_POLICY,
  rewards: REWARDS_POLICY,
};

export function getPolicyDoc(key: PolicyKey): PolicyDoc {
  return ALL_POLICIES[key];
}
