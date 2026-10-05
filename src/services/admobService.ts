import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

// Live rewarded ad unit IDs (AdMob account ca-app-pub-5278018921408798).
// Google test unit — __DEV__ ONLY. Never serve this in a release build:
// it earns nothing and violates AdMob policy.
export const ADMOB_TEST_AD_UNIT = 'ca-app-pub-3940256099942544/5224354917';

// Mediation (Unity, ironSource, …) NEVER serves on Google's test ad units —
// those only ever return Google's own demo ads. To verify Unity actually fills
// you must request the LIVE unit from a device listed in ADMOB_TEST_DEVICE_IDS.
// Flip this to true in a debug build to do that. It is DEV-ONLY: release builds
// always use live units via the !__DEV__ term below, so leaving this true cannot
// affect production. The only cost of leaving it on is that debug builds request
// real ads, so keep every dev device registered in ADMOB_TEST_DEVICE_IDS or in
// AdMob's Test devices list — clicking live ads otherwise is invalid traffic.
export const FORCE_LIVE_ADS_IN_DEV = true;

/** True when ad requests should go to the real (revenue-earning) ad units. */
export function shouldUseLiveAdUnits(): boolean {
  return !__DEV__ || FORCE_LIVE_ADS_IN_DEV;
}
export const ADMOB_AD_UNITS = {
  android: 'ca-app-pub-5278018921408798/8327151927',
  ios: 'ca-app-pub-5278018921408798/8327151927',
} as const;

export function getRewardedAdUnitId(): string {
  return shouldUseLiveAdUnits() ? ADMOB_AD_UNITS.android : ADMOB_TEST_AD_UNIT;
}
export function getRewardedAdUnitIdIOS(): string {
  return shouldUseLiveAdUnits() ? ADMOB_AD_UNITS.ios : ADMOB_TEST_AD_UNIT;
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

    // 1b. Consent gate — log canRequestAds but ALWAYS initialize the SDK
    // so that rewarded/interstitial still load (as non-personalized on EEA).
    // Previous code early-returned here and never called mobileAds().initialize(),
    // which caused useRewardedAd / InterstitialAd to stay in "not initialized" state.
    try {
      const info = await AdsConsent.getConsentInfo();
      if (info.canRequestAds === false) {
        console.log('[AdMob] canRequestAds=false — still initializing SDK (npa fallback)');
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
    // One line per mediation adapter. Unity must appear as READY here, or its
    // demand is never requested and match rate will not improve — a silent
    // failure otherwise only visible in AdMob stats days later.
    for (const a of adapterStatuses ?? []) {
      console.log(`[AdMob] adapter ${a.name}: ${a.state === 1 ? 'READY' : 'NOT READY'}`, a.description ?? '');
    }
    isMobileAdsInitialized = true;
  } catch (error) {
    console.warn('[AdMob] Initialization warning (non-fatal):', error);
  }
}
