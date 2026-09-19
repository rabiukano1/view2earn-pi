import type { QueryCtx, MutationCtx } from "./_generated/server";

export const REWARD_KEYS = {
  adRewardPoints: "50",
  streakSchedule: JSON.stringify([10, 15, 20, 25, 30, 40, 75]),
  mysteryBoxPrizes: JSON.stringify([
    { pts: 10, weight: 30 },
    { pts: 20, weight: 25 },
    { pts: 30, weight: 20 },
    { pts: 50, weight: 15 },
    { pts: 100, weight: 8 },
    { pts: 250, weight: 2 },
  ]),
  mysteryBoxTasksNeeded: "3",
  comboBonus: "40",
  spinPrizes: JSON.stringify([
    { pts: 10, weight: 24 },
    { pts: 25, weight: 13 },
    { pts: 50, weight: 9 },
    { pts: -1, weight: 1.5 },
    { pts: 100, weight: 2 },
    { pts: 15, weight: 18 },
    { pts: -2, weight: 0.5 },
    { pts: -3, weight: 0.5 },
    { pts: 0, weight: 30 },
    { pts: 35, weight: 4 },
  ]),
  baseSpinsPerWindow: "3",
  spinsPerWindow: "10",
  spinWindowHours: "3",
  adBonusSpinsPerWindow: "2",
  quizCorrectPoints: "3",
  referralQualifiedBonus: "100",
  referralRefereeBonus: "50",
  referralQualificationTasks: "5",
  academyLevelPoints: "10",
  quizXpPerCorrect: "20",
  streakXp: "50",
  taskXp: "100",
  academyXp: "200",
  // Withdrawal settings (identity.ts / wallets.ts / sidra.ts). Per-app
  // overrides ("withdrawMinLevel@telegram") are honoured for withdrawMinLevel.
  withdrawMinLevel: "9",          // level a surface must reach to claim/cash out
  claimMaxPoints: "0",            // max points per claim into the wallet; 0 = no cap
  minWithdrawSidra: "0",          // minimum SIDRA per withdrawal; 0 = none
  minWithdrawPipro: "0",
  minWithdrawVinta: "0",
  pointsPerSidra: "0",            // SIDRA ⇄ points rate; 0 = SIDRA deposits/withdrawals off
  platformSidraAddress: "",       // 0x… address that receives SIDRA deposits
  platformSolanaAddress: "",      // Solana address that receives PIPRO deposits
  // Fees. Each has a switch admin can flip at any time; a fee applies only when
  // its switch is "1" AND its percent is > 0.
  withdrawFeeEnabled: "0",
  withdrawFeePercent: "0",        // % taken from the payout of every withdrawal
  promoteFeeEnabled: "0",
  promoteFeePercent: "0",         // % charged on top of a Promote Hub listing budget
} as const;

// Effective fee percent for a switch+percent pair (0 when off).
export async function getFeePercent(
  ctx: QueryCtx | MutationCtx,
  enabledKey: RewardKey,
  percentKey: RewardKey,
): Promise<number> {
  const on = (await getSetting(ctx, enabledKey)) === "1";
  if (!on) return 0;
  const pct = await getNum(ctx, percentKey);
  return Math.min(Math.max(pct, 0), 100);
}

export type RewardKey = keyof typeof REWARD_KEYS;

// Optional per-surface override: a platformSettings row keyed "<key>@<economy>"
// (e.g. "spinsPerWindow@telegram") wins over the global "<key>" for that
// surface. Admin → Rewards shows these as per-app inputs.
export type SettingEconomy = "android" | "pi-browser" | "telegram";

export async function getSetting(
  ctx: QueryCtx | MutationCtx,
  key: RewardKey,
  economy?: SettingEconomy,
): Promise<string> {
  if (economy) {
    const scoped = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", `${key}@${economy}`))
      .unique();
    if (scoped?.value !== undefined && scoped.value !== "") return scoped.value;
  }
  const setting = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return setting?.value ?? REWARD_KEYS[key];
}

export async function getNum(
  ctx: QueryCtx | MutationCtx,
  key: RewardKey,
  economy?: SettingEconomy,
): Promise<number> {
  const val = await getSetting(ctx, key, economy);
  const num = Number(val);
  return !isNaN(num) && num >= 0 ? num : Number(REWARD_KEYS[key]);
}

export async function getJSON<T>(
  ctx: QueryCtx | MutationCtx,
  key: RewardKey,
): Promise<T> {
  const val = await getSetting(ctx, key);
  try {
    return JSON.parse(val) as T;
  } catch {
    return JSON.parse(REWARD_KEYS[key]) as T;
  }
}
