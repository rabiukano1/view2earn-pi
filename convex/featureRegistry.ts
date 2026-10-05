/**
 * Canonical feature registry for View2Earn.
 *
 * Single source of truth for every toggleable module in the apps.
 * - Keys MUST start with "feature:" (enforced in convex/features.ts).
 * - A missing key = enabled by default (see getFlags / getEffectiveFlags).
 * - This file has NO convex imports so the Next.js admin panel can import
 *   it directly via a relative path.
 */

export interface FeatureDef {
  key: string;
  label: string;
  group: "Earn" | "Watch" | "Growth" | "Learn" | "Wallet" | "Account";
  app: string;
  place: string;
  description: string;
}

export const FEATURE_REGISTRY: FeatureDef[] = [
  // ── Earn ──────────────────────────────────────────────────────────────
  { key: "feature:tasks", label: "Tasks", group: "Earn", app: "Mobile App", place: "Tab Bar & Home", description: "Social-media tasks tab and Home shortcut." },
  { key: "feature:quiz", label: "Daily Quiz", group: "Earn", app: "Mobile App", place: "Home & Quiz screen", description: "Daily quiz entry and Quiz screen." },
  { key: "feature:spin", label: "Spin & Win", group: "Earn", app: "Mobile App", place: "Home & Spin screen", description: "Spin wheel entry and Spin screen." },
  { key: "feature:surveys", label: "Surveys", group: "Earn", app: "Mobile App", place: "Home & Surveys screen", description: "Survey providers and Surveys screen." },
  { key: "feature:streaks", label: "Streaks & Daily Box", group: "Earn", app: "Mobile App", place: "Home cards", description: "Check-in streak card and daily mystery box." },

  // ── Watch ─────────────────────────────────────────────────────────────
  { key: "feature:watch", label: "Watch Hub", group: "Watch", app: "Mobile App", place: "Home banner → WatchHub", description: "Watch-to-earn video hub entry." },
  { key: "feature:livetv", label: "Live TV & Football", group: "Watch", app: "Mobile App", place: "WatchHub → LiveTV / LiveStreams", description: "IPTV football, YouTube and live streams." },

  // ── Growth ────────────────────────────────────────────────────────────
  { key: "feature:promote", label: "Promote Hub", group: "Growth", app: "Mobile App", place: "Home → Marketplace", description: "Promote hub entry and marketplace listings." },
  { key: "feature:referral", label: "Referrals", group: "Growth", app: "Mobile App", place: "Settings → Referral", description: "Referral program screen." },
  { key: "feature:leaderboard", label: "Leaderboard", group: "Growth", app: "Mobile App", place: "Settings → Leaderboard", description: "Global ranks screen." },
  { key: "feature:achievements", label: "Achievements", group: "Growth", app: "Mobile App", place: "Home hub card", description: "Activities/achievements hub card." },

  // ── Learn ─────────────────────────────────────────────────────────────
  { key: "feature:academy", label: "Academy (Learn)", group: "Learn", app: "Mobile App", place: "Home → Academy", description: "Learn/academy courses entry." },
  { key: "feature:levels", label: "Levels & XP", group: "Learn", app: "Mobile App", place: "Home level card", description: "Level progress card and Level screen." },
  { key: "feature:stats", label: "Stats", group: "Learn", app: "Mobile App", place: "Profile → Stats", description: "Personal stats screen." },

  // ── Wallet ────────────────────────────────────────────────────────────
  { key: "feature:wallet", label: "Wallet", group: "Wallet", app: "Mobile App", place: "Profile balances", description: "Wallet balances and payout addresses." },
  { key: "feature:rewards", label: "Rewards & Redemptions", group: "Wallet", app: "Mobile App", place: "Rewards flows", description: "Reward catalog and redemption flows." },
  { key: "feature:exchange", label: "Exchange / Swap", group: "Wallet", app: "Mobile App", place: "Wallet swap", description: "Points ↔ PIPRO exchange." },
  { key: "feature:donate", label: "Donate Pi", group: "Wallet", app: "Mobile App", place: "Settings → Donate", description: "Community pool donations." },

  // ── Account ───────────────────────────────────────────────────────────
  { key: "feature:linkedAccounts", label: "Linked Accounts", group: "Account", app: "Mobile App", place: "Settings → Linked", description: "Social linked-accounts screen." },
  { key: "feature:security", label: "Security", group: "Account", app: "Mobile App", place: "Settings → Security", description: "Security settings screen." },
];

export const FEATURE_KEY_SET: Set<string> = new Set(
  FEATURE_REGISTRY.map((f) => f.key),
);

export function isKnownFeatureKey(key: string): boolean {
  return FEATURE_KEY_SET.has(key);
}

/** Custom keys are allowed but must use the "feature:" prefix. */
export function isValidFeatureKey(key: string): boolean {
  return key.startsWith("feature:") && key.length > "feature:".length && !key.includes(" ");
}
