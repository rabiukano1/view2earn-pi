import type { Id } from '../../convex/_generated/dataModel';
import type { PolicyKey } from '@view2earn/core';

export type RootTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Wallet: undefined;
  Rewards: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Marketplace: undefined;
  CreateListing: { userId: Id<'users'> };
  PointsHistory: undefined;
  WalletHistory: undefined;
  Academy: { userId: string; ecosystem: 'PI' | 'SIDRA' } | undefined;
  Quiz: { userId: string; ecosystem: 'PI' | 'SIDRA' } | undefined;
  Spin: { userId: string } | undefined;
  Surveys: { userId?: string } | undefined;
  Terms: undefined;
  Policy: { policy: PolicyKey };
  Referral: undefined;
  LinkedAccounts: undefined;
  Security: undefined;
  Achievements: undefined;
  Stats: undefined;
  PayoutSettings: undefined;
};

