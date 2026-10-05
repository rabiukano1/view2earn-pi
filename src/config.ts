// Single source of the backend URL for the Android app. Nothing else in the
// app may hardcode a backend host.
//
// Production  -> self-hosted Convex on the VPS.
// Development -> the laptop backend. Reach it from the device with either:
//     real device / USB : adb reverse tcp:3210 tcp:3210 ; adb reverse tcp:3211 tcp:3211
//     Android emulator  : swap 127.0.0.1 for 10.0.2.2 below
//
// Release builds are HTTPS-only: cleartext is enabled only by the debug
// manifest (android/app/src/debug/AndroidManifest.xml), so the DEV_* hosts
// cannot work in a release build by design.

const PROD_API_URL = 'https://api.view2earn.org';
const PROD_SITE_URL = 'https://site.view2earn.org';

const DEV_API_URL = 'http://127.0.0.1:3210';
const DEV_SITE_URL = 'http://127.0.0.1:3211';

// Flip to true to point a DEBUG build at the laptop backend. Has no effect on
// release builds.
const USE_LOCAL_BACKEND = false;
const useLocal = __DEV__ && USE_LOCAL_BACKEND;

export const CONVEX_URL = useLocal ? DEV_API_URL : PROD_API_URL;

// HTTP actions (webhooks, file downloads) are a SEPARATE origin on self-hosted
// Convex — its own port/domain, not a suffix of the API host. So this is an
// explicit value and must never be derived from CONVEX_URL by string replace.
export const CONVEX_SITE_URL = useLocal ? DEV_SITE_URL : PROD_SITE_URL;

// Pi Browser web app (pi.view2earn.org). Android redirects here for Pi sign-in
// / identity verification, which unlocks the Pi-Browser community features.
export const PI_APP_URL = 'https://pi.view2earn.org';
