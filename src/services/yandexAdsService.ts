import { MobileAds } from 'yandex-mobile-ads';
import { canRequestAds } from './admobService';

// Yandex (Boost) banner ads for the voices list — a format AdMob is not
// serving anywhere in this app today.
//
// Why a second SDK rather than mediation: AdMob cannot mediate Yandex. The
// only adapter that exists runs the other way round (Yandex as the mediator,
// AdMob as a demand source), and switching to that would mean re-plumbing the
// rewarded + SSV flow. So Yandex lives beside AdMob, on its own screen, with
// no AdMob ad adjacent to it — which is what keeps both networks' placement
// rules satisfied.
//
// Demand note: Yandex fill is concentrated in RU/CIS/Turkey. Outside those
// markets expect mostly no-fills, which render as nothing at all (see
// YandexBannerRow) rather than as empty space.

/** Yandex's own demo placement. Always fills, earns nothing. __DEV__ only. */
export const YANDEX_DEMO_BANNER_UNIT = 'demo-banner-yandex';

/**
 * Live banner placement for the voices list, from the Yandex partner interface
 * (account 20139559, unit "Banner", created 2026-10-06). Leave this empty to
 * disable Yandex in release builds: with no ID no live request is ever made,
 * so the list simply shows no banner instead of erroring.
 */
export const YANDEX_VOICES_BANNER_UNIT = 'R-M-20139559-4';

/** Max banner height in the voices list, in dp. */
export const YANDEX_BANNER_MAX_HEIGHT = 100;

let consented = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Yandex SDK and pass on the consent decision the user already
 * made in Google's UMP form. One form, both networks: showing a second consent
 * dialog would be worse for the user and no more compliant.
 *
 * `canRequestAds() === false` means the user refused in the EEA, so we also
 * stop rendering banners entirely rather than falling back to non-personalized
 * ones — same rule the AdMob paths follow.
 *
 * The promise is cached, not a boolean: callers await the same init, so a
 * banner mounting mid-startup cannot read the consent flag before it is set.
 */
export function initializeYandexAds(): Promise<void> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

async function init(): Promise<void> {
  try {
    consented = await canRequestAds();
    MobileAds.setUserConsent(consented);
    // Explicit, though false is the default: we never pass location to Yandex,
    // and YandexBannerRow sends no targeting at all (no age, gender, location
    // or context). That is what keeps "Location" off the Play Data safety
    // declaration — see docs/YANDEX-ADS.md.
    MobileAds.setLocationConsent(false);
    if (__DEV__) {
      // Logcat gets the request/no-fill reasons, and failed requests paint a
      // visible indicator on the banner instead of silently rendering nothing.
      MobileAds.enableLogging(true);
      MobileAds.enableDebugErrorIndicator(true);
    }
    await MobileAds.initialize();
  } catch (e) {
    consented = false;
    if (__DEV__) console.warn('[yandex] init failed', e);
  }
}

/**
 * The placement to request, or null when no banner should be shown: consent
 * refused, or a release build with no live placement ID. Only meaningful after
 * initializeYandexAds() has resolved.
 */
export function yandexBannerUnit(): string | null {
  if (!consented) return null;
  if (__DEV__) return YANDEX_DEMO_BANNER_UNIT;
  return YANDEX_VOICES_BANNER_UNIT || null;
}

/**
 * Yandex's Debug Panel: SDK version, integration status, which adapters loaded,
 * the privacy settings actually in force, and an error report to send to their
 * support. This is what Yandex has instead of AdMob's test-device allowlist —
 * there is no device to register, because testing uses the demo placement.
 *
 * Wired to a long-press on the footer line in SettingsScreen, mirroring how
 * the AdMob Ad Inspector is reached from the version text below it.
 */
export async function showYandexDebugPanel(): Promise<void> {
  // Bounded wait, not a plain await: MobileAds.initialize() resolves a native
  // promise that never settles if the SDK cannot start, and awaiting it outright
  // made the long-press look like it was loading forever without ever opening.
  await Promise.race([
    initializeYandexAds(),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
  MobileAds.showDebugPanel();
}
