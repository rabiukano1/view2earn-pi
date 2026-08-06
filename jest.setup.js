/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.doMock('react-native', () => {
  const ReactNative = jest.requireActual('react-native');

  const mock = {
    __esModule: true,
    NativeModules: {
      ...(ReactNative.NativeModules || {}),
      RNAppModule: {
        addListener: jest.fn(),
        removeListeners: jest.fn(),
        eventsAddListener: jest.fn(),
        eventsNotifyReady: jest.fn(),
      },
      RNGoogleMobileAdsModule: {
        addListener: jest.fn(),
        removeListeners: jest.fn(),
        eventsAddListener: jest.fn(),
        eventsNotifyReady: jest.fn(),
      },
      RNGoogleMobileAdsRewardedModule: {},
      RNGoogleMobileAdsConsentModule: {},
    },
    TurboModuleRegistry: {
      ...(ReactNative.TurboModuleRegistry || {}),
      getEnforcing: () => ({
        addListener: jest.fn(),
        removeListeners: jest.fn(),
        eventsAddListener: jest.fn(),
        eventsRemoveListener: jest.fn(),
        eventsNotifyReady: jest.fn(),
        initialize: jest.fn(),
        setRequestConfiguration: jest.fn(),
        openAdInspector: jest.fn(),
        openDebugMenu: jest.fn(),
        setAppVolume: jest.fn(),
        setAppMuted: jest.fn(),
        interstitialLoad: jest.fn(),
        interstitialShow: jest.fn(),
      }),
    },
  };
  mock.default = mock;
  return Object.setPrototypeOf(mock, ReactNative);
});

jest.doMock('react-native-google-mobile-ads/src/specs/components/GoogleMobileAdsBannerViewNativeComponent', () => ({
  __esModule: true,
  Commands: {},
  default: require('react-native').View,
}));

jest.doMock('react-native-google-mobile-ads/src/specs/components/GoogleMobileAdsNativeViewNativeComponent', () => ({
  __esModule: true,
  Commands: {},
  default: require('react-native').View,
}));

jest.doMock('react-native-google-mobile-ads/src/specs/modules/NativeInterstitialModule', () => ({
  __esModule: true,
  Commands: {},
  default: {
    interstitialLoad: jest.fn(),
    interstitialShow: jest.fn(),
  },
}));

jest.doMock('react-native-google-mobile-ads/src/specs/modules/NativeAppModule', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    eventsAddListener: jest.fn(),
    eventsRemoveListener: jest.fn(),
    eventsNotifyReady: jest.fn(),
    initializeApp: jest.fn(),
    setAutomaticDataCollectionEnabled: jest.fn(),
    deleteApp: jest.fn(),
    eventsGetListeners: jest.fn(),
    eventsPing: jest.fn(),
    metaGetAll: jest.fn(),
    jsonGetAll: jest.fn(),
    preferencesSetBool: jest.fn(),
    preferencesSetString: jest.fn(),
    preferencesGetAll: jest.fn(),
    preferencesClearAll: jest.fn(),
  },
}));
