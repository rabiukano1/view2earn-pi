// Single source of the backend URL for the wallet app. See src/config.ts in
// the repo root for the dev/prod rules — same contract, same hosts.
const PROD_API_URL = 'https://api.view2earn.org';
const DEV_API_URL = 'http://127.0.0.1:3210';

// Flip to true to point a DEBUG build at the laptop backend
// (adb reverse tcp:3210 tcp:3210). No effect on release builds.
const USE_LOCAL_BACKEND = false;

export const CONVEX_URL = __DEV__ && USE_LOCAL_BACKEND ? DEV_API_URL : PROD_API_URL;
export const PI_APP_URL = 'https://pi.view2earn.org';
