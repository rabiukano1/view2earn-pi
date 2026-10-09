import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

// The only AdMob identifiers this app may use. App ID lives in
// AndroidManifest.xml: ca-app-pub-5278018921408798~9302302185
//
// No test unit IDs exist here any more, deliberately. A Google sample unit
// reaching a release build earns nothing and breaches AdMob policy, and the
// branch that chose between them was one edit away from doing exactly that.
// Every build now requests the live units; AdMob serves TEST ads to devices
// registered below (and under AdMob -> Settings -> Test devices), which is
// Google's own recommended way to test without inflating live traffic.
export const ADMOB_AD_UNITS = {
  android: 'ca-app-pub-5278018921408798/8327151927',
  ios: 'ca-app-pub-5278018921408798/8327151927',
} as const;

export function getRewardedAdUnitId(): string {
  return ADMOB_AD_UNITS.android;
}
export function getRewardedAdUnitIdIOS(): string {
  return ADMOB_AD_UNITS.ios;
}

export const INTERSTITIAL_AD_UNIT = 'ca-app-pub-5278018921408798/5251615181';

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
 * A3 — consent gate. The SDK is always initialized (early-returning here once
 * left useRewardedAd permanently "not initialized"), but no ad may be
 * REQUESTED while UMP says we cannot. Google's requirement applies to ad
 * requests, not to SDK startup, so gating here is both compliant and safe.
 * Shared by the rewarded and interstitial paths so they cannot drift.
 */
export async function canRequestAds(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    if (info.canRequestAds === false) return false;
  } catch {
    // UMP unavailable (no network, non-EEA): Google treats this as allowed.
  }
  return true;
}

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
