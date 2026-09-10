import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser, getOptionalUser } from "./lib/guards";
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
  recent: any[];
  streak: any;
  spin: any;
  box: any;
  combo: any;
  progress: any;
  referral: any;
  rank: any;
  achievements: any[];
};

// One round-trip dashboard for the smart Profile hub. Aggregates everything the
// coach panel, stats strip, and achievements preview need by composing the
// existing per-feature queries (plan: smart profile redesign).
export const smartDashboard = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<SmartDashboardData> => {
    const user = await getOptionalUser(ctx, userId);
    if (!user) {
      return {
        user: {
          username: "pioneer",
          name: "Pioneer",
          ecosystem: "PI",
          tier: 1,
          country: "",
          joinedAt: Date.now(),
          payoutEvm: "",
          payoutSolana: "",
          telegramUserId: "",
        },
        stats: {
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          tasksCompleted: 0,
        },
        recent: [],
        streak: { current: 0, longest: 0, checkedInToday: false, canCheckIn: false, cycleDay: 1, todayReward: 10, schedule: [] },
        spin: { spinsRemaining: 0, baseSpinsRemaining: 0, bonusSpins: 0, adBonusEarned: 0, adBonusLimit: 5, adBonusRemaining: 5, nextRefillMs: 0, nextRefillAt: 0, windowTotalMs: 86400000 },
        box: { tasksToday: 0, needed: 3, openedToday: false, eligible: false },
        combo: { active: null, completedCount: 0, totalCount: 0, allDone: false, claimedToday: false, canClaim: false, reward: 0 },
        progress: null,
        referral: { code: "", count: 0, qualifiedCount: 0, totalEarned: 0, referredBy: null },
        rank: { rank: null, total: 0, balance: 0 },
        achievements: [],
      };
    }
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
