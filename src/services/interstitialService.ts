import { InterstitialAd, AdEventType, AdsConsent } from 'react-native-google-mobile-ads';

// Live interstitial ad unit (AdMob account ca-app-pub-5278018921408798).
export const INTERSTITIAL_AD_UNIT = 'ca-app-pub-5278018921408798/5251615181';
// Google test interstitial — used ONLY in __DEV__ (never in production builds).
export const INTERSTITIAL_TEST_AD_UNIT = 'ca-app-pub-3940256099942544/1033173712';

function getInterstitialUnitId(): string {
  return __DEV__ ? INTERSTITIAL_TEST_AD_UNIT : INTERSTITIAL_AD_UNIT;
}

// AdMob interstitial best practices:
//  - show only at natural transition points (task done, quiz done, spin again)
//  - keep a minimum gap so users are not spammed (avoids accidental clicks)
//  - hard cap per session
const MIN_INTERVAL_MS = 30_000; // at least 30s between interstitials
const MAX_PER_SESSION = 10; // never exceed 10 per app session

let interstitial: InterstitialAd | null = null;
let loaded = false;
let loading = false;
let lastShownAt = 0;
let shownInSession = 0;

async function canRequestAds(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    if (info.canRequestAds === false) {
      console.log('[Interstitial] canRequestAds=false — skip');
      return false;
    }
  } catch { }
  return true;
}

function createAndLoad() {
  if (loading) return;

  const unitId = getInterstitialUnitId();
  console.log('[Interstitial] loading unit', unitId, __DEV__ ? '(TEST)' : '(LIVE)');

  // Dispose any previous instance + listeners before requesting a new ad.
  try {
    interstitial?.removeAllListeners();
  } catch { }

  try {
    interstitial = InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    loaded = false;
    loading = true;

    // IMPORTANT: v16 API is `addAdEventListener` (returns an unsubscribe fn).
    // The previous code called `addListener`, which does not exist on the ad
    // object — it threw inside this try/catch, so `load()` never ran and the
    // interstitial never loaded.
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[Interstitial] LOADED');
      loaded = true;
      loading = false;
    });

    interstitial.addAdEventListener(AdEventType.ERROR, (e: any) => {
      console.log('[Interstitial] ERROR', e);
      loaded = false;
      loading = false;
      // Retry once after a short delay.
      setTimeout(() => {
        loading = false;
        preloadInterstitial();
      }, 5000);
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Interstitial] CLOSED');
      loaded = false;
      loading = false;
      // Warm up the next interstitial for the following break point.
      setTimeout(() => preloadInterstitial(), 1500);
    });

    interstitial.load();
  } catch (e) {
    console.warn('[Interstitial] create failed', e);
    loading = false;
    loaded = false;
  }
}

export function preloadInterstitial() {
  if (loading || loaded) return;
  canRequestAds().then((ok) => {
    if (!ok) return;
    createAndLoad();
  });
}

export async function showInterstitial(): Promise<boolean> {
  console.log(
    '[Interstitial] show requested, loaded=',
    loaded,
    'lastShown',
    lastShownAt ? Date.now() - lastShownAt : -1,
    'ms ago',
  );

  // Frequency capping — do not show too soon or too often.
  if (lastShownAt && Date.now() - lastShownAt < MIN_INTERVAL_MS) {
    console.log(
      '[Interstitial] skip — too soon, wait',
      MIN_INTERVAL_MS - (Date.now() - lastShownAt),
      'ms',
    );
    return false;
  }
  if (shownInSession >= MAX_PER_SESSION) {
    console.log('[Interstitial] skip — max per session');
    return false;
  }
  if (!(await canRequestAds())) {
    console.log('[Interstitial] skip — canRequestAds false');
    return false;
  }

  // If nothing is preloaded, kick off a load and wait briefly for it.
  if (!interstitial || !loaded) {
    console.log('[Interstitial] not ready, preloading and waiting');
    preloadInterstitial();
    // wait up to 4s for load (first load can take 1-3s)
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (loaded && interstitial) break;
    }
    if (!loaded || !interstitial) {
      console.log('[Interstitial] not loaded after wait — skip this time');
      return false;
    }
  }

  try {
    console.log('[Interstitial] showing');
    await interstitial.show();
    loaded = false;
    lastShownAt = Date.now();
    shownInSession += 1;
    return true;
  } catch (e) {
    console.warn('[Interstitial] show failed', e);
    loaded = false;
    loading = false;
    setTimeout(() => preloadInterstitial(), 1000);
    return false;
  }
}

// Call once at app start to warm the cache (after AdMob init).
export function initInterstitial() {
  // preload immediately + again after 2s to ensure filled
  preloadInterstitial();
  setTimeout(() => preloadInterstitial(), 2000);
}

// For testing / session reset.
export function resetInterstitialSession() {
  shownInSession = 0;
  lastShownAt = 0;
  console.log('[Interstitial] session reset');
}