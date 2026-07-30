import type { Id } from '../../convex/_generated/dataModel';

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
};

