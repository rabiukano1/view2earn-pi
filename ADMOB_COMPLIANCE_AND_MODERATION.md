# View2Earn - Google AdMob Compliance, Security & Moderation Master Documentation

> **Last Updated:** August 12, 2026  
> **Status:** Compliant across Behavioral, Invalid Traffic & Publisher Content policies. Privacy/ATT requires iOS ATT implementation before App Store release.  
> **Repository:** `View2Earn` (`d:\user\v2e\View2Earn`)

---

## 🔎 Audit Correction Report (August 12, 2026)

Every claim below was re-verified against the actual codebase and Google's current AdMob program policies. Findings:

### ✅ Verified TRUE (no change needed)
1. **User-initiated rewarded ads only** — `RewardedAdModal.tsx` loads/shows an ad only after the user taps "Watch Video…". No auto-play, no rewarded-interstitial.
2. **Explicit CTA copy** — `"Watch Video (+{pts} PTS)"`, `"Watch video to check in"`, `"Watch video to open"`, `"Watch & Claim"`, `"Watch Video for Bonus Spin"`, `"WATCH VIDEO TO DOUBLE"` all confirmed in components (see §1).
3. **PTS-only rewarded flow** — points credited server-side in `convex/ads.ts` `rewardForAd` only (client passes `adType`, ledger reason `AD_REWARD_*`); no click-based payout.
4. **30s per-user cooldown** — `rewardForAd` rejects repeated `AD_REWARD_*` claims within 30s (`convex/ads.ts`).
5. **Admin moderation pipeline** — `createListing` writes `status: "pending_approval"`; `listListings` filters `status === "active"`; `listPendingListings` / `approveListing` / `rejectListing` exist in `convex/admin.ts`, and `rejectListing` refunds the escrowed fee.
6. **UMP consent + COPPA flags** — `AdsConsent.requestInfoUpdate()` / `.showForm()` and `tagForChildDirectedTreatment: false`, `tagForUnderAgeOfConsent: false` confirmed in `admobService.ts`.
7. **Privacy surfaces** — `TermsScreen.tsx` §9 Privacy; website `/privacy` route present; `NSUserTrackingUsageDescription` set in `Info.plist`.
8. **Bugs fixed as documented** — unmount race (await `rewardForAd` + `onSuccess` before close), dev-only fallback gated by `__DEV__`, `Boolean(...)` ternaries, Telegram "Link Telegram Now" alert.

### ⚠️ CORRECTIONS REQUIRED (doc was inaccurate)
1. **Bonus-spin cap (§2.3)** — doc said *"max 5 bonus spins per 3-hour window"*. Actual default is **2** (`adBonusSpinsPerWindow: "2"` in `convex/rewardsConfig.ts`); window is 3h (`spinWindowHours: "3"`). Value is admin-configurable.
2. **"URL domain sanitization" (§3 & matrix)** — **NOT implemented.** `createListing` only rejects an empty `targetUrl`; there is no domain allowlist/sanitizer. The only real control is human admin review. This is a hardening gap, not an implemented control.
3. **CMP wording (§4.1)** — the app uses **Google's own UMP SDK** (via `react-native-google-mobile-ads` `AdsConsent`), which is Google's certified consent solution. It is **not** a separate third-party "Google-certified CMP". TCF v2.2 support is only active if the GDPR message configured in the AdMob **Privacy & messaging** console is the TCF type. Best practice also requires checking `AdsConsent.getConsentInfo().canRequestAds` before initializing/loading ads — currently ads load regardless of consent state (UMP degrades to non-personalized internally).
4. **Privacy Policy does not name Google/AdMob** — the hosted privacy policy only says "advertising partners". AdMob best-practice requires a Google ad-tech disclosure + link (e.g. `https://policies.google.com/technologies/ads`) for EEA/UK and California.
5. **app-ads.txt / app-ID wiring — VERIFIED but undocumented** — `app-ads.txt` exists at `apps/website/public` **and** `apps/admin-panel/public` (`google.com, pub-5278018921408798, DIRECT, f08c47fec0942fa0`); `GADApplicationIdentifier` set in AndroidManifest, `app.json`, and `Info.plist`; `DELAY_APP_MEASUREMENT_INIT` enabled. Should be recorded as compliant infra.
6. **iOS ATT status (§4.4)** — the `NSUserTrackingUsageDescription` string exists, but the **ATT prompt is not yet presented** (no `requestTrackingPermission()`; pending per §6 #4). Matrix row 4 should not read "100%".

### 🛠 ACTION ITEMS (for you to implement)
- **A1.** Add a marketplace URL sanitizer / domain allowlist in `createListing` (currently missing — see §3.2).
- **A2.** Add Google/AdMob (and `react-native-google-mobile-ads` / Google Mobile Ads SDK) disclosure + link in the hosted Privacy Policy (packages/core `privacy.ts` + website).
- **A3.** Before `mobileAds().initialize()`, check `AdsConsent.getConsentInfo()` → only init/load ads when `canRequestAds` is true (or after form completion). Current `admobService.ts` init is consent-blind.
- **A4.** Finish iOS ATT (`react-native-tracking-transparency` + `requestTrackingPermission()`) before App Store release (§6 #4).
- **A5.** Consider AdMob **Server-Side Verification (SSV)** for `rewardForAd` — the current cooldown mitigates spam but reward integrity is client-`isEarnedReward`-only; SSV is the Google-recommended hardening for rewarded.
- **A6.** Keep `adBonusSpinsPerWindow` low (default 2) — it is a *reward-gated frequency cap*, not an ad-frequency cap; fine as-is, just documented here accurately.

---

## 📋 Executive Summary & Compliance Matrix

| Policy Category | Core Requirement | View2Earn Technical Implementation | Status |
| :--- | :--- | :--- | :--- |
| **1. Behavioral & Implementation** | No encouraging clicks, clear opt-in, no accidental click layouts | Solid `circle-play` video icons on action buttons; explicit `"Watch Video"` copy; isolated fullscreen Rewarded Ads. | 🟢 **100% Compliant** |
| **2. Invalid Traffic & Manipulation** | No self-clicking, no bot traffic, no direct cash for ad clicks | Registered `ADMOB_TEST_DEVICE_IDS`; PTS virtual currency model; strict window frequency capping. | 🟢 **100% Compliant** |
| **3. Publisher Content Policies** | No illegal goods, adult content, hate speech, or copyright infringement | Mandatory Admin Approval pipeline (`pending_approval` → `active`) before user listings go live; **URL domain sanitization NOT implemented (gap)**. | 🟢 **100% Compliant** (approval) · ⚠️ see §3.2 for URL sanitization gap |
| **4. Privacy, Consent & Regulatory** | Valid Privacy Policy link, UMP GDPR CMP form, COPPA flags & ATT prompt | Google UMP SDK via `AdsConsent` in `admobService.ts`; COPPA `tagForChildDirectedTreatment: false`; in-app & web privacy policy links; `NSUserTrackingUsageDescription` in `Info.plist`. | 🟢 **Compliant** (UMP/COPPA/privacy) · ⚠️ **ATT prompt pending iOS release** (§6.4) · **AdMob not named in Privacy Policy** (A2) |

---

## 🎨 1. Behavioral & Ad Implementation Policies

Google strictly forbids any technique that entices or tricks users into tapping on ads.

### Key Rules Enforced:
1. **User-Initiated Rewarded Ads (CRITICAL):** Rewarded ads are **never auto-played**. The user must actively tap the "Watch Video" button to trigger the ad. AdMob strictly requires all rewarded ads to be user-initiated — auto-playing is a bannable offense.
2. **Explicit CTA Wording:** Action buttons inside ad overlays must state **"Watch Video"** or **"Watch Ad to Claim"**, never ambiguous "Claim" or prohibited "Click ad" text.
3. **No Accidental Click Layouts:** Ads play inside Google's native fullscreen SDK overlay container (`RewardedAdModal.tsx`), completely separated from interactive UI elements.

### Updated Code Assets:
* **[RewardedAdModal.tsx](file:///d:/user/v2e/View2Earn/src/components/RewardedAdModal.tsx):**
  * CTA Button label updated to **`"Watch Video (+50 PTS)"`** with a solid video play icon (`circle-play`).
* **[StreakCard.tsx](file:///d:/user/v2e/View2Earn/src/components/StreakCard.tsx):**
  * Subtitle updated to `"Watch video to check in (+50 pts)"`.
  * Check-in button includes a `circle-play` vector icon when available.
* **[DailyBox.tsx](file:///d:/user/v2e/View2Earn/src/components/DailyBox.tsx):**
  * Subtitle updated to `"Watch video to open · win up to 250 pts"`.
  * Open button CTA updated to **`"Watch Video"`** with a `circle-play` vector icon.
* **[ComboTracker.tsx](file:///d:/user/v2e/View2Earn/src/components/ComboTracker.tsx):**
  * Added a `circle-play` vector icon and updated CTA text to **`"Watch & Claim"`** when ready.
* **[SpinScreen.tsx](file:///d:/user/v2e/View2Earn/src/screens/SpinScreen.tsx):**
  * Updated bonus spin button text to `"Watch Video for Bonus Spin"`.
  * Updated result button to `"WATCH VIDEO TO DOUBLE"` with a video play icon.

---

## 🛡️ 2. Invalid Traffic & Manipulation Policies

AdMob policies protect advertisers from invalid clicks, automated bots, and paid-click schemes.

### Key Safeguards Active in View2Earn:
1. **Developer Test Device Configuration:**
   * In [admobService.ts](file:///d:/user/v2e/View2Earn/src/services/admobService.ts), live test devices and `EMULATOR` IDs are registered with `mobileAds().setRequestConfiguration(...)`. Live ads render harmless test overlays during development.
2. **PTS Virtual Currency Model:**
   * Points (**PTS**) are an internal gamification & activity currency. They are awarded for watching Rewarded Videos to completion (`isEarnedReward`), **never** for clicking ad links.
   * Users accumulate PTS from multiple non-ad activities (tasks, daily quizzes, surveys, referrals, streaks).
3. **Frequency Capping & Rate Limiting:**
   * In [spin.ts](file:///d:/user/v2e/View2Earn/convex/spin.ts), bonus ad spins are capped per window (default **max 2** bonus spins per 3-hour window via `adBonusSpinsPerWindow` in [rewardsConfig.ts](file:///d:/user/v2e/View2Earn/convex/rewardsConfig.ts); admin-configurable) to prevent artificial impression looping.
   * In [ads.ts](file:///d:/user/v2e/View2Earn/convex/ads.ts), the core `rewardForAd` mutation enforces a **30-second per-user cooldown** — any repeated calls within 30s are rejected to prevent malicious clients from spamming ad rewards.

---

## 🏛️ 3. Google Publisher Content & Mandatory Admin Moderation Pipeline

Google requires that no app content surrounding ads contains illegal goods, adult material, hate speech, or copyright infringement.

### Admin Approval Workflow for User Listings
To prevent unvetted user-submitted links (e.g. social media handles, channel URLs) from ever appearing directly to other users:

1. **User Creation (`CreateListingScreen.tsx` & `convex/marketplace.ts`):**
   * When a user creates a marketplace listing, both the task and marketplace listing are saved with status **`"pending_approval"`**.
   * Points for the listing fee are safely escrowed in the backend points ledger.
   * The user receives a clear confirmation:  
     `"Submitted for Admin Review 🛡️ — Your social link has been submitted to the Admin for approval. Once approved, it will go live for users!"`

2. **Marketplace Filtering (`convex/marketplace.ts`):**
   * `listListings` queries only listings with status `"active"`. Pending listings do **NOT** appear in the marketplace or tasks list for other users until approved.

3. **Admin Moderation Endpoints (`convex/admin.ts`):**
   * `listPendingListings`: Admin query to list all marketplace listings awaiting moderation.
   * `approveListing`: Admin mutation to update listing and task status to `"active"`, releasing it to the live platform.
   * `rejectListing`: Admin mutation to reject unsafe listings and automatically refund the escrowed points fee back to the creator user.

> **⛔ Correction — URL domain sanitization is NOT implemented.** `createListing` in `marketplace.ts` only rejects an empty `targetUrl`; there is no domain allowlist, scheme restriction, or sanitizer on the stored URL. The only safeguard today is the human admin approval step above. AdMob policy §3 has no explicit URL-domain requirement, but this is a **hardening gap** for preventing malicious/flagged destinations from going live after admin approval. Implement an allowlist/sanitizer in `createListing` (action item **A1**) before relying on automation.

### 📋 AdMob Account Wiring (verified present, previously undocumented)
* **app-ads.txt** is published at `apps/website/public/app-ads.txt` **and** `apps/admin-panel/public/app-ads.txt`:
  `google.com, pub-5278018921408798, DIRECT, f08c47fec0942fa0` (matches the app publisher ID).
* **GADApplicationIdentifier** (`ca-app-pub-5278018921408798~9302302185`) is set in `AndroidManifest.xml`, `app.json`, and iOS `Info.plist`; `DELAY_APP_MEASUREMENT_INIT` is enabled via `delay_app_measurement_init: true`.
* **Rewarded ad units** `ca-app-pub-5278018921408798/8327151927` are configured in `admobService.ts` (Android **and** iOS share the same unit — see §6 #5 to split them).

---

## ⚖️ 4. Privacy, Consent & Regulatory Policies

Google requires strict adherence to international user data privacy laws and consent management frameworks.

### Key Regulatory Implementations:
1. **Google UMP Consent (GDPR / EEA & UK):**
   * In [admobService.ts](file:///d:/user/v2e/View2Earn/src/services/admobService.ts#L43-L49), `AdsConsent.requestInfoUpdate()` checks for EU/UK users and triggers `AdsConsent.showForm()` when required before any ads are served.
   * **⚠️ Correction — consent-gating gap:** the GDPR/EEA best practice (Google UMP docs) is to check `AdsConsent.getConsentInfo().canRequestAds` before `mobileAds().initialize()` / loading any ad. Today `admobService.ts` calls `requestInfoUpdate()` and shows the form, but then initializes unconditionally regardless of the consent outcome (UMP internally degrades to non-personalized ads when consent is absent). Add a `canRequestAds` gate (action item **A3**).
   * **⚠️ Note:** this is **Google's own UMP SDK** (Google's certified consent solution), **not** a third-party "Google-certified CMP". TCF v2.2 strings are only produced when the GDPR message is configured as a TCF message in the AdMob Privacy & messaging console. Update any marketing/audit wording accordingly.
2. **COPPA / Child Privacy Flags:**
   * In [admobService.ts](file:///d:/user/v2e/View2Earn/src/services/admobService.ts#L58-L60), explicit regulatory flags are set:
     ```ts
     tagForChildDirectedTreatment: false,
     tagForUnderAgeOfConsent: false,
     ```
     This certifies that View2Earn is a general audience app (18+) and does not target children under 13.
3. **Hosted Privacy Policy:**
   * **In-App:** Accessible via Profile / Settings → Terms & Conditions ([TermsScreen.tsx](file:///d:/user/v2e/View2Earn/src/screens/TermsScreen.tsx)), which includes Section 9: Privacy and Data Protection.
   * **Web & Store Listing:** Publicly hosted at the website `/privacy` route ([privacy/page.tsx](file:///d:/user/v2e/View2Earn/apps/website/src/app/privacy/page.tsx)), rendered from the shared policy source in `packages/core/src/policies/privacy.ts`.
   * **⚠️ Correction:** the hosted Privacy Policy does **not** name Google, AdMob, or the Google Mobile Ads SDK — it only says "advertising partners". For EEA/UK (Google EU User Consent Policy) and California, AdMob disclosure practices expect a clear ad-tech disclosure and a link to Google's ads policies (e.g. https://policies.google.com/technologies/ads). Add this to `privacy.ts` (action item **A2**) so the in-app §9 and web page both surface it.
4. **Apple ATT (App Tracking Transparency):**
   * Configured `NSUserTrackingUsageDescription` in [Info.plist](file:///d:/user/v2e/View2Earn/ios/View2Earn/Info.plist) (`"This identifier will be used to deliver personalized advertisements to you."`). The UMP SDK can additionally drive an IDFA/ATT message if one is configured in the AdMob Privacy & messaging console.
   * **⚠️ Correction:** the ATT **prompt itself is not yet presented** — `requestTrackingPermission()`/`react-native-tracking-transparency` is not installed or called. Until §6 #4 (A4) is done, **do not claim "100% ATT compliant"**.
5. **Official Rewarded Ad SDK Usage Only:**
   * View2Earn strictly utilizes Google's official `useRewardedAd` hook from `react-native-google-mobile-ads`. Non-standard custom ad injection is prohibited.

---

## 🔧 5. Technical Bug Fixes & Infrastructure Upgrades

### A. Fixed Reward Unmount Race Condition ([RewardedAdModal.tsx](file:///d:/user/v2e/View2Earn/src/components/RewardedAdModal.tsx))
* **Problem:** When an ad closed (`isClosed`), `onClose()` unmounted the modal before the async `rewardForAd` API call and `onSuccess` callback (`doCheckIn`, `doOpenBox`, `doClaim`, `handleAdSuccess`) finished executing.
* **Fix:** `RewardedAdModal` now awaits points crediting and `onSuccess` completion **before** closing the modal.

### B. Dev-Only Error / Simulated Claim Fallback
* **Problem:** When running on emulators, in test mode, or when AdMob had no inventory (`no-fill`), users were stuck on "Could not load video" and lost their check-in/reward.
* **Fix:** When `phase === 'error'`, a **`"DEV Claim (+50 PTS)"`** fallback button is available **only in development builds** (`__DEV__` guard). In production, users see only a Retry button. This prevents awarding points without a completed ad view, which AdMob considers invalid traffic.

### C. Fixed React Native `<Text>` Whitespace Crash
* **Problem:** Trailing whitespace between `</Text>` and `</>` inside a JSX fragment in `RewardedAdModal.tsx` caused the React Native error `Text strings must be rendered within a <Text> component.`
* **Fix:** Cleaned up JSX whitespace and converted conditional icon renders in all components to explicit `Boolean(...) ? <Component /> : null` ternaries.

### D. Telegram Channel Join Error Handling ([TasksScreen.tsx](file:///d:/user/v2e/View2Earn/src/screens/TasksScreen.tsx))
* **Problem:** Verifying a Telegram task without a linked Telegram account caused an uncaught error `Link your Telegram account first (Profile → Link Telegram)`.
* **Fix:** Added an interactive error alert in `executeVerify` with a direct **"Link Telegram Now"** button that navigates directly to `LinkedAccountsScreen`.

---

## 📌 6. Future Maintenance Guidelines

1. **Always Keep Test Devices Updated:** Update `ADMOB_TEST_DEVICE_IDS` in [admobService.ts](file:///d:/user/v2e/View2Earn/src/services/admobService.ts) when adding new physical testing devices.
2. **Do Not Market Ads as Direct Cash:** Maintain the "Points / PTS" in-app gamification terminology in all store listings and UI text.
3. **Add URL Sanitization (A1):** Implement a domain allowlist / URL sanitizer inside `createListing` in [marketplace.ts](file:///d:/user/v2e/View2Earn/convex/marketplace.ts) so admin-approval is not the only gate.
4. **Name AdMob in Privacy Policy (A2):** Add a Google/AdMob/Google-Mobile-Ads-SDK disclosure with a link to Google's ads policies in `packages/core/src/policies/privacy.ts` (and confirm it renders on the web `/privacy` route).
5. **Gate Ads on Consent (A3):** In [admobService.ts](file:///d:/user/v2e/View2Earn/src/services/admobService.ts), check `AdsConsent.getConsentInfo().canRequestAds` before `mobileAds().initialize()` and before any rewarded ad is loaded; only init when consent permits.
6. **Implement Apple ATT Before iOS Release (A4):** Install `react-native-tracking-transparency` and integrate `requestTrackingPermission()` (call it after UMP consent) before submitting to the App Store.
7. **Consider Server-Side Verification (A5):** Wire AdMob rewarded **SSV** postback into `rewardForAd` in [ads.ts](file:///d:/user/v2e/View2Earn/convex/ads.ts) for stronger reward-integrity guarantees (the client-side `isEarnedReward` + 30s cooldown is a stopgap).
8. **Create Separate iOS Ad Unit:** Create a dedicated iOS ad unit ID in the AdMob dashboard and update `ADMOB_AD_UNITS.ios` in `admobService.ts` (currently both platforms share the same ID).
9. **Never Remove `__DEV__` Guard from Simulated Claim:** The fallback claim button in `RewardedAdModal.tsx` must remain dev-only. Awarding points without a completed ad view in production is grounds for AdMob account termination.
10. **Keep `adBonusSpinsPerWindow` Low:** The default of **2** bonus ad spins per 3-hour window (in `convex/rewardsConfig.ts`) is a rewards-frequency cap, not an ad cap — AdMob frequency capping remains to be configured in the dashboard if desired.
