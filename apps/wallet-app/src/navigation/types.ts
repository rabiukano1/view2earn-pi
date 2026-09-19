export type RootTabParamList = {
  Wallet: undefined;
  Platforms: undefined;
  Rewards: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  WalletHistory: undefined;
  PointsHistory: undefined;
  PayoutSettings: undefined;
  Asset: { asset: 'POINTS' | 'VINTA' | 'PIPRO' };
  Platforms: undefined;
};
