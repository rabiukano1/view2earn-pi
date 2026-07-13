# View2Earn — Full Project Master Plan
**Version 2.4 — July 2026**
Dual-blockchain social engagement & rewards platform (Pi Network + Sidra Chain)
**Stack: React Native CLI + Hermes + CodePush OTA (mobile) · Next.js (Pi web) · Convex (backend)**

---

## 1. Vision & Core Concept

View2Earn is a task-and-reward platform where users:
- Complete social tasks (follow pages/channels, join groups) and earn points
- Answer AI-generated quizzes about Pi Network / blockchain when no tasks are available
- Complete surveys from integrated offerwall providers
- Spend points to list their own profile and gain followers from other users (internal marketplace)
- Refer friends for qualified-referral rewards
- Redeem points for data/airtime bundles; purchase bundles with real Pi (Pi app) or Sidra (Sidra app)
- Build daily habits: check-in streaks, daily quiz challenge, leaderboards, combo bonuses

**Key design rules:**
- Follower/friend counts are NEVER shown in our UI — totally hidden. Only the number of pages/channels a user has followed (task completions) is shown.
- No cross-chain bridges: Pi and Sidra economies are fully separate.
- Points ≠ money in all UI wording. Points are "redeemable for rewards."
- **NO P2P point transfers** — removed by design (top fraud cash-out vector).
- No user secrets ever: Pi SDK handles login and wallet payments; users never share seeds/keys.
- Never violate ad network, survey provider, or social platform Terms of Service.

---

## 2. Architecture — Monorepo with Convex Backend

```
view2earn/                     ← one Git repo (npm/yarn workspaces)
  packages/
    core/                      ← shared TypeScript logic:
                                 - points/reward rules & constants
                                 - task state machine definitions
                                 - fraud scoring rules
                                 - shared types & validation
  apps/
    pi-web/                    ← Next.js web app (Pi Browser)
                                 - Pi SDK login, Pi payments (purchases)
    sidra-mobile/              ← React Native CLI (Android/iOS)
                                 - Sidra auth, Sidra wallet
                                 - ZERO Pi code in this app
    admin-panel/               ← Next.js private dashboard
  convex/                      ← Convex backend (shared by all apps)
                                 - queries, mutations, actions
                                 - HTTP actions (survey postbacks)
                                 - cron jobs, scheduled functions
                                 - file storage (screenshots)
```

**Backend enforcement (Convex):** every function checks `user.ecosystem`
first — Pi functions reject Sidra users and vice versa. Server-side
enforcement, never client-only.

```typescript
// convex/lib/guards.ts
export async function requireEcosystem(ctx, userId, ecosystem: "PI" | "SIDRA") {
  const user = await ctx.db.get(userId);
  if (!user || user.ecosystem !== ecosystem) throw new Error("Wrong ecosystem");
  return user;
}
```

### Why Convex fits View2Earn
| Feature | Convex capability |
|---|---|
| Real-time points balance in UI | `useQuery` auto-updates, no polling |
| Screenshot uploads | Built-in File Storage (`_storage`) |
| 48h fraud hold → auto-release | `ctx.scheduler.runAfter()` |
| Count-delta background checks | Cron jobs (`convex/crons.ts`) |
| AI vision screenshot check | Actions calling external vision API |
| Survey postbacks (CPX/BitLabs) | HTTP actions with signature check |
| VAS airtime/data fulfillment | Action calling Reloadly/DTone + webhook |
| Pi/Sidra separation | Ecosystem guard in every function |

---

## 3. Tech Stack & Setup

### Sidra mobile app — React Native CLI
```bash
# Requirements: Node 18+, JDK 17, Android Studio (SDK 34+), Xcode for iOS
npx @react-native-community/cli init View2Earn
npm install convex
npm install react-native-code-push          # OTA updates (see Section 3b)

# Development (three terminals):
npx convex dev                  # backend sync
npx react-native start          # Metro bundler
npx react-native run-android    # debug build

# Release builds (established workflow):
cd android && ./gradlew assembleRelease   # APK
cd android && ./gradlew bundleRelease     # AAB for Play Store
```

### Convex client in React Native
```typescript
// App.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.CONVEX_URL, {
  unsavedChangesWarning: false, // required for React Native
});

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <RootNavigator />
    </ConvexProvider>
  );
}
```

### Pi web app — Next.js + same Convex deployment
- Pi SDK loaded via script tag, `Pi.init({ version: "2.0", sandbox: true })`
- `Pi.authenticate(['username','payments','wallet_address'], ...)`
- Backend verifies access token against `https://api.minepi.com/v2/me`
- Talks to the SAME Convex backend as the mobile app

---

## 3b. Framework Decision, App Size & OTA Strategy

### Why React Native CLI (decision record)
| | RN CLI | Flutter | Native Kotlin |
|---|---|---|---|
| APK size (arm64 split) | ~12–20 MB | ~15–22 MB | ~5–10 MB |
| OTA updates | ✅ JS bundle OTA | ❌ none (by design) | ❌ store only |
| Reuses packages/core (TS) | ✅ 100% | ❌ Dart rewrite | ❌ Kotlin rewrite |
| Convex client | ✅ official | ⚠️ community | ⚠️ manual |

RN CLI wins for View2Earn: full monorepo/TypeScript reuse, official Convex
support, and real OTA. Pi web app needs no OTA at all — it's a website in
Pi Browser; every deploy reaches 100% of users instantly.

### OTA: react-native-code-push (expo-updates blocked by RN 0.86)
`install-expo-modules@latest` fails on RN 0.86 (unsupported SDK version).
Fallback: **react-native-code-push v9.0.1** (community fork of CodePush).

```bash
npm install react-native-code-push
```
**iOS native setup:**
- Bridging header (`View2Earn-Bridging-Header.h`) imports `<CodePush/CodePush.h>`
- `AppDelegate.bundleURL()` returns `CodePush.bundleURL()` in release builds
- `CodePushDeploymentKey` in `Info.plist` (set via `CODEPUSH_KEY` env var)

**Android native setup:**
- `codepush.gradle` applied in `app/build.gradle`
- `CodePushDeploymentKey` in `strings.xml` (set via `CODEPUSH_KEY` env var)
- Autolinking handles the native module registration

**JS setup:**
- `App.tsx` exports `codePush(App)` — checks for updates on app start
- Alternative: use `codePush.sync()` for manual control (check/download/install)

**Workflow:**
```bash
cd android && ./gradlew bundleRelease                # store release
appcenter codepush release-react -a owner/View2Earn   # OTA update
```
Requires App Center account or self-hosted CodePush server. If EAS supports
RN 0.86+ later, migrate by:
- Removing react-native-code-push
- Running `npx install-expo-modules@latest` (once compatible)
- Running `npx expo install expo-updates`
- Keeping AppDelegate bridging header approach

### Runtime Version Policy (the one rule that matters)
- OTA only updates JS. Native changes (new SDK, permission, native module)
  REQUIRE a store release + version bump.
- Launch build ships with ALL native deps already included (ad SDKs,
  device-info, fingerprint collection), even if unused at launch →
  months of iteration purely over OTA.
- Screens, task logic, limits, quiz content = JS = instant OTA.
- Adding a new native SDK later = APK update + store release.
- CodePush deployment keys per environment (Staging/Production).

### App Size Budget (~15–18 MB download target)
- Ship AAB (`bundleRelease`) — Play delivers per-device splits (~40–50%
  smaller than universal APK)
- Hermes enabled (default) — smaller bundle, faster startup
- `shrinkResources true` + R8/ProGuard in release gradle
- Light deps: date-fns not moment; per-function lodash imports
- `React.lazy` screen loading for fast startup on low-end devices
- Matters doubly in Pi/Sidra markets: low-end Androids, expensive data

---

## 4. Verification System (4 Tiers)

### Tier 1 — Screenshot + AI Vision Verification (PRIMARY, launch feature)
Main verifier for Facebook and TikTok (Instagram/X later).
Cost-optimized pipeline: **pre-check → resize → cheap model → escalate →
sample → purge** (~80–90% cheaper than naive per-image premium verification).

**User flow:**
1. User taps task → "Follow Page X" → deep link opens FB/TikTok
2. User follows the page, returns to app, taps "I followed"
3. App prompts: "Upload a screenshot showing the Following ✓ button"

**Stage 1 — Client-side pre-checks (FREE, filters ~20–30%):**
- Reject wrong dimensions/format, blank/black images
- Reject screenshots older than the task claim time (EXIF)
- RESIZE to ~800px wide on-device before upload — reading a button state
  and username needs no more; cuts vision cost 50–75% AND saves the user's
  mobile data (store the resized image ONLY, ~100–200 KB, never originals)

**Stage 2 — Cheap server checks (near-free):**
- Perceptual hash (pHash) vs. user's own past screenshots and a global
  recent-hash table → duplicates rejected BEFORE any AI call
  (fraudsters resubmit the same image constantly — cheapest win available)

**Stage 3 — Tiered AI vision (Convex action):**
- Small/cheap vision model first (Haiku-class), checking:
  - Correct target page (name/handle/avatar match)?
  - "Following / ✓" state visible?
  - Visible username matches the user's linked profile?
- High confidence → auto-approve to PENDING_HOLD
- Low confidence (~10–20%) → escalate to stronger model or human review
  queue. Never run the premium model on everything.

**Stage 4 — Trust-based sampling (biggest structural saving):**
- New users (first ~10 tasks): 100% of screenshots verified
- Established users (clean history, low fraud score): random 30–50%
  verified; the rest auto-approved into the normal 48h hold
- Any fraud event → back to 100% verification for 30 days
- Safe because: 48h hold + random re-verification catch cheaters
  retroactively and points are reclaimed

**Stage 5 — Storage purge (Convex daily cron):**
- After RELEASED + re-check window (14 days): delete the image file;
  keep only pHash + AI result (audit trail). ~90% storage reduction.

**Anti-fake-screenshot measures (unchanged):**
- 48-hour hold before points become spendable
- Random re-verification: X% of users asked to re-submit proof days later
- Duplicate detection via pHash; EXIF/editing artifact checks
- Per-user daily task caps

**Cost note:** only FOLLOW tasks need vision at all. Quizzes/surveys have
their own verification; Telegram tasks verify via bot API for FREE — promote
Telegram tasks where advertisers accept them (zero verification cost).

### Tier 2 — Bio-Code Ownership Verification (at profile linking)
Kills fake-profile-link fraud — the #1 fraud vector.
1. User pastes their TikTok/Facebook/etc. profile link
2. System generates a 6-character code, valid 15 minutes
3. User puts the code in their bio temporarily
4. ONE lightweight fetch of the public profile confirms the code
5. Profile saved with snapshot — **locked for 30 days** (`lockedUntil`)
6. After 30 days, user may change the linked profile (re-verified)

One request per user ever — not continuous scanning. Minimal risk.

### Tier 3 — Count-Delta as Fraud Signal (NOT a payment gate)
- Convex cron job occasionally checks target page public counts
- Input to campaign-level fraud scoring only
- NEVER decides per-user pay/no-pay (rounded counts + caching make it unreliable)

### Tier 4 — Telegram Bot Verification (high-trust secondary task type)
- Telegram Bot API verifies a SPECIFIC user is a channel/group member
- 100% reliable, free, zero ToS risk
- Runs alongside FB/TikTok tasks as the "trusted" task category

### Pluggable Verifier Design
Each verifier is a module, toggleable in the admin panel like ad networks:
`screenshot-ai` · `bio-code` · `count-delta` · `telegram-bot` · (future: youtube-api, discord-bot)

---

## 5. Task Verification State Machine

```
CREATED → USER_CLAIMED_DONE → PROOF_SUBMITTED
                                   │
                       ┌───────────┼───────────┐
                  AI_APPROVED  AI_UNCERTAIN  AI_REJECTED
                       │           │             │
                       │      ADMIN_REVIEW ──────┤
                       │       │        │        │
                       └──► PENDING_HOLD (48h)  REJECTED → user asked
                               │                            to retry/follow
                    ┌──────────┴──────────┐
              spot-check OK        fraud detected /
                    │              unfollow detected
                RELEASED               CANCELLED
              (points spendable)   (points reclaimed)
```
Implemented as Convex mutations; the 48h transition uses `ctx.scheduler.runAfter`.

---

## 6. Convex Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    externalUid: v.string(),             // Pi UID / Sidra ID — UNIQUE, one
                                         // account per KYC'd identity (Layer 1)
    username: v.string(),
    tier: v.number(),                    // 0 basic, 1 email, 2 phone
    fraudScore: v.number(),
    deviceFingerprint: v.string(),
    signupIp: v.string(),
    country: v.string(),
  }).index("by_ecosystem", ["ecosystem"])
    .index("by_externalUid", ["externalUid"]),   // enforce uniqueness

  linkedProfiles: defineTable({
    userId: v.id("users"),
    platform: v.string(),                // "tiktok" | "facebook" | "telegram"
    url: v.string(),
    usernameSnapshot: v.string(),
    verifiedAt: v.number(),
    lockedUntil: v.number(),             // 30-day lock
    normalizedUrl: v.string(),           // GLOBALLY unique — one profile,
                                         // one account, forever (Layer 1)
  }).index("by_user", ["userId"])
    .index("by_normalizedUrl", ["normalizedUrl"]),

  tasks: defineTable({
    type: v.string(),                    // FOLLOW_PAGE | JOIN_CHANNEL | QUIZ | SURVEY
    platform: v.string(),
    targetUrl: v.string(),
    points: v.number(),
    verifier: v.string(),                // "screenshot-ai" | "telegram-bot" | ...
    maxCompletions: v.number(),
    creatorUserId: v.optional(v.id("users")),  // marketplace tasks
    status: v.string(),
    expiresAt: v.number(),
  }).index("by_status", ["status"]),

  verifications: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    state: v.string(),                   // state machine states
    screenshotStorageId: v.optional(v.id("_storage")),  // purged after 14d
    screenshotPhash: v.optional(v.string()),             // kept forever (dedup/audit)
    sampled: v.optional(v.boolean()),                    // was AI actually run?
    aiConfidence: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    holdUntil: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_state", ["state"]),

  pointsLedger: defineTable({            // APPEND-ONLY, never edit
    userId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
    balanceAfter: v.number(),
  }).index("by_user", ["userId"]),

  providers: defineTable({
    kind: v.union(v.literal("ADS"), v.literal("SURVEY"), v.literal("VAS")),
    name: v.string(),
    platform: v.union(v.literal("pi-web"), v.literal("sidra-mobile"), v.literal("both")),
    configJson: v.string(),              // appId, bannerId, keys...
    enabled: v.boolean(),
  }),

  catalog: defineTable({                 // data/airtime bundles
    ecosystem: v.union(v.literal("PI"), v.literal("SIDRA")),
    itemType: v.string(),                // "DATA" | "AIRTIME"
    name: v.string(),                    // "1GB Data", "500 Airtime"
    pointsPrice: v.optional(v.number()), // redeem with points
    coinPrice: v.optional(v.number()),   // buy with real Pi / Sidra
    providerSku: v.string(),             // VAS provider bundle ID
    countries: v.array(v.string()),
    enabled: v.boolean(),
  }).index("by_ecosystem", ["ecosystem"]),

  redemptions: defineTable({
    userId: v.id("users"),
    catalogId: v.id("catalog"),
    paidWith: v.string(),                // "POINTS" | "PI" | "SIDRA"
    amount: v.number(),
    phoneNumber: v.string(),             // verified number topped up
    providerRef: v.optional(v.string()),
    status: v.string(),                  // processing | fulfilled | failed | refunded
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  referrals: defineTable({
    referrerId: v.id("users"),
    refereeId: v.id("users"),
    qualifiedAt: v.optional(v.number()),
    rewarded: v.boolean(),
  }).index("by_referrer", ["referrerId"]),

  fraudEvents: defineTable({
    userId: v.id("users"),
    type: v.string(),
    detailsJson: v.string(),
  }).index("by_user", ["userId"]),

  deviceSignals: defineTable({           // Layer 2 + 3 signals per session
    userId: v.id("users"),
    platform: v.string(),                // "pi-web" | "sidra-mobile"
    canvasHash: v.optional(v.string()),  // web: canvas/WebGL fingerprint
    audioHash: v.optional(v.string()),
    hardwareJson: v.string(),            // model, screen, sensors, GAID(native)
    ip: v.string(),
    ipFraudScore: v.optional(v.number()),
    vpnDetected: v.optional(v.boolean()),
    timezone: v.string(),
    tzIpMismatch: v.optional(v.boolean()),
  }).index("by_user", ["userId"])
    .index("by_canvasHash", ["canvasHash"]),

  completedTargets: defineTable({        // feed dedup by target URL
    userId: v.id("users"),
    normalizedUrl: v.string(),
  }).index("by_user_url", ["userId", "normalizedUrl"]),

  platformLimits: defineTable({          // admin-configurable follow caps
    platform: v.string(),
    dailyTaskLimit: v.number(),
    cooldownMinutes: v.number(),
    newProfileFactor: v.number(),        // e.g. 0.5 for young profiles
  }),
});
```

### Append-only ledger mutation
```typescript
// convex/points.ts
export const credit = mutation({
  args: { userId: v.id("users"), delta: v.number(), reason: v.string() },
  handler: async (ctx, args) => {
    const last = await ctx.db.query("pointsLedger")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .order("desc").first();
    const balanceAfter = (last?.balanceAfter ?? 0) + args.delta;
    if (balanceAfter < 0) throw new Error("Insufficient points");
    await ctx.db.insert("pointsLedger", { ...args, balanceAfter });
  },
});
```

### Task feed with target-URL dedup
```typescript
// convex/tasks.ts
export const feed = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const done = await ctx.db.query("completedTargets")
      .withIndex("by_user_url", q => q.eq("userId", userId)).collect();
    const doneUrls = new Set(done.map(d => d.normalizedUrl));

    const tasks = await ctx.db.query("tasks")
      .withIndex("by_status", q => q.eq("status", "ACTIVE")).collect();

    return tasks.filter(t =>
      !doneUrls.has(normalize(t.targetUrl)) &&   // never seen if already followed
      t.creatorUserId !== userId                  // never own listings
    );
  },
});
```

---

## 7. Core Modules

### 7.1 Auth & Users
- Pi login (web only) via Pi SDK; token verified server-side (`api.minepi.com/v2/me`)
- Sidra auth (native mobile only) — the RN CLI app contains ZERO Pi code
- User tiers: basic → email verified → phone verified (higher tiers = higher redemption limits)
- One account per device policy (device fingerprint at signup)

### 7.2 Social Profile Linking
- Paste profile URL → bio-code ownership check (Tier 2) → snapshot saved
- 30-day lock via `lockedUntil`; change allowed after, with re-verification
- One profile per platform per user

### 7.3 Task Engine
- Task types: `FOLLOW_PAGE`, `JOIN_CHANNEL` (Telegram), `SURVEY`, `QUIZ`
- Internal marketplace: users spend points to create FOLLOW tasks for their own linked profile
- Task feed hides all follower counts — only reward + platform + page name

### 7.4 Survey / Offerwall Integrations
- Pluggable providers: CPX Research, BitLabs, Pollfish, TheoremReach, ayeT-Studios
- Convex HTTP action receives postbacks; **signature verified on every callback**
- Admin ON/OFF toggle per provider; instant switch if one bans/fails
- Chargeback handling: provider reverses → points reclaimed via negative ledger entry

### 7.5 AI Quiz Generator (fallback content)
- Convex action calls LLM API to generate Pi Network learning guides + quizzes
- Pre-generate & cache question banks; rotate per user
- Randomized answer order, per-question time limits (anti-bot)
- Small point rewards; fills gaps when no surveys/tasks available

### 7.6 Ads Layer
- Ad networks stored in `providers` table, admin-editable:
  `{ provider, appId, bannerId, interstitialId, rewardedId, enabled }`
- Rewarded ad required on each "Claim" button (watch → claim releases)
- Custom house ads: admin uploads video/banner + clickable URL
- **Compliance guardrails (hard-coded):**
  - Users NEVER rewarded for clicking ads — only rewarded-video views pay
  - Frequency caps per user per hour
  - No incentivized clicks, no misleading placements

### 7.7 Referral System
- Unique referral code + link per user
- Reward only on QUALIFIED referral: referee completes N tasks + passes fraud checks
- Never reward signup alone; same device/IP cluster = no reward

### 7.8 Points Economy
- **Earn:** tasks, quizzes, surveys, qualified referrals, streaks, combos
- **Spend:** list own profile as a follow task (internal marketplace),
  marketplace boost auctions (featured slots — burns points)
- **Redeem:** points → data/airtime bundles (VAS provider)
- **Purchase:** data/airtime with real Pi (Pi app, via Pi SDK payment) or
  Sidra (Sidra app). Payment must be CONFIRMED before triggering VAS API.
- **NO P2P transfers** — removed permanently (fraud cash-out vector)
- **No points-for-coin withdrawals in v1** — simplifies compliance; no app
  wallet secret seed needed anywhere
- No cross-chain conversion ever
- **Economy rule:** points paid out ≤ ~50% of ad+survey revenue; review monthly

### 7.8b Data/Airtime Redemption (VAS Module)
- Aggregator API: Reloadly / DTone / local provider per target country
- Flow: pick bundle → deduct (ledger) → Convex action calls VAS API →
  webhook confirms → fulfilled; on failure/timeout → AUTO-REFUND points
- Fraud controls (airtime is cash-equivalent):
  - Tier 2 (phone verified) required; first N redemptions ONLY to the verified number
  - Low daily redemption caps per user
  - "Processing" state shown until provider webhook confirms
- Pi purchases: Pi SDK payment → backend confirms completion → then VAS call

### 7.9 Anti-Fraud Architecture — Five Layers
Goal: never 100% blocking (impossible) — make fraud COST MORE than it pays.
A fraudster must burn a KYC'd Pi identity + a real SIM + a unique social
profile per fake account. At that point they are doing legitimate work.

**Layer 1 — Identity Anchors (strongest)**
- ONE View2Earn account per Pi UID, hard-enforced. Pi KYC = one human, one
  account. Cloned Pi Browsers cannot clone a KYC'd Pi identity. Store the
  UID from `Pi.authenticate()` with a uniqueness index.
- Phone verification (SMS OTP) gates Tier 2 — required before ANY redemption.
  Clones need one real SIM per account.
- Linked social profile uniqueness: one TikTok/FB/Telegram profile may only
  ever link to ONE account, forever (global unique index on normalized URL).

**Layer 2 — Device/Browser Fingerprinting (probabilistic)**
- Sidra native: composite fingerprint — hardware model, screen metrics,
  build fingerprint, Android ID, GAID (weak/resettable: low weight, one
  signal only, native-only per Google Play policy), fonts, sensor list.
  Signal INCONSISTENCY is itself a flag (claims Samsung S23, GPU says
  Mediatek → clone/spoof suspected).
- Pi Browser (web): JS fingerprinting — canvas/WebGL rendering hash, audio
  context, screen, timezone, language, hardware concurrency (FingerprintJS
  open source or Fingerprint Pro). Multiple cloned Pi Browsers on ONE
  physical phone produce the SAME canvas/WebGL hash — hardware doesn't
  change when an app is cloned. This directly catches the clone-app attack.

**Layer 3 — Network Signals**
- IP reputation API (IPQualityScore / IPinfo): VPN, proxy, datacenter
  detection, per-IP fraud score
- Timezone-vs-IP-geolocation mismatch (location spoofers rarely fix timezone)
- Many accounts per IP subnet in a time window → cluster flag

**Layer 4 — Behavioral (hardest to fake)**
- Task-completion timing patterns repeated across "different" accounts
- Accounts created minutes apart following the same task sequence
- Impossible speed (claim 4s after open)
- Referral chains where referrer/referees share any Layer 2/3 signals

**Layer 5 — Economic Containment (accept a small miss rate)**
- Aggregated fraud score from ALL layers → thresholds:
  normal → hold rewards → shadow-limit → ban
- New accounts earn at reduced rates for first 7 days
- Redemption ONLY to the OTP-verified phone number — 50 farmed clones
  still need 50 real SIMs to extract value. Final wall.
- Rate limits on EVERYTHING: claims, verifications, quiz attempts,
  uploads, redemptions

### 7.9b User Protection — Follow Limits (protect users from platform bans)
Platforms suspend accounts that follow too fast. Enforce conservative caps
(admin-configurable per platform):
- TikTok: 10–15 follow tasks/day per user
- Facebook: 10–15/day
- Telegram: 10 joins/day
- Cooldown 3–5 minutes between same-platform tasks (mimics human pace —
  the single best ban protection)
- New/young linked social profiles get HALF limits
- Honest UI: "Daily TikTok limit reached — this protects your account from
  suspension. More tasks tomorrow." (also builds daily-return habit)
- Side benefit: low caps slow down farming further.

### 7.9c Task Feed Rules — Dedup & Visibility
- A user NEVER sees a task whose normalized target URL they have already
  completed or have in progress — dedupe by TARGET URL, not task ID
  (relisted pages must stay hidden from past followers; never pay twice,
  never show an impossible "follow again" task)
- Users never see their OWN listings (creator can't complete own task)
- Maintain a per-user `completedTargets` set (normalized URLs) checked in
  the feed query alongside completed task IDs

### 7.9d Deep Link Handling (Facebook Lite fix + all platforms)
Problem: Facebook Lite often fails to resolve `facebook.com/PageName` links.
- Store the numeric page ID at task creation; prefer
  `https://facebook.com/profile.php?id={pageId}` — resolves reliably across
  full app, Lite, and mobile web
- Sidra native intent chain: try `fb://page/{pageId}` (full app) → fall back
  to https form (Lite registers for standard https facebook.com links)
- Pi Browser (web): cannot detect installed apps — always use the https
  profile.php?id= form, let Android's app-chooser handle it
- Universal fallback on every task: "Copy page link" button — user pastes
  into whatever app they use. Works 100%, essential for Lite-heavy markets.
- Verification is link-agnostic by design: the screenshot only needs to show
  the right page in Following state, regardless of how the user got there.

### 7.10 Admin Panel (Next.js + Convex)
- Users: search, activity log, adjust points, ban/suspend, fraud score
- Tasks: create/edit/delete/pause, rewards, campaign stats
- Review queue: screenshot + linked profile + fraud score + approve/reject (day-one feature)
- Providers: ads & surveys ON/OFF, credentials, add/delete/switch
- Custom ads: upload, click URL, schedule
- Redemptions: fulfillment monitor, flagged redemptions, refund queue
- Catalog: add/edit data & airtime bundles per ecosystem, prices in points/coin
- Engagement: streak rewards config, quiz pool size, flash task scheduler
- Verifiers: enable/disable per platform
- Follow limits: per-platform daily caps, cooldowns, new-profile factor
- Fraud dashboard: layer signals per user, canvas-hash clusters, IP clusters,
  transfer-free economy monitor
- Analytics: DAU, points issued vs redeemed vs revenue

### 7.11 Ads Strategy Per Platform
**Pi Browser (web — mobile ad SDKs do NOT work here):**
- Priority 1: Pi Ad Network (ecosystem-native, pays in Pi, most compliant;
  apply via develop.pi, check regional availability)
- Backup: reward-friendly web networks (Adsterra, Monetag, ayeT/AdGate web
  widgets). AVOID AdSense — reward apps get banned for incentivized traffic.
**Sidra mobile (native):**
- Full mobile SDKs: AdMob / Unity / AppLovin rewarded video
- Rewarded video on Claim buttons + spin wheel
Providers carry a `platform` field so admin toggles ads per app independently.

### 7.11b Engagement Systems (shared via packages/core)
Daily habit loop:
- Daily check-in streak (growing rewards day 1→7, reset on break, streak flame on home)
- Daily Quiz Challenge — same 5 AI questions for everyone; perfect scores share a bonus pool
- Spin wheel / mystery box after 3 tasks/day (rewarded ad attached to spin)
Competition:
- Weekly leaderboards (top earners, quiz scores, streaks) — weekly reset; small prizes
- Marketplace boost auctions — bid points for top 3 featured profile slots daily (burns points)
- Teams/clans (later phase): pooled weekly goals
Ecosystem-native content:
- "Learn Pi" academy: leveled guides (basics → wallet → Launchpad) with quiz gates + badges
- "Learn Sidra" academy: Sidra basics, wallet, Shariah-compliant principles (key trust topic
  for the Sidra community)
- App discovery tasks: other Pi/Sidra developers pay to be promoted as tasks
Session depth:
- Task combos (Telegram join + TikTok follow + quiz in one day = bonus)
- Limited-time flash tasks (2h double points, in-app banner)
- Progress bar to next redemption ("340 points from a 1GB bundle") — always visible
Platform-specific levers:
- Pi Browser: NO push notifications available → streak fear-of-loss + email digests
  drive returns; PWA speed (<2s load) is critical on low-end devices
- Sidra native: push notifications (streak expiry, flash tasks, leaderboard passes),
  home screen widget (later), offline quiz mode with sync (emerging-market friendly)
Launch set: streak + daily quiz + progress bar + weekly leaderboard.

### 7.12 Legal & Compliance
- Privacy Policy: IP/location/device tracking disclosure, GDPR-style consent, retention
- Terms of Service: task rules, fraud = ban + forfeiture, 30-day profile lock, redemption conditions
- AML posture: redemption caps, identity tiers, verified-number-only top-ups,
  transaction logs retained, blocked-countries list (admin-configurable)
- Comply with Pi Network platform/developer policies for reward apps
- ⚠️ Lawyer review before launch — crypto payments + rewards + airtime redemption touch financial
  regulation that varies by country. Templates are a start, not the finish.

---

## 8. Build Phases

### Phase 1 — Foundation (Weeks 1–3)
- `npx @react-native-community/cli init View2Earn` + `npm install convex` + `npx convex dev`
- react-native-code-push configured (expo-updates blocked by RN 0.86 incompatibility)
- Monorepo workspaces; Convex schema deployed (Section 6)
- Ecosystem guard middleware; Sidra auth flow writing to `users`
- `packages/core`: reward rules + state machine definitions + tests
- Append-only `pointsLedger` mutations

### Phase 2 — Verification & Task MVP (Weeks 3–7)
- Profile linking + bio-code ownership (Tier 2) + 30-day lock + GLOBAL
  profile uniqueness (one social profile = one account forever)
- Layer 1 identity anchors: one-account-per-Pi-UID enforcement
- Layer 2 fingerprinting: canvas/WebGL on Pi web, composite on native
- Task feed dedup by normalized target URL; hide own listings
- Follow limits + cooldowns per platform (user ban protection)
- Deep links: numeric FB page IDs + intent chain + Copy-link fallback
- Screenshot pipeline (Tier 1): client resize + pre-checks → pHash dedup →
  cheap-model-first AI action → escalation path, for Facebook + TikTok
- Storage purge cron (delete images 14d after release, keep pHash)
- Telegram bot verifier (Tier 4)
- 48h hold via `scheduler.runAfter` + basic admin review queue
- Task feed screen with `useQuery` (counts hidden)

### Phase 3 — Monetization (Weeks 7–10)
- One survey provider live (CPX or BitLabs) via Convex HTTP action with signed postbacks
- One ad network live (rewarded ads on Claim buttons)
- AI quiz generator action with cached question banks
- Count-delta fraud-signal cron (Tier 3)

### Phase 4 — Admin Panel Full (Weeks 10–12)
- Provider toggles, credentials, custom house ads
- Full review queue with fraud scores
- Payout approval queue; analytics dashboard

### Phase 5 — Redemptions, Marketplace & Referrals (Weeks 12–14)
- VAS integration (Reloadly/DTone): points → data/airtime, auto-refund on failure
- Pi SDK purchases of bundles (payment confirmed → VAS call) on testnet
- Points-to-list-profile internal marketplace + boost auctions
- Qualified referral system; redemption caps + identity tiers
- Engagement launch set: streak, daily quiz challenge, progress bar, weekly leaderboard

### Phase 6 — Hardening & Pi Launch (Weeks 14–17)
- All 5 fraud layers live end-to-end: identity anchors, fingerprints,
  network signals, behavioral scoring, economic containment
- Trust-based sampling enabled (new users 100%, established 30–50%)
- Rate limits audited
- Privacy Policy + ToS published (lawyer-reviewed)
- Pi Developer Portal listing (develop.pi); testnet beta with real users
- Pi Launchpad testnet token (product-first requirement met: working app exists)
- Mainnet switch after stable beta

### Phase 7 — Sidra Mobile Launch (Weeks 17–20)
- RN CLI app finalized reusing `packages/core` + same Convex backend
- Launch build ships with ALL native SDKs pre-included (ads, device-info,
  fingerprinting) → post-launch iteration via CodePush OTA only
- CodePush OTA tested on release APK before store submission
- Sidra auth + Sidra bundle purchases + push notifications
- `./gradlew bundleRelease` → Play Store; iOS archive → App Store
- (Pi-web first, Sidra second: one ecosystem stable beats two half-working)

---

## 9. Success Rules (pin these on the wall)

1. Points ledger is append-only — every balance change is a ledger row.
2. Payout ≤ 50% of revenue. Review monthly.
3. Screenshot verifier + 48h hold + spot re-checks = accept small fraud margin, cap task values low.
4. Bio-code ownership check at linking is mandatory — it prevents the biggest fraud.
5. Every provider (ads, surveys, verifiers) is a config toggle, never hard-coded.
6. Human review queue exists from day one.
7. Never reward ad clicks. Only rewarded-video views.
8. API keys live in Convex environment variables, never in code. No user
   secrets ever — Pi SDK handles all wallet operations.
9. No P2P point transfers. No points-for-coin withdrawals in v1.
10. Airtime is cash-equivalent: phone-verified users only, caps, verified-number-only at first.
11. One Pi UID = one account. One social profile = one account. Forever.
12. Fraud defense is five layers — no single signal (including GAID) is
    trusted alone; make fraud cost more than it pays.
13. Protect users' social accounts: conservative follow caps + cooldowns.
14. Never show a user a task they already completed (dedupe by target URL).
15. Ship all native SDKs in the first store build; iterate via OTA.
    Bump runtimeVersion on any native change — no exceptions.
15b. Screenshots: resize before upload, pHash before AI, cheap model before
    premium, sample trusted users, purge files after 14 days.
16. Lawyer reviews legal docs before mainnet.
17. Pi first, Sidra second. Testnet before mainnet. Always.
