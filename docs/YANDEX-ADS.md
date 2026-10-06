# Yandex (Boost) banners in the voices list

Second banner demand source for the Android app, in the mentor voice list only.
Everything in Phase 1 works **without a Yandex account** — test first, register
later.

---

## What is already built

| File | Role |
|---|---|
| [`src/services/yandexAdsService.ts`](../src/services/yandexAdsService.ts) | SDK init, consent, which placement ID to request |
| [`src/components/YandexBannerRow.tsx`](../src/components/YandexBannerRow.tsx) | One banner, rendered as a list row |
| [`src/components/adRows.ts`](../src/components/adRows.ts) | Inserts an ad row every 6 items |
| [`src/components/VoiceNoteList.tsx`](../src/components/VoiceNoteList.tsx) | Uses the two above |
| [`App.tsx`](../App.tsx) | Warms the SDK 1.5 s after start, after AdMob |
| [`__tests__/ad-rows.test.ts`](../__tests__/ad-rows.test.ts) | Covers the every-6 arithmetic |

Dependency: `yandex-mobile-ads@^8.5.0` (already in `package.json`).

**Where the banner appears:** `VoiceNoteList` is rendered by
`MentorVoiceScreen` — the list of voices you get after tapping a mentor.
`VoiceNotesScreen` (the mentor directory) has its own list and is untouched.

---

## Phase 1 — test with the demo placement (no account needed)

Yandex's `demo-banner-yandex` placement always fills, anywhere in the world,
and earns nothing. It is used automatically in `__DEV__` builds.

1. **Rebuild natively.** A new native module means Metro reload is not enough:

   ```
   cd D:\user\v2e\View2Earn
   npx react-native run-android
   ```

2. **Confirm the SDK started:**

   ```
   adb logcat | findstr Yandex
   ```

   Look for `Yandex Mobile Ads 8.5.0 initialized successfully`.

3. **Look at the placement.** Open the app → a mentor with more than 6 voices →
   scroll. A banner sits after voice 6, 12, 18… and never after the last one.

4. **If no banner appears**, in order of likelihood:
   - Fewer than 7 voices for that mentor → by design, no ad row is inserted.
   - `adb logcat | findstr yandex` shows `banner no-fill` → the demo placement
     was not reachable; check the device has internet.
   - Nothing in logcat at all → the native module did not link. Run
     `cd android && gradlew clean` then rebuild.
   - You declined the GDPR consent form on this device → banners are suppressed
     on purpose. Clear app data to see the form again.

Stop here as long as you like. Nothing requests a live ad yet.

---

## Phase 2 — the Yandex account

Dashboard: **https://partner.yandex.com** (the product is branded "Boost"; the
docs live on boost.yandex.com but the interface stays on partner.yandex.com).

Current state, as of 2026-10-06:

| | |
|---|---|
| Account number | 20139559 |
| App | view2earn / `com.view2earn` — **Active**, owner `support@view2earn-org` |
| Voices banner unit | `R-M-20139559-4` (created 2026-10-06) |

Navigation: **Ad Monetization → Applications** lists the apps; **New app** is
top right. Opening the app gives **New ad unit**, Settings and Reports.

To get the placement ID for the voices list: open the app → **New ad unit** →
**banner** (adaptive/inline, not sticky). The ID is shaped `R-M-XXXXXX-Y`.
Ad units can be created before moderation finishes; impressions just don't
start until it does.

**Payouts:** payment details go in the partner interface and the threshold
depends on your country of residence. Outside Russia the route is an offer
contract with their Armenia (Tech Services LLC) or UAE (Air Smart Advertising
Solutions FZ-LLC) entity, paying to a Payoneer e-wallet in USD/EUR.

## Phase 3 — go live

1. **Placement ID — done.** `R-M-20139559-4` is set in
   [`src/services/yandexAdsService.ts`](../src/services/yandexAdsService.ts).
   Setting it back to `''` is the kill switch: release builds then make no
   Yandex request at all and the list shows no banner.

2. **app-ads.txt.** The app's page in the partner interface shows a warning,
   *"The app-ads.txt file is outdated. Update it on the site view2earn.org"*,
   followed by the exact lines it wants. Paste those verbatim into
   [`apps/website/public/app-ads.txt`](../apps/website/public/app-ads.txt)
   after the Unity block, keeping the Google and Unity sections as they are,
   then:

   ```
   cd D:\user\v2e\View2Earn\apps\website
   npm run deploy
   ```

   Verify `https://view2earn.org/app-ads.txt` serves it as plain text with no
   redirect. Yandex re-crawls every 24 hours, so the warning persists for up to
   a day after a correct deploy — don't chase it. If it still lists missing
   lines after that, it lists only the ones still missing, so append those.

   The `DIRECT` lines in Yandex's block (`yandex.com, 332041653`,
   `ozon.ru, 13867164`, `ads.vk.com`, `buzzoola.com`, the `google.com` pub IDs)
   are **Yandex's own seats**, not ours. They belong there. Do not delete them
   thinking they are foreign accounts — re-copy the whole block on updates
   rather than editing individual lines.

3. **Play Console → Data safety.** A new ads SDK that collects the advertising
   ID is a disclosure change. Under *Data types*, Device or other IDs must stay
   declared as collected, shared, and used for Advertising or marketing. Submit
   the updated form with the release.

4. **Release build.** Expect roughly 2–3 MB of extra APK size.

---

## Compliance — enforced in code

Verified against the codebase, not assumed:

- **No AdMob ad is ever on screen beside the Yandex banner.** There are no
  AdMob banners anywhere in the app, and `showInterstitial()` is called only
  from Academy, LiveStreams, Quiz, Spin and Tasks — never from a voice screen.
  Adjacent ads from two networks is the rule publishers usually break.
- **One banner per viewport.** Every 6 rows, never after the last item.
- **The demo placement cannot reach production.** It is `__DEV__`-only, the
  same discipline as `ADMOB_TEST_AD_UNIT`.
- **One consent form, both networks.** Yandex receives the decision from
  Google's UMP form via `MobileAds.setUserConsent()`. If `canRequestAds()` is
  false, no Yandex request is made at all — not even a non-personalized one.
  The init promise is cached so a banner mounting during startup cannot read
  the consent flag before it is set.
- **A no-fill renders zero height**, so outside RU/CIS the list looks exactly
  as it does today rather than showing gaps.
- AdMob rewarded ads and the SSV flow are untouched.

## Expectations

Yandex demand is concentrated in RU/CIS and Turkey. If View2Earn's users are
elsewhere, nearly every request will no-fill and revenue will be close to zero.
That is not a misconfiguration. Decide after Phase 1 whether Phase 2 is worth
the account and compliance work, or whether an AdMob banner in the same slot
is the better use of the placement.

## Removing it

```
npm uninstall yandex-mobile-ads
```

Then delete `yandexAdsService.ts` and `YandexBannerRow.tsx`, drop the
`initializeYandexAds()` call in `App.tsx`, and in `VoiceNoteList.tsx` change
`data={rows}` back to `data={visible}` with `keyExtractor={(n) => n._id}` and
remove the `isAdRow` branch in `renderItem`. `adRows.ts` and its test can stay
— they are ad-network agnostic.

## Sources

- [RN plugin quick start](https://boost.yandex.com/doc/en/ad-monetization/dev/react-native/quick-start)
- [Adaptive inline banner](https://boost.yandex.com/doc/en/ad-monetization/dev/react-native/adaptive-inline-banner)
- [GDPR consent](https://boost.yandex.com/doc/en/ad-monetization/dev/react-native/gdpr)
- [app-ads.txt for apps](https://boost.yandex.com/doc/en/ad-monetization/monetization/app/ads-txt)
- [Joining the ad network](https://www.yandex.com/support/partner/en/joining/)
- [Payments to non-residents](https://www.yandex.com/support/partner/en/payments/with-other-individuals)

---

## Play Console — Data safety declaration

Fill this in **before** shipping a release that contains the Yandex SDK:
Play Console → the app → **App content → Data safety**.

### What this app actually sends to Yandex

Facts to answer the form from, all verifiable in the code:

- `YandexBannerRow` sends **only** `{ adUnitId }`. No `targeting` block, so no
  age, gender, `contextQuery`, `contextTags` or `Location` ever leaves the app.
- `initializeYandexAds()` calls `MobileAds.setLocationConsent(false)`.
- `MobileAds.setUserConsent()` receives the decision from Google's UMP form; if
  the user refused, no Yandex ad is requested at all.
- The SDK itself adds `com.google.android.gms.permission.AD_ID` (it has done so
  since 4.5.0). AdMob already required it, so the app's permission set does not
  change.

### Rows to declare

Yandex states that everything its SDK collects is **optional** (the user can opt
out of personalized ads), that it is **encrypted in transit** over HTTPS/TLS,
and that it supports **deletion requests**. Answer accordingly:

| Data type | Collected | Shared | Purposes | Optional |
|---|---|---|---|---|
| Device or other IDs (advertising ID) | Yes | Yes | Advertising or marketing, Fraud prevention | Yes |
| Location → Approximate location (IP-derived) | Yes | Yes | Advertising or marketing | Yes |
| App activity → App interactions | Yes | Yes | Advertising or marketing, Analytics | Yes |
| App info and performance → Diagnostics | Yes | Yes | Analytics, Fraud prevention | Yes |

Security section: **encrypted in transit = yes**, **users can request deletion
= yes**.

### Most likely, nothing changes

Those four rows are the same ones AdMob and Unity already require, so if the
form is already filled in for them, the practices are unchanged and the
declaration stays as it is. Google's form asks about **data practices, not
SDKs** — there is no SDK list to update.

Open the form and confirm each of the four rows is already ticked as *collected
and shared* with those purposes. Two to watch:

- **Approximate location.** Some developers leave it off when no location
  permission is requested, but ad SDKs derive coarse location from the IP
  address, and Google counts that. If it is currently unticked, tick it.
- **Fraud prevention** as a purpose on Device IDs — easy to miss when only
  "Advertising or marketing" was selected.

Declaring a row the app does not collect is also a violation, so do not add
anything beyond these four on Yandex's account. In particular leave **Personal
info** (name, email, gender, age) off: this integration sends none of it.

Sources: [Yandex — Data safety in Google Play](https://boost.yandex.com/doc/en/ad-monetization/dev/android/app-privacy-android)
· [AdMob — Google Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
· [Play Console — User data](https://support.google.com/googleplay/android-developer/answer/10144311)
