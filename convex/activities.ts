import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { api } from "./_generated/api";
import { getJSON, getNum } from "./rewardsConfig";

// Centralized Achievements hub (read-only aggregation layer).
//
// This query composes the existing per-feature status queries — it contains NO
// reward logic. Every status shown on the hub is derived from the same backend
// sources the individual screens already use, so a reward granted by the
// existing mutations (spin, openBox, checkIn, submitQuiz, …) is reflected here
// automatically via Convex reactivity. The hub never awards points itself.

// Reward ledger reasons, grouped by the hub activity they belong to. Only used
// to render the "Today's earnings" breakdown from real ledger rows.
export const EARNINGS_BY_ACTIVITY: Record<string, string[]> = {
  checkin: ["DAILY_CHECKIN"],
  spin: ["SPIN_WHEEL"],
  tasks: ["TASK_COMPLETED"],
  learn: ["ACADEMY_LEVEL"],
  surveys: ["SURVEY_COMPLETED"],
  quiz: ["QUIZ_CORRECT"],
  box: ["MYSTERY_BOX"],
  combo: ["COMBO_BONUS"],
};

type StreakStatus = {
  current: number;
  longest: number;
  checkedInToday: boolean;
  canCheckIn: boolean;
  cycleDay: number;
  todayReward: number;
  schedule: number[];
};

type SpinStatus = {
  spinsRemaining: number;
  baseSpinsRemaining: number;
  bonusSpins: number;
  adBonusEarned: number;
  adBonusLimit: number;
  adBonusRemaining: number;
  nextRefillMs: number;
  nextRefillAt: number;
  windowTotalMs: number;
  spinsUsedInWindow: number;
  baseSpinsPerWindow: number;
};

type BoxStatus = {
  tasksToday: number;
  needed: number;
  openedToday: boolean;
  eligible: boolean;
};

type ComboStatus = {
  social: boolean;
  telegram: boolean;
  quiz: boolean;
  allDone: boolean;
  claimedToday: boolean;
  canClaim: boolean;
  reward: number;
};

type AcademyLevel = {
  level: number;
  title: string;
  locked: boolean;
  passed: boolean;
};

type SurveyItem = {
  id: unknown;
  name: string;
  platform: string;
};

export type ActivitiesHubData = {
  stats: { todayEarned: number; earnings: { reason: string; points: number }[] };
  streak: StreakStatus;
  spin: SpinStatus;
  box: BoxStatus;
  combo: ComboStatus;
  tasks: { available: number; availablePoints: number; doneToday: number };
  academy: {
    total: number;
    passed: number;
    locked: number;
    passedToday: number;
    nextUnlocked: boolean;
  };
  surveys: { available: number; doneToday: boolean };
  quiz: { doneToday: boolean };
  rewardConfig: {
    maxSpinPrize: number;
    maxBoxPrize: number;
    academyLevelPoints: number;
    quizCorrectPoints: number;
  };
};

export const getActivitiesHub = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<ActivitiesHubData> => {
    await requireUser(ctx, userId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.getTime();

    // Compose existing status queries (no duplicated business logic).
    const streak: StreakStatus = await ctx.runQuery(api.streaks.getStreak, {
      userId,
    });
    const spin: SpinStatus = await ctx.runQuery(api.spin.getSpinStatus, {
      userId,
    });
    const box: BoxStatus = await ctx.runQuery(api.bonus.getBoxStatus, {
      userId,
    });
    const combo: ComboStatus = await ctx.runQuery(api.combos.getComboStatus, {
      userId,
    });
    const taskRows: { points: number }[] = await ctx.runQuery(api.tasks.list, {
      userId,
    });
    const academy: AcademyLevel[] = await ctx.runQuery(
      api.academy.getAcademy,
      { userId, ecosystem: "PI" },
    );
    const surveyRows: SurveyItem[] = await ctx.runQuery(
      api.surveys.listAvailable,
      { userId },
    );

    // Tasks completed today (active verifications created since local midnight).
    const verifications = await ctx.db
      .query("verifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const doneToday = verifications.filter(
      (ver) =>
        ver.state !== "CANCELLED" &&
        ver.state !== "REJECTED" &&
        ver._creationTime >= since,
    ).length;

    // Academy levels passed today.
    const academyRows = await ctx.db
      .query("academyProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const academyPassedToday = academyRows.filter(
      (r) => r._creationTime >= since,
    ).length;

    // Today's earnings, grouped per ledger reason (real, append-only data).
    const ledger = await ctx.db
      .query("pointsLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const earnings = new Map<string, number>();
    let todayEarned = 0;
    for (const row of ledger) {
      if (row._creationTime < since || row.delta <= 0) continue;
      todayEarned += row.delta;
      earnings.set(row.reason, (earnings.get(row.reason) ?? 0) + row.delta);
    }

    // Reward ceilings straight from the admin-configurable reward settings.
    const spinPrizes = await getJSON<{ pts: number; weight: number }[]>(
      ctx,
      "spinPrizes",
    );
    const boxPrizes = await getJSON<{ pts: number; weight: number }[]>(
      ctx,
      "mysteryBoxPrizes",
    );
    const maxSpinPrize = Math.max(0, ...spinPrizes.map((p) => p.pts));
    const maxBoxPrize = Math.max(0, ...boxPrizes.map((p) => p.pts));

    const availablePoints = taskRows.reduce((s, t) => s + t.points, 0);

    return {
      stats: {
        todayEarned,
        earnings: Array.from(earnings.entries()).map(([reason, points]) => ({
          reason,
          points,
        })),
      },
      streak,
      spin,
      box,
      combo,
      tasks: {
        available: taskRows.length,
        availablePoints,
        doneToday,
      },
      academy: {
        total: academy.length,
        passed: academy.filter((l) => l.passed).length,
        locked: academy.filter((l) => l.locked).length,
        passedToday: academyPassedToday,
        // True when at least one lesson can be attempted right now.
        nextUnlocked: academy.some((l) => !l.passed && !l.locked),
      },
      surveys: {
        available: surveyRows.length,
        doneToday: (earnings.get("SURVEY_COMPLETED") ?? 0) > 0,
      },
      quiz: {
        doneToday: combo.quiz,
      },
      rewardConfig: {
        maxSpinPrize,
        maxBoxPrize,
        academyLevelPoints: await getNum(ctx, "academyLevelPoints"),
        quizCorrectPoints: await getNum(ctx, "quizCorrectPoints"),
      },
    };
  },
});
