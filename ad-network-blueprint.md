# Ad Network Blueprint — Full Requirements, Architecture & Roadmap

**Owner:** Muhammad Rabiu Musa (Rabiukano)
**Purpose:** A complete reference for building a **Sharia-compliant (halal) ad network** with its own SDK. The network supports every major ad format and can plug into AdMob mediation and other mediation platforms, first in waterfall mode and later as a bidding partner.

> **Sharia principle for the whole document:** Haram ad categories are never accepted, from any advertiser or DSP, on any app. Every money flow follows a defined Islamic contract with no riba, gharar or hidden fees. Full details are in [Section 24](#24-sharia-compliance).

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [Mediation Integration — AdMob, MAX, LevelPlay & Others](#2-mediation-integration)
3. [Must-Have Component 1 — Ad SDK](#3-ad-sdk)
4. [Must-Have Component 2 — Ad Server / Decision Engine](#4-ad-server--decision-engine)
5. [Must-Have Component 3 — Auction & OpenRTB Exchange](#5-auction--openrtb-exchange)
6. [Must-Have Component 4 — Advertiser Dashboard](#6-advertiser-dashboard)
7. [Must-Have Component 5 — Publisher Dashboard](#7-publisher-dashboard)
8. [Must-Have Component 6 — Creative Review & Ad Policy](#8-creative-review--ad-policy)
9. [Must-Have Component 7 — Event Pipeline & Analytics](#9-event-pipeline--analytics)
10. [Must-Have Component 8 — Fraud / Invalid Traffic (IVT) Protection](#10-fraud--ivt-protection)
11. [Must-Have Component 9 — Rewarded Ads Server-Side Verification (SSV)](#11-rewarded-ads-ssv)
12. [Must-Have Component 10 — Billing & Payouts](#12-billing--payouts)
13. [Must-Have Component 11 — Privacy & Legal Compliance](#13-privacy--legal-compliance)
14. [Must-Have Component 12 — Industry Trust Standards](#14-industry-trust-standards)
15. [Must-Have Component 13 — iOS Attribution](#15-ios-attribution)
16. [Optional / Advanced Features](#16-optional--advanced-features)
17. [Tech Stack](#17-tech-stack)
18. [Core Data Model](#18-core-data-model)
19. [Key APIs](#19-key-apis)
20. [Infrastructure, Security & Operations](#20-infrastructure-security--operations)
21. [Testing Strategy](#21-testing-strategy)
22. [Roadmap & Build Order](#22-roadmap--build-order)
23. [Master Checklist](#23-master-checklist)
24. [Sharia Compliance](#24-sharia-compliance)

---

## 1. Big Picture

An ad network has three parties and several systems connecting them.

| Party | What they want | What you give them |
|---|---|---|
| **Advertisers** | Real people seeing and clicking their ads, measurable results | Self-serve campaigns, targeting, fraud protection, reports |
| **Publishers** (app owners) | Highest revenue per impression, no crashes, policy-safe ads | SDK, mediation adapters, payouts, reports |
| **Users** | Fast apps, relevant ads, privacy | Lightweight SDK, consent handling, safe creatives |

### How one ad request flows

```
User opens app
  → Publisher app calls your SDK (or the mediation SDK calls your adapter)
    → SDK sends ad request (device, app, placement, consent signals) to Ad Server
      → Ad Server: fraud pre-check → find eligible campaigns → run auction → pick winner
        → (optional) ask external DSPs via OpenRTB and include their bids
      ← Ad response (creative + tracking URLs + price)
    ← SDK caches creative, renders ad when app calls show()
  → SDK fires impression / viewability / click / video-quartile events
    → Event Pipeline → dedup → fraud scoring → billing → reports
  → (Rewarded) Ad Server sends signed SSV callback to publisher's server → user gets reward
```

### Two ways your network makes money

1. **Direct demand.** Advertisers pay you directly through your dashboard.
2. **Programmatic demand.** External DSPs bid on your inventory through OpenRTB.

You keep a **take rate** (commonly 20–40%) and pay the rest to publishers.

**Sharia note:** Your relationship with publishers is **wakalah bil-ujrah** (agency for a fee). The take rate must be **written in the publisher terms and shown in the dashboard**, with no hidden margins. Direct demand only comes from halal advertisers, and programmatic demand is filtered to halal categories (Section 24).

---

## 2. Mediation Integration

This is the most important strategic section, because it decides how you get traffic.

### 2.1 The two levels of integration

| Level | How it works | Who can do it | Your revenue position |
|---|---|---|---|
| **Waterfall (custom event / custom adapter)** | Publisher adds your network manually with a fixed eCPM. Mediation calls you in order of eCPM. | **Anyone**, starting today | Lower. You are called only when your fixed price beats the others. |
| **Bidding (in-app header bidding)** | Your network bids in real time in the same auction as AdMob, Meta and the rest. | **Only approved partners** of each mediation platform | Highest. You compete on every impression. |

### 2.2 Google AdMob mediation

**Step 1 — Custom Events (available now)**

- **Android:** Build an adapter class that extends `com.google.android.gms.ads.mediation.Adapter`. Implement:
  - `initialize()`, `getVersionInfo()`, `getSDKVersionInfo()`
  - `loadBannerAd()`, `loadInterstitialAd()`, `loadRewardedAd()`, `loadNativeAd()`, `loadAppOpenAd()`; also `loadRewardedInterstitialAd()` if supported in the current SDK version.
  - Forward all callbacks back to Google: loaded, failed, shown, clicked, impression, dismissed, reward earned.
- **iOS:** Implement the `GADMediationAdapter` protocol and the matching per-format ad classes (`GADMediationBannerAd`, `GADMediationInterstitialAd`, `GADMediationRewardedAd`, and so on).
- **Publisher setup:** In the AdMob UI, the publisher creates a mediation group, adds a **Custom Event** with your adapter's class name, and sets a parameter string (for example your app ID and placement ID as JSON) plus a manual eCPM.
- **Distribution:** Publish the adapter to Maven Central (Android) and CocoaPods / Swift Package Manager (iOS). Publish integration docs as well.

**Step 2 — Become a Google bidding partner (later)**

- Bidding inside AdMob is **only available to networks Google approves**. You must apply, and Google evaluates scale, demand quality, fraud controls, policy compliance and technical readiness.
- Prepare these before you apply:
  - Meaningful daily impression volume and real advertiser demand
  - OpenRTB 2.6 support
  - OM SDK certification (see Section 14)
  - app-ads.txt and sellers.json
  - Strong IVT filtering, with documentation
  - Uptime and latency SLAs
- **Technical prep now:** Build your SDK with a **`getBidToken()` / signal-collection function**. It returns an encrypted blob of device and app signals that a mediation SDK can send to your bidder. Then switching to bidding later becomes configuration work, not a rewrite.

### 2.3 AppLovin MAX

- **Waterfall:** MAX supports custom SDK networks. Build an adapter implementing `MaxAdapter` plus the format interfaces (`MaxInterstitialAdapter`, `MaxRewardedAdapter`, `MaxAdViewAdapter`, `MaxNativeAdAdapter`).
- **Bidding:** Generally requires an official partnership with AppLovin.

### 2.4 Unity LevelPlay (ironSource)

- **Waterfall:** Use custom adapters / custom networks through the LevelPlay custom adapter API.
- **Bidding:** Requires a partnership.

### 2.5 Other mediations to consider

- Meta Audience Network does not accept third-party networks, so skip it.
- Consider **Prebid Mobile** (open-source header bidding). A Prebid adapter lets any publisher using Prebid Server call your bidder. It is one of the easiest real-bidding entry points, because no closed partnership is required.
- Consider DT FairBid, Chartboost Mediation, Appodeal, and Yandex mediation.

### 2.6 Adapter rules that apply on all platforms

- **Never crash the host app.** Wrap every call in try/catch and fail with a proper error code.
- **Map errors correctly:** no fill, network error, timeout, invalid request, internal error.
- **Report "no fill" quickly.** If the mediation timeout is around 5 s, your SDK should give up well before that.
- **Fire impression only once,** when the ad is actually shown, never on load.
- **Report the reward amount and type exactly** as configured.
- **Version adapters** as `<your SDK version>.<adapter patch>`, for example `1.4.0.0`.
- **Keep a compatibility matrix:** your SDK version against each mediation SDK version.

---

## 3. Ad SDK

### 3.1 Platforms
- **Must:** native Android (Kotlin, minSdk 21+) and native iOS (Swift, with Objective-C compatibility for older apps).
- **Wrappers:**
  - React Native (bridge / TurboModule)
  - Flutter (plugin)
  - Unity (plugin, very important for games)
- **Optional:** a Web/H5 SDK for mobile web and PWA.

### 3.2 Ad formats

| Format | Must / Optional | Notes |
|---|---|---|
| **Banner** (320×50, 300×250 MREC, adaptive) | Must | Auto-refresh (30–120 s, configurable). Pause refresh when off-screen. |
| **Interstitial** (static + video) | Must | Full-screen. Close button delay rules. |
| **Rewarded video** | Must | Reward callback plus SSV. Non-skippable until complete. |
| **Rewarded interstitial** | Must | Rewarded with an intro screen, no opt-in button needed. |
| **App open** | Must | Shown on cold or warm start. Strict frequency control. |
| **Native** | Must (phase 2) | Return assets (title, icon, image, CTA, body, rating). The publisher renders them. Requires an AdChoices / privacy icon. |
| **Playable (HTML5 / MRAID)** | Optional | Popular for game advertisers. |
| **Offerwall** | Optional | Users complete tasks for rewards. |
| **In-stream video** (pre-roll, mid-roll) | Optional | Uses VAST/VMAP. |

### 3.3 Rendering standards
- **VAST 4.x** video player: linear video, companion ads, tracking events (start, firstQuartile, midpoint, thirdQuartile, complete, skip, mute, pause, click), error codes, wrapper chains (limit the depth to about 5).
- **MRAID 3.0** for rich media and playables: `mraid.js` injection, expand/resize/close, viewability state, `audioVolumeChange`.
- Static image and HTML creatives in a sandboxed WebView with JavaScript bridge restrictions.

### 3.4 SDK core functions
- **Initialization:** `init(appId, config, callback)`. Fetch remote config: placements, refresh rates, frequency caps, kill switches.
- **Load / show split:** `load()` fetches and caches; `show()` displays. Expose `isReady()`.
- **Caching:** Pre-cache video to disk. Expire creatives (TTL around 1 hour). Clear cache on low storage.
- **Request building:** device model, OS version, language, connection type, carrier (optional), screen size, app bundle and version, placement ID, consent strings, limit-ad-tracking flag, advertising ID (GAID/IDFA) only when allowed.
- **Tracking:** impression (count on render plus 1 px visible), viewable impression (MRC rule: 50% of pixels for 1 s on display, 2 s on video), click, video quartiles, close, and reward.
- **Event batching and retry:** Queue events offline and retry with exponential backoff. Give each event a unique ID for deduplication.
- **Frequency capping:** client side, plus server side as the source of truth.
- **Test mode:** test device IDs and test ad units that always fill with labelled test creatives.
- **Debug / integration inspector:** an in-app screen showing SDK status, consent state, last requests and errors.
- **Bid token:** `getBidToken()` for future bidding (see Section 2.2).
- **Lifecycle safety:** handle activity/view-controller destruction, rotation and backgrounding. Prevent memory leaks.
- **Kill switch:** Remote config can disable the SDK or a format instantly if a bug ships.

### 3.5 SDK quality targets
- Android AAR under about 1–2 MB. Minimal dependencies, and none that conflict with Google Play Services.
- No work on the main thread except rendering.
- Crash rate effectively zero. Use your own crash reporting (send SDK stack traces only).
- Cold init in under 100 ms of main-thread time.
- Respect Android 13+ and iOS 17+ privacy rules. Provide an iOS **privacy manifest** (`PrivacyInfo.xcprivacy`) with required-reason API declarations.
- Thorough public documentation: integration guide per platform, sample apps, changelog, migration notes.

---

## 4. Ad Server / Decision Engine

### 4.1 Responsibilities
1. Receive the ad request from the SDK or adapter.
2. Validate it: known app, active placement, correct format, not blocked.
3. Run a pre-bid fraud check (Section 10).
4. Select eligible campaigns using targeting, budget, schedule, frequency caps and the publisher's block lists.
5. Collect external bids via OpenRTB (Section 5).
6. Run the auction and apply price floors.
7. Build the response: creative markup, tracking URLs, price (encrypted when needed) and TTL.

### 4.2 Targeting options

| Targeting | Must / Optional |
|---|---|
| Country / state / city (from IP geolocation) | Must |
| OS and OS version | Must |
| Device type (phone / tablet) | Must |
| Language | Must |
| App category / specific apps (allow / block lists) | Must |
| Connection type (Wi-Fi / cellular), carrier | Optional |
| Time of day / day of week (dayparting) | Optional |
| Audience segments (installs, past clicks) | Optional, privacy-sensitive |
| Contextual keywords | Optional |

### 4.3 Campaign controls
- Daily and total budgets.
- **Pacing:** even or accelerated delivery. Even pacing uses token-bucket budget spending.
- **Frequency caps** per user per day or hour.
- Schedule (start/end dates).
- **Bid strategy:**
  - CPM (pay per 1,000 impressions)
  - CPC (pay per click)
  - CPV (pay per completed view)
  - CPI / CPA (pay per install or action; requires MMP postbacks)
- Creative rotation: even, or weighted by performance.

### 4.4 Price floors
- Floors per placement, set by the publisher, plus a network-level minimum.
- Optional dynamic floors (ML) later.

### 4.5 Performance targets
- Ad request response at **p99 under 100 ms** server-side, excluding external DSP time.
- Handle bursts. Plan for 10× average QPS.
- Budget checks must stay accurate under concurrency. Use Redis atomic counters and reconcile periodically.

---

## 5. Auction & OpenRTB Exchange

### 5.1 Auction type
- **First-price auction** is the industry standard now. The winner pays its bid.
- Compare direct campaigns, normalized to an effective CPM (eCPM = CPC × predicted CTR × 1000, and so on), with external DSP bids.

### 5.2 OpenRTB 2.6 (supply side: you sell to DSPs)
- Send `BidRequest` objects with `imp` (banner / video / native), `app`, `device`, `user`, `regs` (GDPR, COPPA, GPP), `source.schain`.
- Set a timeout per DSP (`tmax`, for example 150–300 ms) and drop late bids.
- Handle `BidResponse`: `seatbid`, `bid.price`, `adm` (markup), `nurl` / `burl` / `lurl` (win, billing and loss notices).
- Use **QPS throttling per DSP** and traffic shaping so you only send the traffic each DSP wants.
- Log every bid and win for reconciliation and disputes.
- **Sharia filter (Must):** Always send `bcat` (blocked IAB categories from the haram list) and `badv` (blocked advertiser domains) in every bid request. **Re-check every winning DSP creative** (category, landing domain, image/text scan) before serving, because DSPs don't always respect block lists. Reject and log non-compliant bids, and drop DSPs that repeatedly violate.
- **No fake bids (najsh).** Never insert artificial bids to push prices up.

### 5.3 Demand side (optional: you buy from other exchanges)
- Later you can make your bidder act as a DSP buying from other exchanges for your advertisers. This is advanced and best kept for phase 4+.

### 5.4 Bidding endpoint for mediations (phase 5)
- Endpoint that receives the mediation's auction request and your **bid token**. It returns a bid price and an ad ID within the mediation's timeout.
- The SDK then loads the winning ad by ID.

---

## 6. Advertiser Dashboard

**Must:**
- Sign up and login, organization accounts, and team members with roles (admin, manager, viewer).
- KYC/KYB for businesses, plus email/phone verification.
- Campaign wizard: objective → format → targeting → budget and bid → creatives → review → launch.
- Creative upload with automatic validation (size, duration, file type, max file size) and preview on device mockups.
- Wallet / prepaid balance with top-up (card, bank transfer, local gateways such as Paystack or Flutterwave, optional crypto).
- Reports: impressions, viewable impressions, clicks, CTR, video completion rate, spend, eCPM, eCPC and conversions. Filter by date, campaign, creative, country and app.
- CSV export.
- Invoices and receipts.
- Notifications: low balance, campaign approved or rejected, budget reached.

**Optional:**
- Reporting API, so advertisers can pull data automatically.
- Conversion tracking via MMP postbacks (AppsFlyer, Adjust, Branch, Kochava) or your own pixel / S2S postback.
- A/B testing of creatives.
- Audience builder and lookalikes.
- Agency accounts managing many advertisers.
- Multi-language UI (English, Hausa, Arabic, French).

---

## 7. Publisher Dashboard

**Must:**
- Sign up, KYC (needed for payouts), and team roles.
- App registration: platform, bundle ID or package name, and store URL with verification by app-ads.txt or store lookup.
- Ad unit / placement creation: format, refresh rate, floor price, reward name and amount (for rewarded), SSV callback URL and secret.
- Block controls: extra advertiser categories beyond the network-wide haram ban, specific advertisers or domains, and creative types.
- **Halal publisher vetting:** Every app is reviewed before activation. Gambling-style, adult, riba-lending and other haram apps are rejected, because serving ads (especially rewarded ads) inside them supports their activity.
- Child-directed (COPPA) setting per app.
- Revenue reports: requests, fills, fill rate, impressions, eCPM, revenue, by app / unit / country / day.
- Payouts: balance, payout history, payout method (bank, PayPal-type, mobile money, optional crypto) and a minimum threshold.
- **app-ads.txt generator:** shows the exact line the publisher must add to their developer website.
- Integration docs, SDK downloads and adapter downloads.

**Optional:**
- Reporting API.
- Mediation reporting (if you build your own mediation).
- In-dashboard SDK health: crash and error rates per app version.
- Referral program for publishers.

---

## 8. Creative Review & Ad Policy

**Must:**
- **A written Halal Ad Policy** for advertisers and a **Publisher Policy**, approved by the Sharia advisor. Prohibited content includes every haram category in Section 24.2 (no country exceptions), misleading claims (ghish/tadlis), weapons, counterfeit goods and malware.
- **Halal status on every creative:** `approved` / `rejected` / `needs_sharia_review` (for disputed areas such as music, imagery and crypto; see Section 24.3).
- **Automated checks:**
  - File type, size and dimensions
  - Video codec and length
  - Landing URL reachability
  - **Malware / phishing scan** of landing pages (for example the Google Safe Browsing API)
  - Redirect-chain depth limits
  - Auto-redirect detection inside HTML creatives
- **Manual review queue** for every new creative, with approve / reject and a reason code.
- **Ad categories** (IAB Content Taxonomy) assigned to each creative, so publishers' block lists work.
- **Re-review** on any creative or landing URL change.
- **User report button** ("Report this ad") in the SDK, feeding the review queue.

**Optional:**
- AI image and text moderation to pre-screen before human review.
- Periodic landing-page re-scans.
- **ARCON vetting workflow** for Nigeria. Under ARCON rules, many ad categories shown to Nigerian audiences need vetting approval. Collect the advertiser's approval number where required.

---

## 9. Event Pipeline & Analytics

### 9.1 Event types
`request`, `response` (fill / no-fill), `impression`, `viewable_impression`, `click`, `video_start`, `video_q1`, `video_mid`, `video_q3`, `video_complete`, `skip`, `close`, `reward`, `ssv_sent`, `ssv_ack`, `install` / `conversion` (from MMP), `error`.

### 9.2 Pipeline
```
SDK → Event Collector (stateless HTTP, Go/Rust) → Kafka / Redpanda
   → Stream processor: dedup by event_id → enrich (geo, app, campaign) → fraud scoring
   → ClickHouse (raw + aggregated tables) → Reports API → dashboards
   → Billing aggregator (only valid, deduped events) → ledger
```

### 9.3 Must-haves
- **Deduplication** by `event_id` and impression ID.
- **Idempotent billing.** A replayed event must never charge twice.
- **Raw log retention** for disputes (90 days or more), with aggregates kept longer.
- **Near-real-time reports** (delay under 5 minutes) and **final reports** once fraud filtering is done (for example T+1 day).
- Timezone handling: store UTC, display in the user's timezone.

---

## 10. Fraud / IVT Protection

This is the main thing that makes advertisers trust you. Follow the MRC distinction:
- **GIVT** (general invalid traffic): known bots, data centers, crawlers.
- **SIVT** (sophisticated invalid traffic): emulators, click farms, SDK spoofing, ad stacking.

### 10.1 Must
- **Device / app attestation:**
  - Android: **Play Integrity API** (verifies a genuine app from Play on a genuine device).
  - iOS: **App Attest** (DeviceCheck).
  - Verify tokens server-side and score requests without valid attestation as higher risk.
- **Request signing:** The SDK signs requests with a per-install key. The server rejects tampered or replayed requests using timestamps plus nonces.
- **IP intelligence:** data-center, VPN, proxy and Tor lists. IP vs. device timezone and language mismatch.
- **Emulator / rooted / jailbroken detection signals.**
- **Click fraud:**
  - Clicks with no impression
  - Impossible time-to-click
  - Click flooding from one device
  - **Click injection** (Android install referrer timing checks for CPI)
- **Impression fraud:**
  - Hidden ads (0×0, off-screen, stacked)
  - Impressions while the app is in the background
  - Excessive refresh
  - Viewability enforcement
- **Rate limits** per device, IP, app and placement.
- **Publisher quality scoring.** Automatically hold or suspend apps with abnormal CTR, conversion rates or traffic spikes.
- **Payout holds.** Hold publisher revenue (for example 30–60 days) so you can claw back fraud before paying.
- **Refund invalid traffic** to advertisers and show IVT-removed counts transparently.

### 10.2 Optional
- ML fraud model (gradient boosting on behavioral features).
- Third-party verification partners (IAS, DoubleVerify, HUMAN) for credibility with big advertisers.
- **TAG (Trustworthy Accountability Group)** certification.

---

## 11. Rewarded Ads SSV

Server-side verification proves to the publisher that a reward is genuine, so users cannot fake rewards.

**Flow:**
1. The publisher configures the SSV callback URL and gets a verification key in the dashboard.
2. The SDK's rewarded `show()` optionally accepts `userId` and `customData` from the publisher.
3. When the video completes, the SDK reports completion to your server, and your server validates it (attestation, timing, dedup).
4. **Your server** (not the device) calls the publisher's URL:
   ```
   GET https://publisher.com/reward?ad_network=yours&ad_unit=XXX
       &reward_amount=10&reward_item=coins&timestamp=1730000000000
       &transaction_id=UNIQUE&user_id=U123&custom_data=...
       &key_id=1&signature=BASE64URL
   ```
5. **Signature:** ECDSA (P-256 with SHA-256) over the query string, excluding the signature. Publish public keys at a JSON endpoint and support key rotation via `key_id`. This is the same pattern AdMob uses, so it is familiar to developers. HMAC-SHA256 with a per-publisher secret is a simpler alternative.
6. The publisher verifies the signature, checks that `transaction_id` is unused, then grants the reward.
7. Retry on non-2xx with backoff, and log every attempt in the dashboard.

**Must:** unique transaction IDs, timestamps, replay protection, retries, a logs view, and a test-callback button in the dashboard.

**Sharia rule (ju'alah):** The reward for watching an ad must be **fixed and known before the user starts** (for example "Watch to earn 10 coins"). The dashboard must not allow random or "spin-the-wheel" rewards tied to ads (gharar). Rewarded ads are never served inside gambling-style or haram apps.

---

## 12. Billing & Payouts

**Must:**
- **Double-entry ledger.** Every money movement is a debit and a credit. Never update balances directly.
- **Contract basis (Sharia):**
  - CPM is **ijarah** (renting ad space).
  - CPC, CPV and CPI are **ju'alah** (payment on a defined result).
  - The publisher relationship is **wakalah bil-ujrah** with a disclosed fee.
  - Each pricing model's billable event must be precisely defined in the terms, so there is no gharar (see Section 24.4).
- **Advertiser side:**
  - Prepaid wallet; spend is deducted from valid billable events.
  - Stop campaigns at zero balance (with a small overspend tolerance; the overspend is absorbed by the network, never charged with interest).
  - The wallet is held as **amanah / qard**: no interest paid or charged, no hidden fees, and unused balances refundable under a clear written policy.
  - Invoices.
- **Publisher side:**
  - Earnings = revenue × revenue share.
  - Monthly payout cycle (for example net-30 or net-45), minimum threshold, and IVT clawback before payout. Holds and clawbacks are allowed because they are **written conditions (shart) agreed in advance**.
- **Currencies:** keep accounts in USD internally and display or settle in NGN and others. Record the FX rate used. Every conversion must be a **spot exchange (sarf)**, with no forward or deferred FX contracts.
- **Banking:** operate through a **non-interest bank** (in Nigeria: Jaiz Bank, TAJBank, Lotus Bank). Never place float or wallet money in interest-bearing accounts. Any interest received by accident goes to a **purification (charity) account**, never to revenue.
- **Late payments:** no interest or penalty income. If a late-payment penalty is used as a deterrent, it must be agreed in advance and **paid entirely to charity** (AAOIFI approach).
- **Payment providers:**
  - Paystack or Flutterwave for Nigeria and Africa.
  - Stripe or similar for international advertisers where available.
  - Payout via bank transfer or mobile money.
- **Tax:** collect tax info (TIN for Nigeria; W-8/W-9-style forms for international), and apply VAT/WHT rules per jurisdiction. Get local accounting advice.
- **Reconciliation jobs** comparing the ledger, the event pipeline and DSP billing notices.

**Optional:**
- Crypto top-ups and payouts (stablecoins, or Pi / Sidra tokens) with a clear conversion policy. **Requires a specific fatwa from your Sharia advisor first**, plus a legal and regulatory check.
- Credit lines for trusted large advertisers (post-paid), as **interest-free deferred payment** only.

---

## 13. Privacy & Legal Compliance

| Area | What to implement | Must / Optional |
|---|---|---|
| **GDPR / EEA & UK** | Read **IAB TCF 2.2** consent string (`IABTCF_*` keys in SharedPreferences / NSUserDefaults). Register as a **TCF vendor** with IAB Europe if you serve EEA traffic. | Must if serving EEA/UK |
| **US state privacy laws** | Read the **IAB GPP** string and honor opt-outs (CCPA/CPRA and others). | Must if serving the US |
| **Nigeria — NDPA 2023** | Privacy policy, lawful basis, data-subject rights, data-protection registration and audits with the NDPC as required. | Must (you are Nigeria-based) |
| **COPPA / children** | Child-directed flag per app and per request. No personal data, no behavioral ads, and only family-safe creatives for kids. | Must |
| **Google Play Families** | Join the **Families Self-Certified Ads SDK Program** if you want kids' apps on Play to use you. | Optional, valuable |
| **iOS ATT** | Use IDFA only when the user granted tracking. Otherwise work contextually or via SKAN. | Must |
| **iOS privacy manifest** | `PrivacyInfo.xcprivacy` declaring collected data and required-reason APIs. Register your tracking domains. | Must |
| **Google Play Data safety** | Document exactly what your SDK collects, so publishers can fill in their forms. | Must |
| **Android Advertising ID** | Respect "delete advertising ID" / limit ad tracking, and the `AD_ID` permission rules. | Must |
| **Android Privacy Sandbox** | Monitor its status; Google has scaled back parts of Privacy Sandbox, so verify before investing. | Optional, watch |
| **Data retention & deletion** | Retention schedule, user deletion requests, encrypted storage. | Must |
| **Legal documents** | Terms for advertisers, terms for publishers, privacy policy, ad policy, DPA (data processing agreement). | Must |

> Have a lawyer review the legal documents and cross-border data transfers. This blueprint is technical guidance, not legal advice.

---

## 14. Industry Trust Standards

| Standard | Purpose | Must / Optional |
|---|---|---|
| **app-ads.txt** | Publishers list authorized sellers on their developer website. DSPs and mediations check it. | Must |
| **sellers.json** | You publish all your publishers (seller IDs) at `yourdomain.com/sellers.json`. | Must |
| **SupplyChain object (schain)** | In every OpenRTB request, shows the path of the inventory. | Must |
| **OM SDK (Open Measurement)** | Integrate IAB's OM SDK so third-party verifiers can measure viewability. Requires **IAB Tech Lab compliance certification**. | Must for bidding partnerships |
| **IAB Content Taxonomy / Ad Product Taxonomy** | Standard categories for apps and ads. | Must |
| **MRC viewability guidelines** | Define viewable impressions the standard way. | Must |
| **TAG certification** | Anti-fraud trust badge. | Optional |
| **MRC accreditation** | Formal audit of measurement. Expensive; for later. | Optional |

---

## 15. iOS Attribution

- **SKAdNetwork 4.x / AdAttributionKit:** Register your **ad network ID** with Apple. Publishers then add your ID to their `Info.plist` (`SKAdNetworkItems`).
- Sign ad impressions (StoreKit-rendered and view-through) with your registered private key.
- Receive postbacks at your registered endpoint and attribute installs to campaigns.
- Support conversion values and coarse values for CPI/CPA advertisers.
- Must for any iOS install campaigns.

---

## 16. Optional / Advanced Features

| Feature | Value | Phase |
|---|---|---|
| **Your own mediation layer** | Publishers use your SDK to mediate AdMob, Meta, Unity and others. This gives you control of the auction. | 4–5 |
| **Prebid Mobile / Prebid Server adapter** | Real header bidding without closed partnerships. | 4 |
| **ML CTR / CVR prediction** | Higher eCPM, better advertiser results. | 4 |
| **Dynamic price floors** | Higher publisher revenue. | 4 |
| **Lookalike audiences** | Better targeting (privacy-safe). | 5 |
| **Playables & offerwall** | Strong for gaming. | 3–4 |
| **In-stream video / CTV** | New inventory types. | 5+ |
| **Crypto payments (Pi / Sidra / stablecoins)** | Fits blockchain ecosystems. Needs a fatwa and a regulation check first. | 3+ |
| **Halal Ad Network certification & branding** | Selling point to Islamic banks, Takaful, halal brands and Middle East / North Africa markets | 3+ |
| **Rewarded engagement for Web3 apps** | Rewards in tokens or points. | 3+ |
| **Brand-safety & suitability tools** | Wins bigger brands. | 4 |
| **Self-serve creative builder** | Advertisers without designers can make ads. | 3 |
| **AI creative generation** | Auto-generate banner variants. | 5 |
| **Public reporting APIs & webhooks** | For agencies and large publishers. | 3 |
| **Multi-language dashboards (EN, HA, AR, FR)** | African and Middle East markets. | 2–3 |

---

## 17. Tech Stack

| Layer | Recommended | Why |
|---|---|---|
| **Android SDK** | Kotlin, Coroutines, OkHttp (or HttpURLConnection to avoid conflicts), ExoPlayer/Media3 for video | Standard and lightweight |
| **iOS SDK** | Swift (Obj-C compatible API), URLSession, AVPlayer, WKWebView | Native, no heavy dependencies |
| **Wrappers** | React Native (TurboModule), Flutter plugin, Unity plugin | Cover most app developers |
| **Ad server / bidder / event collector** | **Go** (or Rust) | High QPS, low latency, cheap to run |
| **Hot data** (budgets, frequency caps, pacing, campaign cache) | **Redis** (cluster) | Atomic counters, sub-millisecond |
| **Event streaming** | **Kafka** or **Redpanda** | Durable, replayable event log |
| **Analytics DB** | **ClickHouse** | Fast aggregations over billions of rows |
| **Main relational DB** (accounts, campaigns, ledger) | **PostgreSQL** | Transactions, strong consistency for money |
| **Dashboards** (advertiser + publisher + admin) | **Next.js** + TypeScript | Your existing skill set |
| **Dashboard backend / business logic** | **Convex** (self-hosted or cloud) *or* a Postgres-backed API | Fine for dashboards, workflows and notifications. **Do not put the ad-serving or bidding hot path on Convex.** Keep the ledger in Postgres. |
| **Creative storage & delivery** | S3-compatible object storage + CDN (Cloudflare / CloudFront / Bunny) | Fast global creative loading |
| **Geo IP** | MaxMind GeoIP2 / IPinfo | Targeting and fraud signals |
| **Monitoring** | Prometheus + Grafana, OpenTelemetry, Sentry | Latency, errors, alerts |
| **Infra** | Docker + Kubernetes (or Nomad), Terraform | Scalable, reproducible |
| **Hosting regions** | Start in one EU region near Africa (for example Frankfurt), add edge endpoints later | Latency to Nigerian and global users |

### Monorepo layout (suggested)
```
ad-network/
├── sdk-android/            # Kotlin SDK + sample app
├── sdk-ios/                # Swift SDK + sample app
├── sdk-react-native/
├── sdk-flutter/
├── sdk-unity/
├── adapters/
│   ├── admob-android/  admob-ios/
│   ├── max-android/    max-ios/
│   └── levelplay-android/ levelplay-ios/
├── services/
│   ├── adserver/           # Go: decisioning + auction
│   ├── bidder-gateway/     # Go: OpenRTB to DSPs, mediation bidding endpoint
│   ├── collector/          # Go: event ingestion
│   ├── stream-processor/   # dedup, enrich, fraud scoring
│   ├── ssv/                # rewarded callbacks
│   ├── billing/            # ledger, invoices, payouts
│   └── fraud/              # rules + ML scoring
├── apps/
│   ├── advertiser-web/     # Next.js
│   ├── publisher-web/      # Next.js
│   └── admin-web/          # Next.js (review queue, fraud console, ops)
├── packages/
│   ├── shared-types/       # TypeScript types, OpenRTB schemas
│   └── ui/
├── infra/                  # Terraform, k8s manifests
└── docs/                   # integration guides, policies
```

---

## 18. Core Data Model

```
Organization (id, type: advertiser|publisher|both, name, kyc_status, country)
User (id, org_id, email, role)

# Publisher side
App (id, org_id, platform, bundle_id, store_url, category, is_child_directed, status, app_ads_txt_verified,
     halal_review_status: pending|approved|rejected, halal_review_notes)
AdUnit (id, app_id, format, floor_cpm, refresh_sec, reward_name, reward_amount, ssv_url, ssv_key_id, status)
BlockRule (id, app_id|org_id, type: category|advertiser|domain, value)

# Advertiser side
Campaign (id, org_id, objective, bid_type: CPM|CPC|CPV|CPI, bid_amount, daily_budget, total_budget,
          pacing, start_at, end_at, status)
Targeting (campaign_id, countries[], os[], os_versions, device_types[], languages[], app_categories[],
           app_allowlist[], app_blocklist[], dayparting)
Creative (id, campaign_id, format, type: image|video|html|native|playable, asset_urls, click_url,
          iab_categories[], review_status, review_notes,
          halal_status: approved|rejected|needs_sharia_review, sharia_ruling_ref)
FrequencyCap (campaign_id, max_impressions, per: hour|day)

# Money
LedgerAccount (id, org_id, type: advertiser_wallet|publisher_earnings|platform_revenue|ivt_holdback|
               charity_purification|zakat_reserve)
LedgerEntry (id, debit_account, credit_account, amount_micros, currency, ref_type, ref_id, created_at)
Payout (id, org_id, amount, method, status, period)
Invoice (id, org_id, amount, period, status)

# Sharia governance
HaramCategory (iab_code, name, status: banned|disputed, ruling_ref)
ShariaRuling (id, topic, question, ruling, scholar, date, applies_to)
DspViolation (id, dsp_id, creative_hash, category, landing_domain, ts, action)

# Events (ClickHouse)
events (event_id, event_type, ts, request_id, imp_id, app_id, ad_unit_id, campaign_id, creative_id,
        device_hash, country, os, price_micros, ivt_flag, ivt_reason)

# SSV
RewardTransaction (transaction_id, ad_unit_id, user_id, custom_data, amount, status, attempts, last_response)
```

> Store money as **integer micros** (1 USD = 1,000,000 micros). Never use floats for money.

---

## 19. Key APIs

| Endpoint | Caller | Purpose |
|---|---|---|
| `POST /v1/init` | SDK | Remote config, placements, kill switches |
| `POST /v1/ad` | SDK / adapter | Ad request → ad response |
| `POST /v1/events` (batched) | SDK | Impression, click, video, reward events |
| `GET /v1/click/{id}` | User's browser | Click tracking redirect → landing page |
| `POST /v1/bid` | Mediation (future) / Prebid | Bid request with bid token → price + ad ID |
| `GET /v1/ssv/keys` | Publishers | Public keys for SSV verification |
| OpenRTB outbound | Your bidder → DSPs | Bid requests to demand partners |
| `POST /v1/postback/mmp` | MMPs | Install / conversion postbacks |
| `POST /v1/skan/postback` | Apple | SKAdNetwork postbacks |
| `/sellers.json`, `/app-ads.txt` checker | Public | Industry transparency |
| Reporting API (`/v1/reports`) | Advertisers / publishers | Programmatic reporting |
| Admin API | Admin web | Reviews, fraud actions, payouts |

All SDK endpoints should use: HTTPS only, request signing, gzip, small JSON or protobuf payloads, and versioned paths.

---

## 20. Infrastructure, Security & Operations

**Security (Must):**
- TLS everywhere, and certificate pinning in the SDK (optional, with a rotation plan).
- Secrets in a vault; rotate keys.
- 2FA for dashboard accounts, mandatory for admins.
- Role-based access control. Keep an audit log of every admin action, including payout changes and creative approvals.
- WAF and DDoS protection in front of public endpoints.
- Encrypt personal data at rest. Hash device IDs where possible.
- Regular penetration testing, plus a public security contact (`security.txt`).

**Reliability (Must):**
- Multi-AZ deployment. Use health checks and autoscaling.
- **Graceful degradation:** if analytics is down, ad serving continues and events queue up.
- Backups for Postgres, with tested restores.
- SLOs, for example ad endpoint availability ≥ 99.9% and p99 latency under 100 ms.
- On-call alerting: latency, error rate, fill-rate drop, spend anomalies, fraud spikes.
- Status page for publishers and advertisers.

**Operations tools (Admin dashboard, Must):**
- Creative review queue.
- Fraud console (flagged apps and devices, suspend or release).
- Payout approval.
- Campaign and app search, manual overrides and global kill switches.
- Support ticket integration.

---

## 21. Testing Strategy

- **SDK:**
  - Unit tests and UI tests on real devices (Firebase Test Lab / BrowserStack).
  - Tests across Android 5–15+ and iOS 13–18+.
  - Low-memory, offline and rotation tests.
- **Adapters:**
  - Test each with official mediation test suites (for example AdMob Ad Inspector) and real mediation groups in test mode.
- **Video / MRAID:**
  - Use IAB VAST validator and MRAID compliance ads.
- **OM SDK:**
  - Pass IAB Tech Lab validation before certification.
- **Load testing:**
  - k6 / Gatling on ad and event endpoints at 10× expected peak.
- **Billing:**
  - Property tests making sure the ledger always balances, and replay tests to prove no double charge.
- **Fraud:**
  - Run emulator and bot simulations to make sure they are caught.
- **SSV:**
  - Signature verification sample code in Node, PHP, Python, Go and Java, plus a test-callback tool.
- **Beta:**
  - Closed beta with 5–20 friendly publishers (for example apps in your Pi / Sidra / Arewa communities) before public launch.

---

## 22. Roadmap & Build Order

Time estimates assume one experienced developer working full-time with heavy AI coding assistance (e.g. Claude Code). Treat them as rough guides; certifications and partner approvals depend on third parties.

### Phase 0 — Foundations (2–3 weeks)
- [ ] Company and legal setup: terms, privacy policy, ad policy, publisher policy (lawyer review)
- [ ] NDPA / NDPC data-protection steps
- [ ] **Appoint Sharia advisor;** approve Halal Ad Policy, haram category list and contract terms
- [ ] Open company accounts with a **non-interest bank**
- [ ] Monorepo, CI/CD, infrastructure-as-code, staging and production environments
- [ ] Domain, `sellers.json` endpoint skeleton, docs site

### Phase 1 — MVP: serve your own ads (6–10 weeks)
- [ ] Android SDK: init, banner, interstitial, rewarded; load/show; caching; event batching; test mode
- [ ] iOS SDK: same formats
- [ ] Ad server (Go): request → targeting (country, OS, device, language) → first-price selection → response
- [ ] Event collector + Kafka + ClickHouse + basic dedup
- [ ] Rewarded SSV (signed callbacks + retries)
- [ ] Basic fraud: attestation, request signing, rate limits, data-center IP blocking
- [ ] Admin: manual campaign creation, creative review queue with halal status
- [ ] Network-wide haram category ban enforced in ad server and creative review
- [ ] Postgres ledger (advertiser wallet, publisher earnings)

### Phase 2 — Self-serve platform (6–8 weeks)
- [ ] Advertiser dashboard: signup, KYC, wallet top-up (Paystack / Flutterwave), campaign wizard, creative upload, reports
- [ ] Publisher dashboard: apps, ad units, block lists, reports, payouts, app-ads.txt generator
- [ ] Privacy: TCF 2.2, GPP, COPPA flags, ATT handling, iOS privacy manifest, Data safety documentation
- [ ] Interstitial video via VAST 4.x, app open, rewarded interstitial
- [ ] React Native wrapper, Flutter plugin and Unity plugin
- [ ] Closed beta with friendly publishers

### Phase 3 — Mediation entry (4–6 weeks)
- [ ] AdMob custom event adapters (Android + iOS), all formats
- [ ] AppLovin MAX custom adapters
- [ ] Unity LevelPlay custom adapters
- [ ] Publish to Maven Central / CocoaPods / SPM with docs
- [ ] `sellers.json` live, schain support, app-ads.txt verification crawler
- [ ] Native ads format + MRAID 3.0 rich media
- [ ] Public launch

### Phase 4 — Growth & trust (8–12 weeks)
- [ ] OM SDK integration + IAB Tech Lab certification
- [ ] OpenRTB 2.6 integration with external DSPs (more demand → higher fill)
- [ ] Prebid Mobile / Prebid Server adapter
- [ ] SKAdNetwork / AdAttributionKit registration + postbacks
- [ ] MMP integrations for CPI/CPA
- [ ] ML CTR prediction, dynamic floors
- [ ] Advanced fraud (ML model, publisher quality scoring)
- [ ] Optional: Google Play Families Self-Certified Ads SDK program

### Phase 5 — Bidding partner status (ongoing)
- [ ] `getBidToken()` + bidding endpoint production-ready
- [ ] Apply to **Google bidding partner** program with traffic and quality evidence
- [ ] Apply to AppLovin MAX and Unity LevelPlay bidding partnerships
- [ ] Optional: TAG certification, third-party verification partners
- [ ] Optional: written **Sharia compliance certificate** and "Halal Ad Network" branding
- [ ] Annual Sharia audit
- [ ] Optional: your own mediation layer, offerwall, playables, crypto payments

**Rough total to public launch (Phases 0–3):** about 4–6 months.
**To bidding readiness (Phase 4):** about 7–9 months, plus partner review time.

---

## 23. Master Checklist

### SDK
- [ ] Android SDK (Kotlin)
- [ ] iOS SDK (Swift)
- [ ] React Native / Flutter / Unity wrappers
- [ ] Banner (incl. adaptive, MREC) with refresh
- [ ] Interstitial (static + video)
- [ ] Rewarded
- [ ] Rewarded interstitial
- [ ] App open
- [ ] Native
- [ ] VAST 4.x player
- [ ] MRAID 3.0
- [ ] OM SDK
- [ ] Caching / TTL
- [ ] Event batching / retry / dedup ID
- [ ] Viewability (MRC)
- [ ] Frequency capping
- [ ] Test mode + debug inspector
- [ ] Bid token
- [ ] Kill switch / remote config
- [ ] Privacy manifest, ATT, consent reading
- [ ] "Report ad" button
- [ ] AdChoices / privacy icon on native

### Mediation
- [ ] AdMob custom event adapters (Android / iOS)
- [ ] MAX custom adapters
- [ ] LevelPlay custom adapters
- [ ] Prebid adapter
- [ ] Bidding endpoint
- [ ] Google bidding partner application
- [ ] Other bidding partner applications

### Server
- [ ] Ad request endpoint (p99 < 100 ms)
- [ ] Targeting
- [ ] Pacing
- [ ] Budgets
- [ ] Frequency caps
- [ ] Floors
- [ ] First-price auction
- [ ] OpenRTB 2.6 to DSPs
- [ ] schain
- [ ] Win / loss / billing notices
- [ ] Click redirect service
- [ ] Event collector → Kafka → ClickHouse
- [ ] SSV service with signatures + retries
- [ ] MMP postbacks
- [ ] SKAN postbacks

### Dashboards
- [ ] Advertiser: campaigns, creatives, wallet, reports, invoices
- [ ] Publisher: apps, units, blocks, reports, payouts, app-ads.txt
- [ ] Admin: review queue, fraud console, payouts, kill switches, audit log

### Trust, fraud & policy
- [ ] Play Integrity / App Attest
- [ ] Request signing
- [ ] IP intelligence
- [ ] IVT rules
- [ ] Payout holds
- [ ] Refunds
- [ ] Ad policy + publisher policy
- [ ] Creative scanning (malware / phishing)
- [ ] IAB categories
- [ ] app-ads.txt
- [ ] sellers.json
- [ ] ARCON vetting workflow (Nigeria)

### Sharia compliance
- [ ] Sharia advisor appointed
- [ ] Halal Ad Policy + haram category list approved
- [ ] Disputed-category register + rulings log
- [ ] Network-wide haram ban in ad server
- [ ] `bcat` / `badv` in every OpenRTB request + post-bid creative re-check
- [ ] Halal status on every creative; halal review on every app
- [ ] Fixed, known rewards only (no random rewards)
- [ ] Take rate disclosed in publisher terms and dashboard
- [ ] Contract terms written as ijarah / ju'alah / wakalah
- [ ] Interest-free wallet + refund policy
- [ ] Non-interest bank
- [ ] Spot-only FX
- [ ] No interest/penalty income; charity purification account
- [ ] Zakat accounting
- [ ] Fatwa obtained before any crypto payments
- [ ] Annual Sharia audit

### Money & legal
- [ ] Double-entry ledger (integer micros)
- [ ] Paystack / Flutterwave / international gateway
- [ ] Payouts
- [ ] Tax info
- [ ] Reconciliation
- [ ] Terms, privacy policy, DPA
- [ ] NDPA compliance
- [ ] GDPR / TCF vendor registration (if EEA)
- [ ] GPP / US
- [ ] COPPA

### Operations
- [ ] Monitoring, alerting, status page
- [ ] Backups + restore tests
- [ ] Load tests
- [ ] Security review / pentest
- [ ] Integration docs + sample apps + SSV sample code

---

## 24. Sharia Compliance

> This section is general guidance, not a fatwa. Every policy here, and especially the disputed areas in 24.3, must be confirmed by your appointed Sharia advisor.

### 24.1 Core principle
A Sharia-compliant ad network must be halal in two places:
1. **What it promotes:** the ads and the apps they appear in.
2. **How money moves:** contracts, wallets, payouts, banking and currency exchange.

Most scholars hold that earning from promoting something haram is itself haram, as cooperation in sin (Al-Ma'idah 5:2). Therefore:
- Haram categories are **banned network-wide**, for every advertiser, DSP and publisher, Muslim or not.
- An optional "halal mode" for some publishers is **not** enough. Income from haram ads served anywhere on the network would be affected.
- Ads served by *other* networks inside a publisher's AdMob/MAX mediation are not yours, so you are not responsible for them.

**Business trade-off:** Gambling, dating and loan apps are among the highest-paying categories. Expect lower eCPM at first, and offset this by positioning as a trusted halal network (24.12).

### 24.2 Banned categories (always rejected)

| Category | Reason |
|---|---|
| Alcohol, wine, beer, bars and nightclubs | Khamr |
| Drugs, cannabis and narcotics | Intoxicants, harm |
| Pork and pork products | Explicitly haram food |
| Gambling, betting, sports betting, lotteries, casino and social-casino games | Maysir |
| Interest-based finance: conventional loans, payday and "quick loan" apps, credit cards, interest-bearing savings promotions | Riba |
| Conventional insurance (most scholars; Takaful is allowed) | Riba / gharar / maysir |
| Forex, binary options, leveraged or margin trading, get-rich-quick and pyramid schemes | Riba, gharar, deception |
| Adult, sexual or nude content, lingerie with models, and suggestive imagery | Haya' and awrah |
| Dating and hookup apps | Promotes zina |
| Fortune telling, astrology, horoscopes, magic, charms and amulets | Shirk / kahanah |
| Content mocking Islam, the Prophets or any religion | Disrespect of the sacred |
| Tobacco and vaping (most contemporary scholars) | Harm |
| Scams, fake medicine, misleading health claims | Ghish / tadlis |
| Apps whose core purpose is any of the above | Supporting haram activity |

**Implementation:**
- Map each row to its **IAB Content Taxonomy / Ad Product Taxonomy codes** and store them in the `HaramCategory` table with status `banned`.
- The ad server rejects any campaign or creative carrying a banned code.
- Creative review checks the image, text, landing page and the app being promoted.
- The same list is sent as `bcat` in every OpenRTB request.

### 24.3 Disputed areas (decided by your Sharia advisor)
These carry status `disputed` in `HaramCategory`. Creatives touching them get `needs_sharia_review`.

| Area | Question for the advisor | Possible policy options |
|---|---|---|
| Music in video ads | Allowed, restricted to instruments like duff, or nasheed/voice only? | Ban music / allow only without instruments / allow with publisher opt-out |
| Images of women | What modesty standard is required? | Hijab and modest dress required / no women in ads |
| Images of animate beings | Are photos and videos allowed? | Most contemporary scholars allow photos; confirm |
| Crypto and token projects | Which, if any, are allowed? | Case-by-case approval / ban speculative tokens |
| Free-mixing entertainment, films and series | Which content is acceptable? | Category allow-list |
| Mainstream fashion and beauty | Where is the line? | Modesty guidelines |
| Games with chance mechanics (loot boxes) | Is the game itself maysir? | Ban paid loot boxes |

Record every decision in the `ShariaRuling` table: topic, ruling, scholar, date, and which categories it affects. The policy stays consistent and auditable.

### 24.4 Contracts behind each money flow

| Flow | Islamic contract | Conditions to meet |
|---|---|---|
| Advertiser pays per 1,000 impressions (CPM) | **Ijarah** (renting ad space / service) | The service (what counts as a valid impression) and the price are clearly defined |
| CPC, CPV, CPI, CPA | **Ju'alah** (reward for a result) | The result is precisely defined (valid click, completed view, verified install); invalid traffic rules are disclosed |
| You place ads on publisher apps | **Wakalah bil-ujrah** (agency for a known fee) | The take rate is **disclosed** in terms and dashboard; no hidden margins |
| User watches a rewarded ad | **Ju'alah** between publisher and user | The reward is **fixed and known before watching**; no random rewards |
| Auction / bidding | **Bay' al-muzayadah** (auction sale) | Permissible; **no fake bids (najsh)** and no manipulation |
| Advertiser prepaid wallet | **Amanah** (trust) or **qard** (interest-free loan to the company) | No interest, no hidden fees, refundable under a clear policy |
| Payout holds and IVT clawbacks | **Shart** (agreed contract condition) | Written and accepted in advance |
| Currency conversion | **Sarf** | Spot exchange only, completed immediately |

Relevant AAOIFI Sharia Standards for the advisor to apply: Ijarah, Ju'alah, Agency (Wakalah), Trading in Currencies (Sarf), and Defaults in Payment by a Debtor (late payment).

### 24.5 Money rules
- **Banking:**
  - Use a **non-interest bank** for company accounts. In Nigeria: Jaiz Bank, TAJBank and Lotus Bank.
  - Never keep float or wallet funds in interest-bearing accounts or money-market funds.
- **No riba anywhere:**
  - No interest on wallet balances, no interest on late payments, and no interest-based credit lines.
  - Post-paid credit for large advertisers is interest-free deferred payment only.
- **Late payments:** Penalties may be used as a deterrent only if agreed in advance, and **100% goes to charity**, never to company revenue.
- **Purification:** Keep a `charity_purification` ledger account. Any accidental interest or doubtful income goes there and is paid out to charity, with records.
- **Gateways:** Paystack and Flutterwave are payment processors and fine to use. Avoid any "pay later" or BNPL features that carry interest.
- **Crypto (Pi / Sidra / stablecoins):** Scholars differ. Do not accept or pay out tokens until your advisor gives a written ruling on each specific token and use.

### 24.6 Rewarded ads
- The reward is shown and fixed before the user starts, for example "Watch to earn 10 coins."
- No random, mystery or spin-the-wheel rewards linked to ads.
- Rewarded ads are never served in gambling-style, social-casino or other haram apps.
- The user must actually complete the condition (watch the ad). SSV verification (Section 11) supports honest fulfilment of the ju'alah.

### 24.7 Publisher vetting
- Every app gets `halal_review_status` before it can earn.
- Reject apps whose main purpose is in the banned list: betting, loan sharks, dating, adult content, astrology and so on.
- Re-review apps on major updates or user reports.
- Publishers can add stricter blocks (for example no music at all) on top of the network-wide rules.

### 24.8 Programmatic demand (DSPs)
- Send the full banned list as `bcat` and known haram advertiser domains as `badv` in **every** OpenRTB request.
- **Re-check every winning creative** before serving:
  - IAB category
  - Landing domain against the block list
  - Automated image and text scan
- Reject non-compliant bids and log them in `DspViolation`. Warn, then disconnect, DSPs with repeated violations.
- Prefer DSPs that support strict category blocking. Start with a small number of trusted demand partners.

### 24.9 Honesty, privacy and ethics
- **No deception (ghish / tadlis):** Reject misleading claims, fake urgency, fake buttons and disguised ads. Anti-fraud work (Section 10) protects advertisers from paying for fake traffic, which is a duty of fairness.
- **No spying (tajassus):** Collect only consented, necessary data. This aligns with NDPA and GDPR (Section 13).
- **Fair dealing:** Clear reports and transparent IVT deductions, so advertisers and publishers know exactly what they paid for and earned.
- **Children:** Strict family-safe ads in child-directed apps (Section 13).

### 24.10 Zakat
- The company's zakatable assets (cash, receivables, trade goods) are subject to zakat each lunar year.
- Keep a `zakat_reserve` ledger account. Calculate zakat with the advisor and an accountant familiar with Islamic finance.
- Advertiser wallet balances held as amanah are **not** company assets for zakat purposes. Confirm their treatment if they are held as qard.

### 24.11 Governance
- **Sharia advisor or board:** an individual scholar at first, a small board as the network grows.
- **Documents the advisor approves:**
  - Halal Ad Policy
  - Publisher Policy
  - Banned and disputed category lists
  - Advertiser and publisher terms (contract structure from 24.4)
  - Refund policy
  - Penalty and purification policy
- **Rulings register:** the `ShariaRuling` table.
- **Annual Sharia audit:** sample of served creatives, approved apps, ledger (no interest, purification paid), FX records and DSP violations.
- **Certification:** a written Sharia compliance certificate from the advisor or board, published on your website.
- **Escalation:** any staff member or user can flag a Sharia concern. Flags go to the advisor review queue.

### 24.12 Market positioning
- Brand as a **"Halal Ad Network"** with a visible certificate.
- **Target advertisers:**
  - Islamic banks and Takaful operators
  - Halal food and modest fashion brands
  - Islamic education, Hajj and Umrah services
  - Muslim-focused apps
- **Target publishers:**
  - Quran, prayer-time and Islamic apps
  - Hausa and Arabic content apps
  - Family apps, and community apps in the Pi / Sidra ecosystems
- **Target markets:** Nigeria and West Africa, then the Middle East and North Africa, Malaysia and Indonesia.
- Muslim publishers who today block ads, or avoid AdMob because of haram ads, become your strongest early adopters.

---

*End of blueprint. Use the checklist in Section 23 to track progress, and expand any section into a detailed technical spec when you start that phase.*
