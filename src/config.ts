// Live cloud deployment (all users). To test a debug build against the LOCAL
// Convex backend instead: set USE_LOCAL_BACKEND = true, run
//   adb reverse tcp:3210 tcp:3210
// so the phone's 127.0.0.1:3210 reaches the PC. Ignored in release builds.
const USE_LOCAL_BACKEND = false;
export const CONVEX_URL =
  __DEV__ && USE_LOCAL_BACKEND
    ? 'http://127.0.0.1:3210'
    : 'https://valuable-ostrich-597.convex.cloud';
// HTTP actions (webhooks, downloads) live on the .site domain of the same deployment.
export const CONVEX_SITE_URL = CONVEX_URL.replace('.convex.cloud', '.convex.site');

// Pi Browser web app (pi.view2earn.org). Android redirects here for Pi sign-in
// / identity verification, which unlocks the Pi-Browser community features.
export const PI_APP_URL = 'https://pi.view2earn.org';
