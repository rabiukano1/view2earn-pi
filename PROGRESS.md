# View2Earn — Progress & Roadmap

Status tracker for the View2Earn build. Pairs with `View2Earn-Master-Plan-v2.4.md`
(plan sections referenced as §). Last updated: 2026-07-29.

---

## ✅ Completed

### Foundation (Plan Phase 1)
- React Native 0.86 app (Hermes) + Convex backend + CodePush OTA
- Convex schema with all core tables + indexes
- Append-only points ledger (`points.ts`): credit, balance, history
- Ecosystem guard middleware (`lib/guards.ts`)
- **Real auth via Convex Auth** — email/password, email OTP (Resend), Sign in with Telegram (device-fingerprint dev auth removed)
- Stack-over-tabs navigation (Home + 4 tabs + pushed screens); floating pill tab bar with real icons

### Tasks & Verification (Plan Phase 2)
- Task feed with target-URL dedup + hide-own-listings (`tasks.ts`)
- Task types: FOLLOW_PAGE, JOIN_CHANNEL, QUIZ, SURVEY
- Verification state machine: CREATED → CLAIMED → PROOF_SUBMITTED → AI_* → PENDING_HOLD (dev 60s) → RELEASED / REJECTED (`verifications.ts`)
- Screenshot upload pipeline (client resize → storage → AI check)
- **Follow limits + cooldowns** per platform, enforced server-side (`tasks.myLimits`, honest UI banner)
- **Deep links** with numeric Facebook page IDs + intent chain + Copy-link fallback (§7.9d)
- **Telegram bot verifier** — "Verify join" flow, no screenshot (§7.3 / Tier 4)
- **Bio-code profile linking** with real profile fetch + host/platform validation + 30-day lock + global uniqueness (§4 Tier 2, `linkedProfiles.ts`)
- Screenshot purge cron (14 days after release)

### Rewards, Marketplace & Referrals (Plan Phase 5)
- Rewards catalog + redemption flow (points debit + status tracking) (`rewards.ts`)
- Redemption history with live status badges
- Internal marketplace + create-listing screens (`marketplace.ts`)
- Referral code (deterministic) + referral count display

### Engagement — launch set + extras (§7.11b)
- **Daily check-in streak** — 7-day growing rewards, resets on miss (`streaks.ts`)
- **Daily quiz** — 5 questions, PI + SIDRA banks (`quiz.ts`, `quizSeed.ts`)
- **Weekly leaderboard** — top earners + my-rank (`leaderboard.ts`)
- **Progress bar to next redemption** ("X pts from a 1GB bundle")
- **Daily mystery box** — unlocks after 3 tasks/day, weighted random prize (`bonus.ts`)
- **Task combos** — follow + Telegram + quiz in a day = bonus (`combos.ts`)
- **App Wallet & PIPRO Token System** — Non-custodial internal app wallet with Points and PIPRO balances, instant zero-sum swaps, Solana on-chain deposit verification (`/wallet/verify-deposit`), admin-configurable exchange rates, and full transaction history (`wallets.ts`, `schema.ts`, `http.ts`, `WalletScreen.tsx`, `WalletHistoryScreen.tsx`).
- **Real-Time Admin Ad Reward Control** — Admin-configurable `adRewardPoints` via `platformSettings` and provider configs (`admin.ts`, `ads.ts`, `RewardedAdModal.tsx`), authoritatively awarding exact configured points to ledger and app wallet.
- **On-Chain Solana Deposit Verification** — Verified PIPRO SPL token transfers (`7hU4hrLtr2dxGDBy56HQo6NF2u19FA1k4rM8nJQ5ceFk`) via Solana RPC with automatic balance crediting upon confirmation.
- **App-Wide Points & Wallet Sync** — Points earned from spins, ads, tasks, academy, quizzes, and streaks automatically sync with the user's app wallet balance and ledger.

### Fraud & Safety (Plan Phase 6, partial)
- **Trust-based verification sampling** (§4 Stage 4) — new users (< 10 tasks) 100% verified, trusted users sampled ~40% + auto-approved, fraud score ≥ 50 or recent fraud → 100% (`verifications.shouldVerify`)
- **Rate limits** (§7.9 Layer 5) — sliding-window burst guards on claims (12/min), uploads (10/min), quiz (5/min), redeem (5/5min) (`lib/ratelimit.ts`)

### Admin & Design
- Admin panel (Next.js): users, tasks, review queue, providers, redemptions, fraud, catalog
- Admin analytics dashboard — points economy (issued/spent/outstanding + payout-ratio vs 50% rule), user risk-tier distribution, fraud signals by type, 7-day new users, redemptions by status (`admin.getAnalytics`, CSS meters — no chart lib)
- Modern design system (`theme.ts`) — tokens, shadows; floating tab bar; branded hero headers; unified scroll
- **Real icons app-wide** — FontAwesome6 via `react-native-vector-icons` (`components/Icon.tsx`, `PlatformIcon.tsx`): nav tabs, home shortcuts, social brand logos, login inputs. *Needs `fonts.gradle` line + native rebuild to render.*
- **Modernized screens** — login (password / email-code / Telegram tabs, icon inputs, signup-on-failure prompt), profile (identity header, icon menu rows, fingerprint toggle, sign out), fingerprint unlock screen
- **Fingerprint app-lock** — `react-native-biometrics` (`auth/biometric.ts` lazy/guarded), `BiometricGate` prompts on reopen when enabled (toggle in Profile)

---

## 🔭 Roadmap — remaining features

### Self-contained (no external keys required)
- [x] Trust-based verification sampling (§4 Stage 4)
- [x] Rate limits on claims / uploads / quiz / redemptions (§7.9 Layer 5)
- [x] Admin panel sign-in gate (password via `ADMIN_PASSWORD` Convex env; `AuthGate` + `admin.checkPassword`)
  - [x] per-function admin auth on all `admin.*` functions — shared-secret `token` (the admin password) required on every call, checked server-side by `requireAdmin` (`admin.ts`); client injects it via `useAdminQuery`/`useAdminMutation` (`apps/admin-panel/src/app/useAdmin.ts`). Upgrade to real per-admin identity when a JWT provider exists.
- [x] Count-delta fraud-signal cron (§4 Tier 3) — 12h cron reads each active campaign's public count vs claimed follows; large shortfall → campaign fraud signal in `fraudEvents` (`countDelta.ts`, logic in `@view2earn/core`, count source mocked pending a real per-platform fetch)
- [x] Qualified referral flow (§7.7) — `referrals.ts`: code resolution (`resolveCode`), application at signup (`applyReferralCode`), qualification check on RELEASED (`checkQualification`, threshold = 5 tasks), device-cluster fraud guard, dual reward (100 pts referrer + 50 pts referee). Schema: `referredBy` on users, `by_referee` index on referrals. Client: referral code input at signup (LoginScreen), enhanced referral card with Share / stats / referred-by (ProfileScreen). Constants in `@view2earn/core`.
- [x] Learn Pi / Learn Sidra academy (§7.11b) — 3 leveled guides per ecosystem with a quiz gate each; pass ≥70% to unlock the next level + earn points once (badge = completed level). Content + gate logic in `@view2earn/core` (`academy.ts`), progress in `academyProgress`, backend `academy.ts` (`getAcademy`/`submitLevel`), UI `AcademyScreen.tsx` (entry from Profile). *Screen still needs an on-device pass.*
- [x] Spin wheel (variant of mystery box) — free once-a-day weighted spin; server picks the prize, UI reel animates to it. Prize table + `pickSpinIndex` in `@view2earn/core` (`spin.ts`), state in `dailySpins`, backend `spin.ts` (`getSpinStatus`/`spin`), UI `SpinScreen.tsx` (entry from Home). *Screen needs an on-device pass.*

### Auth — Convex Auth (email/password live; Google + Sidra KYC next)
- [x] **Reown/WalletConnect removed** — wallet is no longer login (becomes an in-app payout feature later: connect wallet to receive SDA + tokens). Deleted appkit/SIWE code, uninstalled the WC/ethers/noble stack (kills the cost).
- [x] **Convex Auth** (open-source, self-hosted, no per-user cost) — `authTables` + extended `users` table, Password provider with app-field defaults (`convex/auth.ts`), JWT keys set, `auth.addHttpRoutes` merged with existing webhooks, `users.me` query. Client: `ConvexAuthProvider` + AsyncStorage token storage (`App.tsx`), email/password `LoginScreen`, `useAuth()` maps the session to the user. Mock `getOrCreateDevUser` + `deviceFingerprint` **deleted**. Backend deployed + typechecks; RN app 0 typecheck errors.
- [x] **Security hardening** — `requireUser` now enforces `userId === Convex Auth session` (getAuthUserId), securing every function that calls it; added guards to `verifications.*` (claim/submitProof/verifyTelegram/generateUploadUrl/listMine) and `points.balance`/`history`; **removed the public `points.credit` mint** (creditHelper is internal-only). Verified: unauth call → "Not authenticated". *Remaining lower-severity read queries (leaderboard rank, referral count, some task queries) can get the same guard later.*
- [x] **Email OTP** — `resend-otp` provider (`convex/ResendOTP.ts`, generates 6-digit code, sends via Resend REST API — no SDK dep), `createOrUpdateUser` callback centralizes app-field defaults for all providers. Client: LoginScreen has Password | Email-code tabs (2-step: email → code). Needs `AUTH_RESEND_KEY` env (free Resend account). Backend deployed + typechecks; RN 0 errors.
- [x] **Sign in with Telegram** (free, deep-link bot flow) — `telegramNonces` table, `telegramAuth.*` (start/status/markVerified/consumeNonce), `TelegramProvider` (ConvexCredentials), bot webhook at `/telegram/webhook` (http.ts). Client: "Continue with Telegram" button opens the bot, polls the nonce, signs in on verify. Needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` env + webhook registration. Backend deployed + typechecks; RN 0 errors.
- [ ] Phone/WhatsApp OTP — WhatsApp needs Meta WhatsApp Cloud API (business account + approved auth template; free tier ~1k/mo). SMS is inherently paid. `otp-without-db` only generates codes, doesn't send.
- [x] Google OAuth — **backend provider wired** (`convex/auth.ts`, reads `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`). RN client: `GoogleAuthButton` component (Convex Auth `signIn('google')` flow), added to LoginScreen alongside Telegram. Android `build.gradle` has `appAuthRedirectScheme`. *Needs: Google Cloud OAuth client credentials set as Convex env vars (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`), `react-native-app-auth` dep, and a native rebuild.*
- [ ] Sidra Chain KYC login — `convex/sidraAuth.ts` scaffolded; needs Sidra's login SDK/token on the client
- [x] **Payout wallets (non-custodial)** — users set an EVM + Solana **address** in Profile to receive token rewards; no seed phrase / private key / custody. Server-side validation (`isEvmAddress`/`isSolanaAddress` in `@view2earn/core`, tested), stored on the user (`payoutEvm`/`payoutSolana`), `wallets.setPayoutWallet` mutation. *Treasury send-side (actually paying out SDA/tokens) is a later step.*

### Gated on third-party credentials
- [x] **Telegram channel-join verification live** (§7.3 / Tier 4) — `telegram.check` un-mocked: real `getChatMember` using `TELEGRAM_BOT_TOKEN` + the user's `telegramUserId` (persisted at Telegram sign-in) + the task's channel. Fails closed. *Bot must be an admin of each target channel.*
- [x] **Survey postback idempotency** — `pointsLedger.by_refId` index + dedup on `provider:txId` in `surveys.recordCompletion` (retries credit once). Verified live.
- [x] **AI screenshot vision** (§4 Tier 1) — `verifications.ts`: real multimodal vision verification via free Gemini 2.0 Flash REST API (`GEMINI_API_KEY`), checking page/account follow state & handle match. On quota limit (HTTP 429) or API error, automatically falls back to `ADMIN_REVIEW` queue. AI-approved screenshots release points instantly (`RELEASED`), saving storage costs.
- [~] **Survey provider — CPX Research** (§7.4) — offerwall URL (server-side md5 hash, `cpx.getOfferwallUrl`), S2S postback at `/survey/cpx` (GET, md5-verified, credits status=1 / debits reversal status=2, idempotent). Client: "Open survey wall" button in `SurveysScreen`. **Postback chain verified live** (valid hash → credit, bad hash → 403). *Needs a real CPX publisher account: set `CPX_APP_ID` + `CPX_SECRET` and configure the postback URL in CPX.*
- [x] **Ad network** (§7.6) — `RewardedAdModal.tsx`: Rewarded video ads integration using official Google AdMob Test Ad Unit IDs (`ca-app-pub-3940256099942544/5224354917` Android / `ca-app-pub-3940256099942544/1712485313` iOS), ban prevention test mode, promo tile in `TasksScreen`, and `ads.rewardForAd` mutation crediting +50 PTS to balance.
- [x] **VAS fulfillment** (§7.8b) — `vas.ts`: automated airtime & data bundle top-ups via Reloadly Topup REST API (`RELOADLY_CLIENT_ID` / `RELOADLY_CLIENT_SECRET`), dev sandbox mode, status callbacks in `http.ts`, and `refundRedemption` internal mutation that automatically refunds points back to the user's ledger on delivery failure.
- [ ] **AI quiz generation** — LLM-generated question banks (§7.5)
- [ ] Pi SDK login + payments (Pi web app) (§7.1)
- [ ] Sidra auth + wallet (native) (§7.1) — `auth.sidraAuth` scaffolded

### Hardening & launch (Plan Phases 6–7)
- [x] **Fraud scoring end-to-end** (§7.9) — `users.fraudScore` recomputed from stored signals (`fraudEvents` + verification outcomes).
- [x] **IP Reputation & VPN / Proxy Detection (Layer 3)** — `ipReputation.ts`: evaluates IP threat level (VPN, Proxy, Tor, Data Center subnet patterns or live IPQualityScore API), logs `ip-vpn-detected` fraud events, recomputes user `fraudScore` immediately, and restricts high-risk VPN connections during airtime redemptions.
- [x] Device fingerprinting — native composite (Layer 2): client `collectDeviceSignals` → server `deviceSignals.record` hashes ordered parts (`compositeFingerprint` in core), stores per (user, device), flags `device-cluster` when a fingerprint spans multiple users (clone-app catch). *canvas/WebGL web hashes come with the Pi web build.*
- [x] Behavioral impossible-speed (Layer 4) — claim→proof < 4s flags `impossible-speed` (`isImpossibleSpeed` in core, wired into `submitProof`).
- [x] Device-cluster is ecosystem-scoped — one Pi + one Sidra account on the same phone is legitimate (never flagged); only a 2nd account of the *same* platform is the clone/farm signal (`deviceSignals.record` filters by platform).
- [x] Fraud score/tier surfaced in admin panel — `fraudTier` (core) shown as a `RiskBadge` in the review queue and redemptions approval; both admin queries now return `fraudScore` + `fraudTier`.
- [ ] IP reputation + VPN detection (§7.9 Layer 3) — *gated: needs an IP-reputation API key + real client-IP capture via an httpAction*
- [ ] Layer 1 identity anchors — Pi UID uniqueness + SMS OTP — *gated on Pi auth + SMS provider (social-profile uniqueness already done)*
- [ ] Layer 5 economic containment — reduced new-account earn, OTP-gated redemption — *rate limits + fraud scoring already live; rest gated on OTP*
- [ ] Privacy Policy + ToS (lawyer-reviewed)
- [ ] Pi Developer Portal listing; testnet beta
- [ ] Play Store / App Store release builds

---

## ⚠️ Known dev shortcuts (swap before production)
- Verification hold is **60s** in dev (plan: 48h) — `verifications.ts`, `telegram.ts`
- AI vision is **mocked** (auto-approves at 0.92) — `verifications.aiCheck`
- Count-delta public-count source is **mocked** (returns claims) — `countDelta.ts`
- Admin auth is a **shared secret** (`ADMIN_PASSWORD`), not per-admin identity — upgrade to real auth (ctx.auth + roles) before scaling admins
- Email OTP uses Resend's `onboarding@resend.dev` sender (test-only) — verify a domain for real delivery (`ResendOTP.ts`)
