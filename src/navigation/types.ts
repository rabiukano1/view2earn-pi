import type { Id } from '../../convex/_generated/dataModel';
import type { PolicyKey } from '@view2earn/core';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Settings: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Marketplace: undefined;
  CreateListing: { userId: Id<'users'> };
  Academy: { userId?: string; ecosystem?: 'PI' | 'SIDRA' } | undefined;
  Quiz: { userId?: string; ecosystem?: 'PI' | 'SIDRA' } | undefined;
  Spin: { userId: string } | undefined;
  Level: undefined;
  Surveys: { userId?: string } | undefined;
  Terms: undefined;
  Policy: { policy: PolicyKey };
  Referral: undefined;
  LinkedAccounts: undefined;
  Security: undefined;
  Leaderboard: undefined;
  Achievements: undefined;
  Stats: undefined;
  Donate: undefined;
  WatchHub: undefined;
  VoiceNotes: undefined;
  CommunityVideos: undefined;
  MentorVoice: { mentor: string };
  LiveStreams: { kind: 'football' | 'youtube' | 'other' | 'movies' } | undefined;
  WalletAuth: { nonce: string };
};

