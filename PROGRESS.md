# View2Earn — Progress & Roadmap

Status tracker for the View2Earn build. Pairs with `View2Earn-Master-Plan-v2.4.md`
(plan sections referenced as §). Last updated: 2026-07-14.

---

## ✅ Completed

### Foundation (Plan Phase 1)
- React Native 0.86 app (Hermes) + Convex backend + CodePush OTA
- Convex schema with all core tables + indexes
- Append-only points ledger (`points.ts`): credit, balance, history
- Ecosystem guard middleware (`lib/guards.ts`)
- Dev identity — one user per device fingerprint (`lib/device.ts`, `users.ts`)
- Stack-over-tabs navigation (5 tabs + pushed screens)

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

### Fraud & Safety (Plan Phase 6, partial)
- **Trust-based verification sampling** (§4 Stage 4) — new users (< 10 tasks) 100% verified, trusted users sampled ~40% + auto-approved, fraud score ≥ 50 or recent fraud → 100% (`verifications.shouldVerify`)
- **Rate limits** (§7.9 Layer 5) — sliding-window burst guards on claims (12/min), uploads (10/min), quiz (5/min), redeem (5/5min) (`lib/ratelimit.ts`)

### Admin & Design
- Admin panel (Next.js): users, tasks, review queue, providers, redemptions, fraud, catalog
- Admin analytics dashboard — points economy (issued/spent/outstanding + payout-ratio vs 50% rule), user risk-tier distribution, fraud signals by type, 7-day new users, redemptions by status (`admin.getAnalytics`, CSS meters — no chart lib)
- Modern design system (`theme.ts`) — tokens, shadows; floating tab bar; branded hero headers; unified scroll

---

## 🔭 Roadmap — remaining features

### Self-contained (no external keys required)
- [x] Trust-based verification sampling (§4 Stage 4)
- [x] Rate limits on claims / uploads / quiz / redemptions (§7.9 Layer 5)
- [x] Admin panel sign-in gate (password via `ADMIN_PASSWORD` Convex env; `AuthGate` + `admin.checkPassword`)
  - [x] per-function admin auth on all `admin.*` functions — shared-secret `token` (the admin password) required on every call, checked server-side by `requireAdmin` (`admin.ts`); client injects it via `useAdminQuery`/`useAdminMutation` (`apps/admin-panel/src/app/useAdmin.ts`). Upgrade to real per-admin identity when a JWT provider exists.
- [x] Count-delta fraud-signal cron (§4 Tier 3) — 12h cron reads each active campaign's public count vs claimed follows; large shortfall → campaign fraud signal in `fraudEvents` (`countDelta.ts`, logic in `@view2earn/core`, count source mocked pending a real per-platform fetch)
- [ ] Qualified referral flow (§7.7) — *needs real auth to test (dev = one user/device)*
- [x] Learn Pi / Learn Sidra academy (§7.11b) — 3 leveled guides per ecosystem with a quiz gate each; pass ≥70% to unlock the next level + earn points once (badge = completed level). Content + gate logic in `@view2earn/core` (`academy.ts`), progress in `academyProgress`, backend `academy.ts` (`getAcademy`/`submitLevel`), UI `AcademyScreen.tsx` (entry from Profile). *Screen still needs an on-device pass.*
- [x] Spin wheel (variant of mystery box) — free once-a-day weighted spin; server picks the prize, UI reel animates to it. Prize table + `pickSpinIndex` in `@view2earn/core` (`spin.ts`), state in `dailySpins`, backend `spin.ts` (`getSpinStatus`/`spin`), UI `SpinScreen.tsx` (entry from Home). *Screen needs an on-device pass.*

### Auth — Convex Auth (email/password live; Google + Sidra KYC next)
- [x] **Reown/WalletConnect removed** — wallet is no longer login (becomes an in-app payout feature later: connect wallet to receive SDA + tokens). Deleted appkit/SIWE code, uninstalled the WC/ethers/noble stack (kills the cost).
- [x] **Convex Auth** (open-source, self-hosted, no per-user cost) — `authTables` + extended `users` table, Password provider with app-field defaults (`convex/auth.ts`), JWT keys set, `auth.addHttpRoutes` merged with existing webhooks, `users.me` query. Client: `ConvexAuthProvider` + AsyncStorage token storage (`App.tsx`), email/password `LoginScreen`, `useAuth()` maps the session to the user. Mock `getOrCreateDevUser` + `deviceFingerprint` **deleted**. Backend deployed + typechecks; RN app 0 typecheck errors.
- [x] **Security hardening** — `requireUser` now enforces `userId === Convex Auth session` (getAuthUserId), securing every function that calls it; added guards to `verifications.*` (claim/submitProof/verifyTelegram/generateUploadUrl/listMine) and `points.balance`/`history`; **removed the public `points.credit` mint** (creditHelper is internal-only). Verified: unauth call → "Not authenticated". *Remaining lower-severity read queries (leaderboard rank, referral count, some task queries) can get the same guard later.*
- [x] **Email OTP** — `resend-otp` provider (`convex/ResendOTP.ts`, generates 6-digit code, sends via Resend REST API — no SDK dep), `createOrUpdateUser` callback centralizes app-field defaults for all providers. Client: LoginScreen has Password | Email-code tabs (2-step: email → code). Needs `AUTH_RESEND_KEY` env (free Resend account). Backend deployed + typechecks; RN 0 errors.
- [x] **Sign in with Telegram** (free, deep-link bot flow) — `telegramNonces` table, `telegramAuth.*` (start/status/markVerified/consumeNonce), `TelegramProvider` (ConvexCredentials), bot webhook at `/telegram/webhook` (http.ts). Client: "Continue with Telegram" button opens the bot, polls the nonce, signs in on verify. Needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` env + webhook registration. Backend deployed + typechecks; RN 0 errors.
- [ ] Phone/WhatsApp OTP — WhatsApp needs Meta WhatsApp Cloud API (business account + approved auth template; free tier ~1k/mo). SMS is inherently paid. `otp-without-db` only generates codes, doesn't send.
- [~] Google OAuth — **backend provider wired** (`convex/auth.ts`, reads `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`). Needs: (1) Google Cloud OAuth client + those env vars, (2) the RN OAuth redirect flow (browser + deep-link callback) + a "Continue with Google" button.
- [ ] Sidra Chain KYC login — `convex/sidraAuth.ts` scaffolded; needs Sidra's login SDK/token on the client
- [ ] Wallet payout (receive SDA + tokens) — connect-wallet-to-auto-fill address; non-Reown method TBD

### Gated on third-party credentials
- [ ] **AI screenshot vision** (§4 Tier 1) — currently mocked at 0.92; needs a vision API key
- [ ] **Survey provider** postbacks — CPX / BitLabs, signed callbacks (§7.4)
- [ ] **Ad network** — AdMob / Unity rewarded video on Claim (§7.6)
- [ ] **VAS fulfillment** — Reloadly / DTone airtime & data, auto-refund on failure (§7.8b)
- [ ] **AI quiz generation** — LLM-generated question banks (§7.5)
- [ ] Pi SDK login + payments (Pi web app) (§7.1)
- [ ] Sidra auth + wallet (native) (§7.1) — `auth.sidraAuth` scaffolded

### Hardening & launch (Plan Phases 6–7)
- [~] Fraud scoring end-to-end (§7.9) — `users.fraudScore` now computed from stored signals (recent `fraudEvents` + rejected/released/cancelled verification outcomes) via `computeFraudScore` in `@view2earn/core`; recomputed inline on each new signal (admin fraud event, admin reject, count-delta flag) and swept daily (`fraud.recomputeAll` cron). Closes the loop into `verifications.shouldVerify` (score ≥ 50 → 100% verify). *Remaining layers (device fingerprint, IP/VPN) still pending — those need client signals / a third-party API.*
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
- Telegram membership check **mock-approves** (needs bot token + user TG id) — `telegram.check`
- Identity is **device-fingerprint** dev auth (plan: Pi/Sidra auth)
- Admin auth is a **shared secret** (`ADMIN_PASSWORD`), not per-admin identity — upgrade to real auth (ctx.auth + roles) before scaling admins
