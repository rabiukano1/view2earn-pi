import type { Id } from '../../convex/_generated/dataModel';

export type RootTabParamList = {
  Tasks: undefined;
  Rewards: undefined;
  Quiz: { userId: string; ecosystem: 'PI' | 'SIDRA' } | undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Marketplace: undefined;
  CreateListing: { userId: Id<'users'> };
  PointsHistory: undefined;
};
