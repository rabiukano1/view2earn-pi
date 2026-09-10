import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

// Live rewarded ad unit IDs (AdMob account ca-app-pub-5278018921408798).
// Google test unit always fills — used in __DEV__ and as fallback in prod when live has no fill.
export const ADMOB_TEST_AD_UNIT = 'ca-app-pub-3940256099942544/5224354917';
export const ADMOB_AD_UNITS = {
  android: 'ca-app-pub-5278018921408798/8327151927',
  ios: 'ca-app-pub-5278018921408798/8327151927',
} as const;

export function getRewardedAdUnitId(): string {
  return __DEV__ ? ADMOB_TEST_AD_UNIT : ADMOB_AD_UNITS.android;
}
export function getRewardedAdUnitIdIOS(): string {
  return __DEV__ ? ADMOB_TEST_AD_UNIT : ADMOB_AD_UNITS.ios;
}

export const INTERSTITIAL_AD_UNIT = 'ca-app-pub-5278018921408798/5251615181';
export const INTERSTITIAL_TEST_AD_UNIT = 'ca-app-pub-3940256099942544/1033173712';

// Devices registered as test devices in the AdMob console (Advertising ID).
// Keep in sync with AdMob → Settings → Test devices so real ads render in
// test mode and the ad inspector gesture works on these devices.
export const ADMOB_TEST_DEVICE_IDS = [
  'EMULATOR',
  'BC8500C8B421D1B2B585C7FDD930A247',
  'bc8500c8b421d1b2b585c7fdd930a247',
  'd890e3c9-31db-476f-bd5c-98c411ce4d44',
  'd890e3c931db476fbd5c98c411ce4d44',
  'D890E3C931DB476FBD5C98C411CE4D44',
] as const;

let isMobileAdsInitialized = false;

/**
 * Initialize Google Mobile Ads SDK, handle GDPR/CCPA UMP consent, and register known test devices.
 * Call this early in app startup (e.g. in App.tsx or Main entry point).
 */
export async function initializeAdMob(): Promise<void> {
  if (isMobileAdsInitialized) return;
  try {
    if (typeof mobileAds !== 'function') {
      console.warn('[AdMob] mobileAds SDK module is not available');
      return;
    }

    // 1. Request UMP GDPR / CCPA Consent Form if required for EU/UK users
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();
      if (
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdsConsentStatus.REQUIRED
      ) {
        await AdsConsent.showForm();
      }
    } catch (consentErr) {
      console.warn('[AdMob] UMP Consent update warning (non-fatal):', consentErr);
    }

    // 1b. Consent gate — don't init/load ads if UMP says ads cannot be requested (EEA without consent)
    try {
      const info = await AdsConsent.getConsentInfo();
      if (info.canRequestAds === false) {
        console.log('[AdMob] canRequestAds=false — skipping init (non-personalized fallback via UMP)');
        isMobileAdsInitialized = true;
        return;
      }
    } catch {}

    // 2. Safely set test device configuration & COPPA regulatory flags
    try {
      await mobileAds().setRequestConfiguration({
        testDeviceIdentifiers: [...ADMOB_TEST_DEVICE_IDS],
        maxAdContentRating: MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
    } catch (configError) {
      console.warn('[AdMob] setRequestConfiguration warning:', configError);
    }

    const adapterStatuses = await mobileAds().initialize();
    console.log('[AdMob] Initialized successfully with compliance check:', adapterStatuses);
    isMobileAdsInitialized = true;
  } catch (error) {
    console.warn('[AdMob] Initialization warning (non-fatal):', error);
  }
}
