# Migration audit — Convex Cloud → self-hosted

Phase 1 of `CONVEX_MIGRATION_PROMPT.md`. No code was changed.

**Status today:** the cloud deployment `valuable-ostrich-597` answers `/version` but every
function call and HTTP action returns:

> You have exceeded the free plan limits, so your deployments have been disabled.

So this is a **usage limit**, not a ban or a ToS action. Snapshot export and `env list` still work.

**Rescue data already taken (2026-10-04):**

| Item | Where | Notes |
|---|---|---|
| Full snapshot | `convex-export-2026-10-04.zip` (repo root, gitignored) | 6.1 MB, 70 tables, **123 092 documents** |
| All 20 env vars | `.env.convex-backup` (gitignored) | names + values, for re-import |

Largest tables: `pointsLedger` 56 805 · `pendingSpins` 43 868 · `adWatchLogs` 8 498 ·
`xpTransactions` 2 668 · `verifications` 964 · `academyProgress` 716 · **`users` 321**.

---

## 1. Convex packages

One Convex package only, at the **repo root** (not `packages/backend` as the prompt assumed):

| Path | Contents |
|---|---|
| `convex/` | 60+ function modules, `schema.ts`, `crons.ts`, `http.ts`, `auth.ts` |
| `convex/_generated/` | generated API — regenerate after switching deployments |

Consumers (npm workspaces, root `package.json`): repo root React Native app,
`apps/wallet-app`, `apps/pi-app`, `apps/tg-app`, `apps/admin-panel`, `apps/website`,
`packages/core`.

## 2. Every place the backend URL is used

### Hardcoded `.convex.cloud` — must change (rule 7 violations)

| File | Line | Code |
|---|---|---|
| `src/config.ts` | 9 | `: 'https://valuable-ostrich-597.convex.cloud';` |
| `src/config.ts` | 11 | `CONVEX_SITE_URL = CONVEX_URL.replace('.convex.cloud', '.convex.site')` |
| `apps/wallet-app/src/config.ts` | 1 | `export const CONVEX_URL = 'https://valuable-ostrich-597.convex.cloud';` |

### `.cloud → .site` string rewriting — breaks on self-hosted (different ports, not a suffix)

| File | Line |
|---|---|
| `src/config.ts` | 11 |
| `apps/admin-panel/src/app/voice-notes/page.tsx` | 17 |
| `apps/admin-panel/src/app/videos/page.tsx` | 18 |

### Client construction

| File | Line | Source of URL |
|---|---|---|
| `App.tsx` (root RN) | 18 | `CONVEX_URL` from `src/config.ts` |
| `apps/wallet-app/App.tsx` | 12 | `CONVEX_URL` from `apps/wallet-app/src/config.ts` |
| `apps/pi-app/src/pi/convex.ts` | 6 | `process.env.NEXT_PUBLIC_CONVEX_URL` ✔ |
| `apps/admin-panel/src/app/providers.tsx` | 6 | `process.env.NEXT_PUBLIC_CONVEX_URL` ✔ |
| `apps/website/src/app/providers.tsx` | 6 | `process.env.NEXT_PUBLIC_CONVEX_URL` ✔ |
| `apps/tg-app` | — | builds `apps/pi-app` source, inherits ✔ |

### Site-URL consumers in app code (need a `CONVEX_SITE_URL` config value)

`src/screens/VoiceNotesScreen.tsx:77`, `src/screens/MentorVoiceScreen.tsx:48`,
`src/screens/CommunityVideosScreen.tsx:39-40`, `src/components/VoiceNoteList.tsx:39`,
`apps/admin-panel/.../voice-notes/page.tsx`, `apps/admin-panel/.../videos/page.tsx`.

### Build-time env files (change value only, no code)

`apps/pi-app/.env.local`, `apps/admin-panel/.env.local`, `apps/website/.env.local`
(`NEXT_PUBLIC_CONVEX_URL`), plus `.env.live` / `.env.local` at the root for the CLI.

> ⚠️ **Blocker for Phase 7, not fixable by this migration.** The Play Store build has the
> cloud URL compiled in (`src/config.ts`) and, per project history, **cannot receive OTA
> updates**. Existing Android users stay on the dead URL until they install a new Play Store
> release. Web apps (pi/tg/admin/website) only need an env change + redeploy.

## 3. Environment variables read in `convex/`

Names only. 20 are currently set on the cloud deployment; the ones marked ⬜ are read by code
but were never set (they take a fallback/simulation path).

| Var | Used in | Set? |
|---|---|---|
| `ADMIN_PASSWORD` | admin, inquiries, reports, visitors, http | ✅ |
| `ADSGRAM_REWARD_SECRET` | http (`/adsgram/reward`) | ✅ |
| `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM` | ResendOTP | ✅ |
| `JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL` | Convex Auth (implicit) | ✅ |
| `CLUBKONNECT_USER_ID`, `CLUBKONNECT_API_KEY` | vas | ✅ |
| `CPX_APP_ID`, `CPX_SECRET` | cpx, http | ✅ |
| `GEMINI_API_KEY` | quiz, verifications | ✅ |
| `PI_API_KEY` (alias `PI_API`) | piAds, piPayments, piDonations, piWithdrawalsPayout | ✅ |
| `PI_WALLET_PRIVATE_SEED` | piWithdrawalsPayout | ✅ |
| `STELLAR_PLATFORM_SECRET` | anchor | ✅ |
| `TELEGRAM_BOT_TOKEN`, `_USERNAME`, `_ADMINS`, `_WEBHOOK_SECRET`, `TELEGRAM_VOICE_CHANNEL_ID` | telegram, telegramAuth, voiceNotes, videos, http | ✅ |
| `CONVEX_SITE_URL` | `auth.config.ts:4` | platform-provided |
| `OPENAI_API_KEY` | quiz, verifications (fallback) | ⬜ |
| `IPQUALITYSCORE_API_KEY` | ipReputation | ⬜ |
| `SOLANA_RPC_URL` | http | ⬜ |
| `SIDRA_RPC_URL`, `SIDRA_EXPLORER_API_URL`, `SIDRA_MIN_CONFIRMATIONS` | sidra | ⬜ |
| `RELOADLY_CLIENT_ID`, `_SECRET`, `_SANDBOX` | vas (fallback provider) | ⬜ |
| `TELEGRAM_VIDEO_CHANNEL_ID` | videos | ⬜ |
| `PI_NETWORK` | piWallet | ⬜ |

## 4. Auth

**Convex Auth** (`@convex-dev/auth` 0.0.94), five providers in `convex/auth.ts`:

| Provider | Id | Used by |
|---|---|---|
| Password + email OTP | `password`, `resend-otp` | Android app |
| `TelegramProvider` | `telegram` | Telegram Mini App (`initData`) + Android deep-link link |
| `PiProvider` | `pi` | Pi Browser (`Pi.authenticate` → `/v2/me`) |
| `WalletHandoffProvider` | handoff nonce | wallet-app |

Needs on the new backend: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, and a correct
`CONVEX_SITE_URL` (read by `auth.config.ts:4` as the token issuer domain — **must equal the
public HTTP-actions origin**, i.e. the `site` domain, or every existing token is rejected).
Sessions: 90-day total / 30-day inactive. `authSessions` 336 rows, `authRefreshTokens` 4 768
rows are in the export, so users stay logged in **only if** the JWT keys and issuer are
carried over unchanged.

## 5. Crons, scheduler, HTTP, node actions, file storage

### Crons (`convex/crons.ts`) — 10 jobs

| Job | Interval | Calls/month |
|---|---|---|
| `scan-anchor-deposits` | **1 min** | ~43 200 |
| `scan-sidra-deposits` | **2 min** | ~21 600 |
| `recover-unclaimed-spins` | 1 h | 720 (scans 200 rows each) |
| `generate-pi-quiz-questions` / `-sidra-` | 6 h | 240 (each calls Gemini) |
| `count-delta-scan` | 12 h | 60 |
| `refresh-vas-plans` | 12 h | 60 |
| `purge-old-screenshots`, `recompute-fraud-scores` | 24 h | 60 |

### HTTP routes (`convex/http.ts`) — 9, all move to the new site domain

`/survey/postback` · `/vas/webhook` · `/telegram/webhook` · `/voice/file` · `/mentor/photo`
· `/video/file` · `/survey/cpx` · `/adsgram/reward` · `/wallet/verify-deposit`

### `"use node"` actions

`convex/anchor.ts` (Stellar SDK), `convex/piWithdrawalsPayout.ts` (pi-backend → stellar-sdk).
Both need the Node runtime, which self-hosted Convex supports.

### Scheduler

`ctx.scheduler.runAfter/runAt` used in verifications (AI check, hold release), piWithdrawals
(A2U payout chain), spin close-out. In-flight scheduled jobs are **not** in the export — any
pending hold/payout at cut-over must be re-triggered manually.

### File storage

22 `ctx.storage` call sites (task proof screenshots, voice notes, mentor photos, videos).
Export above does **not** include files — re-run with `--include-file-storage` before cut-over.

## 6. External services that must be re-pointed

| Service | What to change |
|---|---|
| Telegram bot | `setWebhook` → `https://<site>/telegram/webhook` |
| Adsgram | Reward URL → `https://<site>/adsgram/reward?userid=[userId]&key=…` |
| CPX Research | postback → `https://<site>/survey/cpx` |
| ClubKonnect / Reloadly (VAS) | callback → `https://<site>/vas/webhook` |
| Wallet deposit verifier | `https://<site>/wallet/verify-deposit` |
| Pi Developer Portal | no change (calls out, not in) |

## 7. Why the free plan blew up — ranked

> **Correction (Phase 6).** Reading `spin.ts` closely moved the hourly spin
> cron from #5 to the top. `recoverStalePendingSpins` used
> `.filter(q => q.eq(q.field("claimed"), false)).take(200)`, and in Convex
> `.filter()` is applied AFTER reading, not as an index. With 43 868 rows that
> are almost all claimed, each hourly run read most or all of the table —
> on the order of **1 M document reads per day**, with no user involved.
> Fixed in Phase 6 with a `["claimed", "createdAt"]` index plus retention.

1. **`leaderboard.topEarners` + `myRank` (highest cost by far).** Each loads
   `users.collect()` (321 docs) **plus one index query per user** — and
   `LeaderboardScreen` subscribes to both, so ~642 doc reads + 642 index queries per open.
   Worse, they are *reactive*: a write to **any** `users` row or **any** `pointsLedger` row
   invalidates and re-runs them for every connected client. With 56 805 ledger writes that is
   a continuous re-execution storm. **This alone can exhaust the 1 GB/month DB bandwidth.**
2. **`xp.myLevelProgress` (`convex/xp.ts:82`)** — `pointsLedger.withIndex("by_user").collect()`,
   i.e. a user's *entire* ledger history, on `HomeScreen` and `LevelScreen`, reactive, so it
   re-reads everything on every new row.
3. **`identity.cashOutStatus`** — same full per-user ledger `.collect()` (`identity.ts:40`),
   now on the wallet page and in every withdraw. Added 2026-09; recent contributor.
4. **High-frequency crons** — anchor (1 min) + sidra (2 min) ≈ 65 k calls/month, each an
   action doing outbound HTTP, running whether or not any deposit exists.
5. **`pendingSpins` never purged — 43 868 rows** (36 % of all documents). Pure storage, and
   `recoverStalePendingSpins` re-scans 200 of them hourly.
6. **`adWatchLogs` 8 498 rows** — append-only, no retention policy.
7. `admin.ts` has 16 `.collect()` calls; the admin dashboard pulls whole tables per page view.

Fixes for these belong to Phase 6 — nothing here is changed yet.

## 8. Gaps / decisions needed before Phase 4

- API domain and site domain (suggest `api.view2earn.org` and `site.view2earn.org`;
  `view2earn.org` is already a Cloudflare zone).
- InterServer VPS IP, and whether Cloudflare proxy stays **on** for those records
  (WebSocket works proxied, but the orange cloud adds a hop — grey cloud is simpler).
- SQLite (default, zero setup) vs Postgres. 123 k docs / 6 MB fits SQLite comfortably;
  Postgres only if you want point-in-time backups.
- Whether to pay Convex Pro for one month ($25) to bring the **live Android users** back
  online during the migration — self-hosting cannot rescue them without a Play Store release.

---

*Phase 1 complete. Say "continue" for Phase 2 (environment switching).*
