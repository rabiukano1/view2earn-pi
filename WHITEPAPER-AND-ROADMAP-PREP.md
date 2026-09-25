# Whitepaper & Roadmap — Prep Checklist

Internal working doc. Nothing here is published as-is.
Created: 2026-09-22. Pairs with `View2Earn-Master-Plan-v2.4.md`, `PROGRESS.md`,
`ADMOB_COMPLIANCE_AND_MODERATION.md`, `view2earn-wallet-project.md`.

**Rule for this project: two layers.**
- **Public** = whitepaper + roadmap. Ad-network strategy is one neutral sentence. No network named, no policy talk, no money language.
- **Internal** = this file. The real ad plan, gates, numbers, and known gaps live here only.

---

## A. Reconcile the stale facts (do this first — both docs depend on it)

- [ ] **App list.** Master Plan says `pi-web / sidra-mobile / admin-panel`. Repo has
      `pi-app, pi-testnet, tg-app, wallet-app, media-editor, website, admin-panel` + the RN root app.
      Decide per app: shipping product / experiment / kill. The whitepaper only describes shipping products.
- [ ] **OTA path.** Plan says CodePush; `package.json` has `expo-updates`; the live Play Store build
      cannot receive OTA at all. Write the real update path per app.
- [ ] **Convex environment.** Real users are on the **dev** deployment. Decide: migrate to a prod
      deployment (with a data-migration plan) or formally declare dev = prod. Do not publish either way.
- [ ] **Dev shortcuts still in code** — each is either a dated roadmap item or an accepted decision:
      - Verification hold `HOLD_MS = 60 * 1000` in `convex/verifications.ts:25` (plan says 48h; there is a `TODO(prod)` on line 24).
      - Count-delta public-count source still mocked (`countDelta.ts`).
      - Admin auth is a shared secret (`ADMIN_PASSWORD`), not per-admin identity.
      - AdMob **test** ad unit IDs still in `RewardedAdModal.tsx`.
- [ ] **PROGRESS.md self-contradictions — resolved, now fix the file:**
      - *AI vision*: NOT simply "mocked". `verifications.ts:292` uses a real Gemini call when
        `GEMINI_API_KEY` is set, and falls back to a 0.92 auto-approve mock when it is not (line 297).
        Correct wording: "live, env-gated; dev fallback auto-approves when no key."
      - *IP reputation*: same shape. `ipReputation.ts` always runs a subnet/pattern heuristic, plus a live
        IPQualityScore call when `IPQUALITYSCORE_API_KEY` is set (line 52). Not "gated / not done".
      - Remove the duplicate `[ ]` rows that repeat completed `[x]` items.
- [ ] **PROGRESS.md is dated 2026-08-07.** Refresh against git log before using it as the roadmap baseline.
- [ ] **ADMOB_COMPLIANCE doc contradicts itself** — matrix rows read "100% Compliant" next to open
      gaps listed in its own correction section. Fix before it backs anything public.
- [ ] **Inventory current ad integrations** (internal reference, not published):
      AdMob (`convex/ads.ts`, `src/services/admobService.ts`, `RewardedAdModal.tsx`),
      Adsgram for Telegram (`convex/adsgram.ts`, `apps/pi-app/src/pi/adsgram.ts`),
      Pi Ads with server-side re-verification (`convex/piAds.ts`).
      Placements: `ComboTracker`, `DailyBox`, `StreakCard`, `SpinScreen`, `TasksScreen`,
      pi-app `home` / `quiz` / `spin`. Config lives in the `providers` table + `platformSettings`.
      **No placement or feature is being removed.**

---

## B. Decisions to lock before writing the roadmap

- [ ] **Launch ecosystem** — Pi first, Sidra first, or both? Pi SDK login/payments and Sidra auth are both
      still open. Pick one; the other becomes a later phase.
- [ ] **Wallet project in or out?** Multi-token deposits/withdrawals is a different legal category
      (money transmission / VASP) than points-for-airtime. Decide before it appears in anything public.
- [ ] **Third-party accounts with approval lead times** — these date the roadmap, not your effort:
      CPX publisher account, real AdMob ad units, Reloadly production, IPQualityScore,
      Meta WhatsApp Cloud API, Pi Developer Portal listing, Sidra SDK access.
- [ ] **Budget** — treasury for token payouts, Reloadly float, paid tiers for Convex / Resend / Gemini.
- [ ] **Team** — who ships what. Solo means fewer parallel tracks and a longer roadmap.
- [ ] **Milestone definitions** — what "beta", "public launch", "v1.0" mean in measurable terms.
- [ ] **Roadmap format** — dated quarters (Q4 2026, Q1 2027…), not "Phase 6/7". Columns:
      **Now · Next · Later · Exploring.**
- [ ] **Ad-infrastructure gate metric** (internal): 1M **MAU**, fraud-adjusted (users at `fraudTier` ≤ medium),
      not 1M registered. Registered counts are inflated in reward apps. Never published.

---

## C. Facts to gather before writing the whitepaper

- [ ] **Problem + target user.** Master Plan §1 has the product but not the *why* or the audience
      (which countries, why data/airtime is the right reward there).
- [ ] **Points economics** — earn rates, daily caps, points→bundle rate, referral, streak/spin/box tables.
      Pull the real constants from `packages/core`; do not invent numbers.
- [ ] **"Points are not money"** — Master Plan rule. Enforce this wording everywhere in the paper.
- [ ] **Verification & anti-fraud** — §4 four tiers + the fraud layers, described at a level that does not
      hand cheaters the playbook. No thresholds, no exact rules, no cooldown values.
- [ ] **Architecture diagram** — one honest diagram of what exists today.
- [ ] **Data & privacy** — what is stored (screenshots with 14-day purge, device fingerprints, IPs,
      Telegram IDs), retention, jurisdiction. Must match the 4 policy files; reconcile them first.
- [ ] **Legal** — Privacy Policy + ToS still need review. Nothing in the paper may exceed what the ToS says.
      Entity name, country of incorporation, contact address.
- [ ] **Pi / Sidra ecosystem rules** — read both before writing the chain sections.
- [ ] **Traction numbers** — real figures from the Convex dashboard, or omit. No projections without a
      stated model.
- [ ] **Advertising paragraph** — neutral, see §E.
- [ ] **Audience** — Pi community / investors / partners. Changes tone, length, and whether tokenomics
      appears at all.

---

## D. Document structure

**Roadmap** — 1–2 pages, public. Columns Now / Next / Later / Exploring.
One line per item, a status, and the external dependency when gated.

**Whitepaper** — 10–15 pages:
1. Abstract · 2. Problem · 3. Solution & user journey · 4. Points model · 5. Verification & trust ·
6. Architecture · 7. Ecosystems (Pi / Sidra) · 8. Privacy & compliance · 9. Roadmap summary ·
10. Team & entity · 11. Disclaimers.

---

## E. Ban-safe writing rules (whitepaper, roadmap, website, store listings)

### Never appears in a public document
- Any ad network named as an obstacle. No policy critique of any named company.
- Any claim users are **paid**, get **revenue share**, or earn **money / cash** for watching ads.
  Avoid in this context: cash, income, payout, earnings per ad, % of ad revenue.
- Per-ad reward amounts, CPM / eCPM, projected ad revenue.
- Incentivized-traffic marketing language: "watch ads to earn", "get paid to view", "ad farming".
- Ad unit IDs, publisher ID, `app-ads.txt` contents, ad screenshots.
- Fraud thresholds, caps, cooldowns, or how verification decides.
- Comparative claims about other networks' pricing or fill rates.
- **Rewarded ads and airtime/data redemption in the same paragraph.** Both facts are already public in
  the policies; never present one as the cause of the other.

### Use instead
- "Users earn points through engagement activities, including optional rewarded video."
- "Points are an in-app virtual reward redeemable for in-app rewards and bundles. Points are not a
  currency and have no cash value."
- "All advertising is user-initiated and opt-in."
- Ad infrastructure, entire public mention: *"We plan to expand our advertising infrastructure to better
  connect brands with an engaged audience."* No timeline, no comparison, no gate.

### Roadmap line for the ad track (the only public version)
> **Advertising infrastructure** — advertiser tooling for our own properties. *Exploring.*

### The line that matters
Omitting future plans from a public paper is normal business practice. Describing current behavior
differently from how the app actually behaves is not — if a network audits, a mismatch is far worse than
silence. Everything above keeps the docs on the silence side, never the contradiction side.

---

## F. Ad network — internal strategy (never published)

**Thesis.** Users get little from ads today, and network policies constrain rewarding them.
Long-term: run our own demand so watching has value for the viewer.

**⚠️ SUPERSEDED IN PART — read §J first.** The SidraStart project (approved, in build) **is** the
ad network, built as a separate Sharia-compliant platform on Sidra. The gate below no longer applies to
it. What remains true here: the seven cautions, and the rule that the utility apps keep their existing
networks untouched.

**Phases (revised)**
1. **Utility apps — unchanged, indefinitely.** AdMob + Adsgram + Pi Ads stay exactly as they are in the
   Android app, `pi-app`, `tg-app`. No placement or feature removed. No gate, no migration planned.
2. **Sidra platform (§J)** — our own ad network, built now, as the SidraStart deliverable. Separate
   brand, separate repo, separate ad inventory. Does not touch the utility apps.
3. **Publisher SDK** — still later, still a separate company-sized product (caution 6 below).

**Already built and reusable**
`providers` table (add a priority field for mediation) · `adCompletions` replay guard ·
server-side ad verification pattern in `piAds.ts` · fraud stack (device clustering, IP reputation,
impossible-speed, fraud score) · admin moderation pipeline.
Missing: the demand side (advertisers, campaigns, billing) and the publisher side (SDK, payouts).

**Seven things to settle before building anything**
1. **Incentivized CPM pays badly.** Advertisers buy outcomes, not eyeballs. Sell CPA / CPI (installs,
   sign-ups — already running via tasks and CPX) or measured attention (quiz-after-ad, already built).
   A rewarded *outcome* network is defensible; a rewarded *display* network is not.
2. **Store policies still apply.** Play and App Store ad rules govern any ad in the app, own network or
   not. Own demand removes one set of constraints, not the store's content and disclosure rules.
3. **Fraud becomes ours to eat.** Today the network absorbs invalid traffic; with own demand, advertisers
   charge back. Need a viewability standard (≥50% visible, ≥2s / video completion) and an advertiser-facing
   invalid-traffic report.
4. **Billing.** Advertiser prepay, invoicing, VAT / withholding, advertiser KYC, publisher payout
   thresholds and rails per country. Pi-denominated buys add volatility and ecosystem constraints.
5. **Legal.** Advertiser ToS, publisher ToS, ad content policy, and a privacy-policy update — running
   own ads makes us a data controller for ad purposes (consent, no cross-app tracking without it, ATT).
6. **The SDK is a company-sized product.** Versioned Android / iOS / RN / web packages, rendering,
   viewability, offline queueing, docs, support, and other developers' fraud becoming ours. Sequence:
   advertiser dashboard on our own properties → prove fill and price → only then an SDK.
7. **Fill rate.** Even at the gate there will be empty slots. Mediation: own demand first, existing
   networks as backfill. The `providers` table already models this.

**To fill in before the dashboard is designed**

| Item | Decision |
|---|---|
| Formats at launch | |
| Pricing model (CPM / CPV / CPA / CPI) | |
| Currency (fiat / Pi / both) | |
| User reward per view | |
| First advertisers (own projects — which) | |
| Launch inventory (RN app, pi-app, tg-app, website?) | |
| Gate metric | 1M fraud-adjusted MAU (proposed) |
| Publisher SDK phase + platform order | |
| Min advertiser spend / min publisher payout | |
| Ad content policy (what we refuse) | |

**Recommendation.** Build rewarded *outcome* ads (CPA / CPI / attention) on our own properties first.
Skip the display network and the third-party SDK until the advertiser dashboard has paying customers.

---

## G. Compliance gaps to clear (from ADMOB_COMPLIANCE_AND_MODERATION.md)

All placements stay. These are open items in that doc — worth clearing because a public whitepaper
raises visibility.

- [ ] **A3 — consent-blind ad init.** `mobileAds().initialize()` runs regardless of consent state.
      Gate it on `AdsConsent.getConsentInfo().canRequestAds` (`src/services/admobService.ts`). *Cheapest real fix.*
- [ ] **A2 — privacy policy names no ad partner.** Says "advertising partners" only; needs the Google
      ad-tech disclosure + link for EEA / UK and California (`packages/core` privacy + website).
- [ ] **A5 — rewarded integrity is client-side** (`isEarnedReward`). Server-side verification is the
      recommended hardening; the pattern already exists in `convex/piAds.ts`.
- [ ] **A4 — iOS ATT prompt not presented.** The `Info.plist` string exists but nothing calls
      `requestTrackingPermission()`. Blocks App Store release.
- [ ] **A1 — marketplace URL allowlist missing.** `createListing` only rejects an empty `targetUrl`;
      admin review is the sole control over user-submitted links.

---

## H. Order of work

1. **§A reconcile** — read code + git log, then fix `PROGRESS.md` and the compliance doc. Half a day.
2. **§G A3 + A2** — the two cheap real-risk fixes.
3. **§B decisions** — then write the roadmap (short, dated, four columns).
4. **§C facts** — then write the whitepaper, pulling from Master Plan §1, §4, §7.
5. **§G A5, A4, A1** — before store release.
6. **§F** stays internal and untouched until the gate.
7. **§I** — resolve the four SidraStart blockers, then build the Sidra web app as plain EVM
   (does not depend on SidraStart resuming).

---

## I. Sidra / SidraStart — status, requirements, and the build plan

### I.0 Structure — read this first, it governs everything below

**The SidraStart project is a NEW, SEPARATE web app.** It is not the Android app, not `pi-app`,
not `tg-app`, not the website. Those existing apps are **project utilities** — revenue surfaces for us
and earning surfaces for users. They are not the SidraStart deliverable and are not submitted for review.

**The only shared thing is the backend.** One Convex deployment serves everything: points ledger,
fraud stack, VAS fulfillment, rewards catalog, admin panel. The new Sidra app is a new frontend on that
same backend, with its own repo, its own identity, and its own compliance surface.

```
                    ┌──────── Convex backend (ONE) ────────┐
                    │  points · fraud · VAS · rewards · admin │
                    └───┬──────────┬──────────┬──────────┬───┘
                        │          │          │          │
   ┌────────────────────┴──┐  ┌────┴────┐ ┌───┴────┐ ┌───┴──────────────┐
   │  NEW Sidra web app    │  │ Android │ │ pi-app │ │ tg-app / website │
   │  ← SidraStart project │  │   app   │ │        │ │                  │
   │  public repo, Sharia- │  │  ← utilities: income for us + users     │
   │  compliant, EVM       │  │     (NOT part of the SidraStart review) │
   └───────────────────────┘  └─────────┘ └────────┘ └──────────────────┘
```

**Why this structure is strong:** it resolves three conflicts at once.
- The **Sharia constraint** applies to the new app only — the Android app keeps spin, mystery box, and
  everything else untouched.
- The **public-repository requirement** is satisfied by a new public repo containing only the new app —
  the monorepo (`view2earn-pi`, with the fraud logic) stays private.
- **One backend** means the new app inherits a working points ledger, fraud stack, and fulfillment on
  day one instead of rebuilding them.

**Web3 positioning.** The project is Web3: value accrues to users for attention, engagement and
participation rather than being captured entirely by platforms. Keep that framing in the whitepaper —
but as *product philosophy*, never as a financial promise (see §E).

### I.1 Situation

Our project sits "under review" on SidraStart. SidraStart is not operating normally and there is no
announced date for review to resume or for token distribution. Public info in Sept 2026 is community
chatter and price speculation, not official timelines — treat every date you see as unverified.

**Consequence:** SidraStart is a *distribution and equity* channel, not a *technical* dependency.
Build the new Sidra app so it runs with or without SidraStart, and keep it dark until we choose to open it.

### I.2 What SidraStart requires (from sidrastart.com/about — re-verify, rules change)

| Requirement | Our status | Action |
|---|---|---|
| **Sharia-compliant, verified by their Sharia board** | ⚠️ design constraint on the new app — see I.3 | Decide the new app's reward model first |
| **Team members from at least 5 different countries** | ❌ unknown / likely not met | **Hard gate.** Recruit, or don't list |
| **All key roles filled** (PM, devs, etc.) | ❌ unknown | Name the roles and who fills them |
| **Digital-only — no physical products, inventory, or offline activity** | ✅ new app is software only | Keep airtime/data fulfillment in the utility apps, not the listed project, unless confirmed acceptable |
| **All deliverables verifiable through public repositories** | ✅ solved by structure — see I.4 | New public repo for the new app only |
| **Regular proof-of-work updates on the platform** | ❌ not started | Needs real commits in the public repo; assign an owner |
| **Minimum 2,000 SDA in contributions before the deadline** | ❓ | Know the number before starting the 60-day window |
| **60-day launch/promotion window** | — | Don't start it until the app is demo-ready |
| **Equity split is fixed by the platform:** Sidra Holding 16.5% · SDA investment 16.5% · cash investment 33% · team 34% | ⚠️ | Listing costs 66% of the *listed project* — a reason to keep it separate from the utility apps |
| External wallets not linked to a SidraStart profile are excluded from equity distribution | — | Note for any SDA we hold |

**The separation protects the business.** Because the listed project is only the new app, the 66% equity
dilution applies to that project — not to the Android app, `pi-app`, or the ad/VAS revenue. Confirm this
reading with SidraStart in writing before committing; if they treat the whole company as the project,
that changes the decision entirely.

### I.3 Sharia compliance — now a design input, not a blocker

A Sharia board reviews for *maysir* (gambling / chance-based gain) and *gharar* (excessive uncertainty).
**Build the new app deterministic from day one** — no spin wheel, no mystery box, no chance-based prize.
Rewards are fixed and effort-based: complete X, receive exactly Y. This is easier than retrofitting, and
it is genuinely a better fit for the Sidra audience.

**The existing apps change nothing.** Spin (`convex/spin.ts`), mystery box (`convex/bonus.ts`), and the
ad-granted bonus spin stay exactly as they are in the Android app and `pi-app`. They are separate
products and are not submitted for review.

- [ ] **Open question to settle with SidraStart / the board:** does the review scope cover only the listed
      project, or the whole team/company? Shared backend and shared branding are visible. If scope is
      company-wide, consider distinct branding for the Sidra project.

### I.4 Public repository — solved by the structure, with two cautions

New **public** repo = the new Sidra app only. The monorepo `view2earn-pi` (currently private, remote
`github.com/rabiukano1/view2earn-pi.git`) stays private and keeps `convex/fraud.ts`, `deviceSignals.ts`,
`ipReputation.ts`, `countDelta.ts` out of public view.

Two things to get right:
- [ ] **Do not publish the `convex/` directory** in the public repo. The public app calls the backend over
      the network; it does not need the function source. Publish the frontend + docs only.
- [ ] **A public app pointing at a Convex *dev* deployment is a real problem** (see §A). Migrate to a
      production deployment before the new app is public. This promotes the dev-vs-prod decision from
      "someday" to a dependency of the SidraStart listing.

### I.5 Good news: the technical integration is smaller than the plan assumes

Sidra Chain is **EVM-compatible**. We do not need a proprietary SDK to ship a Sidra web app:

- Chain ID **97453** (`0x17cad`)
- RPC **https://node.sidrachain.com/**
- Explorer **https://ledger.sidrachain.com**
- Gas / native token **SDA**

That means standard EVM tooling works, and the **shared backend already has the pieces**:
- `payoutEvm` address field on the user + `isEvmAddress` validation (`convex/wallets.ts`, `packages/core`).
- Ecosystem guard (`requireEcosystem`) keeping SIDRA users and PI users strictly separate on one backend.
- Points ledger, rewards catalog, fraud stack, admin panel — all reusable without change.

**Revise the Master Plan §2 assumption.** It says `sidra-mobile` (React Native) with a "Sidra wallet".
Wrong on both counts now: the SidraStart deliverable is a **new web app in its own public repo**, not a
mobile app inside the monorepo, and no custom wallet is needed — users supply a Sidra (EVM) address.
The Android app is a separate utility product and stays where it is.

### I.6 Known defect to fix before the Sidra app goes live

`convex/sidraAuth.ts` **creates the user first and verifies the Sidra token afterwards**
(`ctx.scheduler.runAfter(0, internal.sidraAuth.verifySidraToken, …)`). Anyone could create a SIDRA
account with a fabricated token and use it during the verification gap. Verify before insert, or create
the account in an unverified state that cannot earn or redeem. Harmless today only because the client
never calls it.

### I.7 Build plan — build it complete, keep it dark, integrate when allowed

Everything here works without SidraStart. Nothing here is announced publicly.

1. **Define what the new app actually *is*.** Not yet decided, and it blocks everything else.
   It shares a backend with the utilities but needs its own reason to exist and its own user value.
   Write one paragraph before writing code.
2. **Fix I.6** (verify-before-create in `sidraAuth.ts`).
3. **New public repo** — new Next.js app, `ecosystem: "SIDRA"` throughout, zero Pi code, zero
   chance-based mechanics, `convex/` not published.
4. **Backend: extend, don't fork.** Same Convex deployment. Add Sidra-specific functions behind
   `requireEcosystem(ctx, userId, "SIDRA")`. No second backend — that is the whole point.
5. **Auth without a Sidra SDK** — ship with what already works: email/password, email OTP, Telegram.
   Add Sidra KYC login later *if* they publish an SDK. Do not block the build on it.
6. **SDA payouts** — user supplies a Sidra (EVM) address; validate with the existing `isEvmAddress`;
   treasury send-side stays off until there is a funded treasury.
7. **Payments in SDA** — standard EVM transfer to a project address, confirmed on-chain via the RPC
   *before* anything is delivered (Master Plan §7.8 rule). Never trust a client claim — same pattern as
   `piAds.ts`.
8. **Feature-flag the whole app** (`providers` / `platformSettings`) so it ships dark and flips on when
   we choose — including if SidraStart never resumes.
9. **Convex prod migration** (§A) — now a dependency of this app, not an optional cleanup.

### I.8 What to review before starting

**About the listing**
- [ ] Confirm the requirement list above against your SidraStart project dashboard — login-only content
      may add rules the public page omits.
- [ ] Get the review status in writing from Sidra support; ask specifically whether reviews are paused
      and whether submitted projects keep their queue position.
- [ ] **Confirm the review scope in writing:** the listed project only, or the whole team/company?
      This decides whether the utility apps' mechanics matter and whether branding must be separate.
- [ ] Confirm the 66% equity applies only to the listed project.
- [ ] **5-country team** — the one requirement we cannot code around. Can we meet it? If not, the listing
      is off and everything below becomes an ordinary Sidra dApp (which needs no listing).

**About the build**
- [ ] Write the one paragraph in step 1: what the new app does and why a user opens it.
- [ ] Verify RPC and chain ID against official Sidra docs before writing chain code — third-party lists
      go stale.
- [ ] Confirm whether a Sidra KYC login SDK exists publicly today; if not, stop planning around it.
- [ ] Decide what goes in the public repo and confirm `convex/` stays out.
- [ ] Decide dev-vs-prod Convex (§A) — blocking for a public app.

**About the documents**
- [ ] Recommended: whitepaper describes Sidra support as planned, names no dates, and does not mention
      the SidraStart review status at all. The Web3 framing is product philosophy, never a financial
      promise (§E).

---

## J. The Sidra ad platform — approved SidraStart project, build spec

**Status:** approved / in build. Project page:
`https://www.sidrastart.com/project/9a5e1b4c-ce7e-4087-89bd-a21b2f536709`
(client-rendered — re-read requirements from the dashboard, a fetch returns nothing).

**Published description (the commitment we now have to deliver):**
> An online platform that empowers social media users to earn tokens through engagement with ads.
> Using a Sharia-compliant advertising system, users watch ads tailored to their preferences and
> receive tokens as rewards. Only approved, compliant advertisements are displayed. Advertisers gain
> authentic engagement and assurance their ads reach the intended audience; users receive tangible
> rewards that hold real value.

### J.1 What this actually is

**This is the ad network from §F, built now.** Not gated on 1M users, not built inside the Android app.
It is a separate two-sided platform: advertisers buy compliant, targeted, verified attention; users are
paid in tokens for giving it. The utility apps are unaffected and keep their existing ad networks.

Four commitments are load-bearing, and each is a build requirement:
1. **Sharia-compliant** — both the ads and the earning mechanism.
2. **Only approved ads displayed** — a real review pipeline, not a policy page.
3. **Tailored to preferences** — targeting, therefore user profiling, therefore consent.
4. **Authentic engagement / real value** — fraud control is the product, not a feature.

### J.2 The one conflict to manage — §E language vs this project's public page

The project page says users "earn tokens" and receive "rewards that hold real value". That is exactly the
language §E bans from the *Android app's* whitepaper, store listing and website, because ad-network
reviewers do look at a publisher's associated sites and brands.

Manageable, not fatal — they are genuinely different products. Keep them visibly separate:
- [ ] Separate brand name and domain for the Sidra platform. Do not reuse the View2Earn marks.
- [ ] Do **not** link the Sidra platform from the Android app, its store listing, or its privacy policy.
- [ ] Do **not** link the Android app from the Sidra platform.
- [ ] **Bright line that must never be crossed:** no screen may serve a third-party network ad and pay a
      token for that same view. One surface, one ad source. Ever.
- [ ] Keep the §E rules in force for the View2Earn whitepaper/roadmap regardless of what the
      SidraStart page says.

### J.3 The token — DECIDED: points swap to VINTA

**Model:** users earn points; points swap to **VINTA**, a platform token with real value.
**Reason points exist:** they are the compliance layer. Virtual currency earned from rewarded ads is
permitted by ad networks; paying cash for ad views is not.

#### The part that makes it work (and the part that does not)

**A points layer by itself does not create compliance.** Networks judge substance, not labels. If points
earned from an AdMob-rewarded view can be swapped to VINTA and withdrawn, then AdMob views pay real
money — the intermediate hop changes nothing.

**What does create compliance is the separation already built into this codebase.** `pointsLedger.economy`
tags every row, the surface is derived server-side from the auth session and cannot be flipped by a
client (`lib/guards.ts`), and `schema.ts` already states the rule outright:

> `"android"` — private in-app PTS (tasks, quiz, spin, surveys, **AdMob rewarded ads**, …).
> **NOT withdrawable.**

**So the rule is, and must stay:**

> **Points earned on a surface that serves third-party network ads never convert to VINTA, SIDRA, PIPRO,
> or anything else of value. Convertible points come only from surfaces we control end to end —
> the Sidra ad platform, and any surface with no third-party ad network on it.**

#### 🔴 Defect: the code currently breaks this rule

`wallets.requestWithdrawal` funds **SIDRA withdrawals from whatever economy the session is on**,
including `"android"`:

```ts
await appendLedger(ctx, userId, economy, -pointsDebited, "SIDRA_WITHDRAWAL", addr);
...
else if (economy === "android") await ctx.db.patch(wallet._id, { pointsBalance: pointsAfter });
```

Android-economy points — the ones the schema declares "NOT withdrawable" and which include AdMob
rewarded-ad credits — are withdrawable as SIDRA today. This is precisely the exposure the points layer
was meant to prevent.

- [ ] **Fix:** reject withdrawals funded from the `android` economy (and from any future surface carrying
      third-party ads). One guard in `requestWithdrawal`, since every asset routes through it.
- [ ] Then decide deliberately which surfaces *are* convertible, and write it in `schema.ts` next to the
      economy comment so code and intent stay together.

#### 🔴 Defect: every wallet is seeded with 100 VINTA

`getOrCreateWalletDoc` sets `vintaBalance: 100`, and the withdrawal path reads `wallet.vintaBalance ?? 100`.
VINTA withdraws 1:1. Every new account therefore starts with 100 units of a real-value token, and an
undefined balance is treated as 100.

- [ ] **Fix before VINTA has any value:** seed `0`, and default `?? 0` everywhere. Decide what happens to
      balances already seeded.

#### Still open

- [ ] **Where VINTA's value comes from.** Advertiser SDA spend is the only real inflow. Model it:
      advertiser pays SDA, platform takes a margin, user receives VINTA. If rewards are not funded by
      advertiser spend, the model is a subsidy with an end date.
- [ ] **Supply and emission** — total supply, VINTA per verified view, caps, and the points→VINTA rate
      (fixed or floating). Write it down before the first token is issued.
- [ ] **The swap itself** — rate source, who can call it, rate-limit, and an audit row per swap. Idempotent
      via the existing `pointsLedger.by_refId` pattern.
- [ ] **Legal** — paying users a token with promised real value invites securities, AML and consumer
      protection questions. Advice before launch, not after.
- [ ] **Sharia on the reward** — deterministic and known in advance: a fixed rate per verified view.
      No chance, no variable jackpot. Note this also rules out funding VINTA from spin/mystery-box wins.
- [ ] **Does SidraStart require the reward to be their project token** rather than VINTA?

### J.4 What has to be built — advertiser side (this is the new work)

None of it exists yet. It is the bulk of the project.

- [ ] Advertiser signup + KYC/AML (SidraStart requires it, and it gates fraud from the demand side).
- [ ] Campaign creation: creative upload, targeting by user preference category, budget, schedule.
- [ ] **Deposit and billing in SDA** — on-chain payment confirmed via RPC before a campaign goes live.
- [ ] Budget pacing + spend ledger; refunds for invalid traffic.
- [ ] Advertiser reporting: impressions, verified views, completion rate, invalid-traffic deductions.
- [ ] Campaign pause/stop, and a hard stop when budget is exhausted.

### J.5 Sharia compliance pipeline (the differentiator — build it properly)

- [ ] **Written ad content policy.** Name what is refused: alcohol, pork, gambling/betting,
      interest-based finance (riba), conventional insurance, adult content, deception. Publish it.
- [ ] **Mandatory pre-display review.** Reuse the existing moderation pattern — `pending_approval` to
      `active`, already implemented for marketplace listings in `convex/admin.ts`. Nothing serves before
      a human approves it.
- [ ] **Sharia board sign-off workflow** — who approves, what evidence is recorded, how a decision is
      appealed. Store decision + reviewer on the campaign record for audit.
- [ ] **Advertiser attestation** at submission, with account termination for false attestation.
- [ ] **User report button** on every ad, plus a takedown path.
- [ ] Periodic re-review of long-running campaigns — creative swap is the usual evasion.

### J.6 User side

- [ ] **Preference selection** — explicit, opt-in categories. This is the "tailored" promise and also the
      consent record. No inferred profiling without consent.
- [ ] Ad feed / watch surface, user-initiated only.
- [ ] **Server-verified view** then fixed token reward. Never trust the client — the pattern already
      exists in `convex/piAds.ts`, copy it.
- [ ] Balance, history, and payout to a user-supplied Sidra (EVM) address (`isEvmAddress` validation
      already exists in `packages/core`).
- [ ] Clear disclosure of what is collected for targeting, and a way to turn it off.

### J.7 What we already have — the reason one backend was the right call

Reusable on the shared Convex backend, no rebuild:
`pointsLedger` (append-only, idempotent via `by_refId`) · fraud stack (device clustering, IP reputation,
impossible-speed, fraud score/tier) · `adCompletions` replay guard · server-side ad verification pattern
(`piAds.ts`) · admin moderation pipeline + `RiskBadge` · rate limiting · `requireEcosystem` isolation ·
admin panel.

**Fraud is now the product.** We promise advertisers authentic engagement. Every charge-back argument is
won or lost on this stack — it is the strongest asset we have and the reason the project is credible.
Add: a viewability standard (at least 50% visible for 2s, or completion) and an advertiser-facing
invalid-traffic report showing what was deducted and why.

### J.8 Build order

1. **Decide J.3** (token model). Blocks the ledger, the economics and the legal review.
2. **Write the ad content policy** (J.5) — it doubles as the Sharia board's review document.
3. **New public repo + app shell**, deterministic rewards, no chance mechanics (§I.3), `convex/` private.
4. **User side first** (J.6) with our own house ads as inventory — proves the loop end to end.
5. **Advertiser side** (J.4) — dashboard, SDA deposits, campaign review queue.
6. **Sharia review workflow** (J.5) wired into campaign state before anything serves publicly.
7. **Convex prod migration** (§A) — blocking, because this app is public.
8. **Proof-of-work updates** to SidraStart from real commits in the public repo, from day one.

### J.9 Review before writing code

- [ ] **J.3 token model** — the single biggest open question. Nothing else is safe to build first.
- [ ] Confirm the milestones, deadline and deliverables recorded on the SidraStart dashboard — we are
      committed to them and this doc has not seen them.
- [ ] Confirm whether SidraStart requires the reward token to be *their* project token.
- [ ] Legal advice on paying users a "real value" token (securities / AML / consumer protection).
- [ ] Confirm the J.2 separation measures with whoever owns the AdMob account.
- [ ] Decide the brand name and domain for this platform — needed before the public repo exists.
