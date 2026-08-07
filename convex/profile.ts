import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { api } from "./_generated/api";

type ReportData = {
  user: {
    username: string;
    name: string;
    ecosystem: "PI" | "SIDRA";
    tier: number;
    country: string;
    joinedAt: number;
    payoutEvm: string;
    payoutSolana: string;
    telegramUserId: string;
  };
  stats: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    tasksCompleted: number;
  };
  rows: ActivityRow[];
};

type ActivityRow = {
  time: number;
  label: string;
  kind: string;
  detail: string;
  delta: number;
  balanceAfter: number;
};

export type SmartDashboardData = {
  user: ReportData["user"];
  stats: ReportData["stats"];
  recent: ActivityRow[];
  streak: {
    current: number;
    longest: number;
    checkedInToday: boolean;
    canCheckIn: boolean;
    cycleDay: number;
    todayReward: number;
    schedule: number[];
  };
  spin: {
    spinsRemaining: number;
    baseSpinsRemaining: number;
    bonusSpins: number;
    adBonusEarned: number;
    adBonusLimit: number;
    adBonusRemaining: number;
    nextRefillMs: number;
    nextRefillAt: number;
    windowTotalMs: number;
  };
  box: {
    tasksToday: number;
    needed: number;
    openedToday: boolean;
    eligible: boolean;
  };
  combo: {
    social: boolean;
    telegram: boolean;
    quiz: boolean;
    allDone: boolean;
    claimedToday: boolean;
    canClaim: boolean;
    reward: number;
  };
  progress: {
    balance: number;
    target: { name: string; pointsPrice: number } | null;
    ready: boolean;
  } | null;
  referral: {
    code: string;
    count: number;
    qualifiedCount: number;
    totalEarned: number;
    referredBy: string | null;
  };
  rank: {
    rank: number | null;
    total: number;
    balance: number;
  };
  achievements: {
    key: string;
    metric: string;
    target: number;
    icon: string;
    tint: string;
    title: string;
    desc: string;
    enabled: boolean;
    sortOrder: number;
  }[];
};

// One round-trip dashboard for the smart Profile hub. Aggregates everything the
// coach panel, stats strip, and achievements preview need by composing the
// existing per-feature queries (plan: smart profile redesign).
export const smartDashboard = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<SmartDashboardData> => {
    await requireUser(ctx, userId);
    const activity: ReportData = await ctx.runQuery(api.reports.myActivity, {
      userId,
    });
    const streak: {
      current: number;
      longest: number;
      checkedInToday: boolean;
      canCheckIn: boolean;
      cycleDay: number;
      todayReward: number;
      schedule: number[];
    } = await ctx.runQuery(api.streaks.getStreak, { userId });
    const spin: {
      spinsRemaining: number;
      baseSpinsRemaining: number;
      bonusSpins: number;
      adBonusEarned: number;
      adBonusLimit: number;
      adBonusRemaining: number;
      nextRefillMs: number;
      nextRefillAt: number;
      windowTotalMs: number;
    } = await ctx.runQuery(api.spin.getSpinStatus, { userId });
    const box: {
      tasksToday: number;
      needed: number;
      openedToday: boolean;
      eligible: boolean;
    } = await ctx.runQuery(api.bonus.getBoxStatus, { userId });
    const combo: {
      social: boolean;
      telegram: boolean;
      quiz: boolean;
      allDone: boolean;
      claimedToday: boolean;
      canClaim: boolean;
      reward: number;
    } = await ctx.runQuery(api.combos.getComboStatus, { userId });
    const progress: {
      balance: number;
      target: { name: string; pointsPrice: number } | null;
      ready: boolean;
    } | null = await ctx.runQuery(api.rewards.progressToNext, { userId });
    const referral: {
      code: string;
      count: number;
      qualifiedCount: number;
      totalEarned: number;
      referredBy: string | null;
    } = await ctx.runQuery(api.rewards.myReferral, { userId });
    const rank: {
      rank: number | null;
      total: number;
      balance: number;
    } = await ctx.runQuery(api.leaderboard.myRank, { userId });
    const achievements = await ctx.runQuery(api.achievements.getEnabled, {});
    return {
      user: activity.user,
      stats: activity.stats,
      recent: activity.rows.slice(0, 10),
      streak,
      spin,
      box,
      combo,
      progress,
      referral,
      rank,
      achievements,
    };
  },
});
