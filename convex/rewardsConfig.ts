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
    { pts: 5, weight: 30 },
    { pts: 10, weight: 24 },
    { pts: 15, weight: 18 },
    { pts: 25, weight: 13 },
    { pts: 40, weight: 9 },
    { pts: 75, weight: 4 },
    { pts: 100, weight: 2 },
    { pts: -1, weight: 1.5 },
    { pts: -2, weight: 0.5 },
    { pts: -3, weight: 0.5 },
  ]),
  baseSpinsPerWindow: "3",
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
} as const;

export type RewardKey = keyof typeof REWARD_KEYS;

export async function getSetting(
  ctx: QueryCtx | MutationCtx,
  key: RewardKey,
): Promise<string> {
  const setting = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return setting?.value ?? REWARD_KEYS[key];
}

export async function getNum(
  ctx: QueryCtx | MutationCtx,
  key: RewardKey,
): Promise<number> {
  const val = await getSetting(ctx, key);
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
