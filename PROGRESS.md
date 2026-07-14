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
- Modern design system (`theme.ts`) — tokens, shadows; floating tab bar; branded hero headers; unified scroll

---

## 🔭 Roadmap — remaining features

### Self-contained (no external keys required)
- [x] Trust-based verification sampling (§4 Stage 4)
- [x] Rate limits on claims / uploads / quiz / redemptions (§7.9 Layer 5)
- [x] Admin panel sign-in gate (password via `ADMIN_PASSWORD` Convex env; `AuthGate` + `admin.checkPassword`)
  - follow-up: per-function admin auth on `admin.*` mutations (currently the gate is UI-side; mutations are still directly callable — see TODO in `admin.ts`)
- [ ] Count-delta fraud-signal cron (§4 Tier 3)
- [ ] Qualified referral flow (§7.7) — *needs real auth to test (dev = one user/device)*
- [ ] Learn Pi / Learn Sidra academy (§7.11b) — leveled guides + quiz gates
- [ ] Spin wheel (variant of mystery box)

### Gated on third-party credentials
- [ ] **AI screenshot vision** (§4 Tier 1) — currently mocked at 0.92; needs a vision API key
- [ ] **Survey provider** postbacks — CPX / BitLabs, signed callbacks (§7.4)
- [ ] **Ad network** — AdMob / Unity rewarded video on Claim (§7.6)
- [ ] **VAS fulfillment** — Reloadly / DTone airtime & data, auto-refund on failure (§7.8b)
- [ ] **AI quiz generation** — LLM-generated question banks (§7.5)
- [ ] Pi SDK login + payments (Pi web app) (§7.1)
- [ ] Sidra auth + wallet (native) (§7.1) — `auth.sidraAuth` scaffolded

### Hardening & launch (Plan Phases 6–7)
- [ ] Five-layer fraud scoring end-to-end (§7.9)
- [ ] Device/browser fingerprinting (canvas/WebGL web, composite native)
- [ ] IP reputation + VPN detection (§7.9 Layer 3)
- [ ] Privacy Policy + ToS (lawyer-reviewed)
- [ ] Pi Developer Portal listing; testnet beta
- [ ] Play Store / App Store release builds

---

## ⚠️ Known dev shortcuts (swap before production)
- Verification hold is **60s** in dev (plan: 48h) — `verifications.ts`, `telegram.ts`
- AI vision is **mocked** (auto-approves at 0.92) — `verifications.aiCheck`
- Telegram membership check **mock-approves** (needs bot token + user TG id) — `telegram.check`
- Identity is **device-fingerprint** dev auth (plan: Pi/Sidra auth)
- Admin panel has **no auth**
