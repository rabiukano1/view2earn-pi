# View2Earn

### A verified engagement and rewards platform for emerging markets

**Version 1.0 — October 2026**

---

> **Note on placeholders.** Items in `[SQUARE BRACKETS]` are facts only you can supply —
> legal entity, jurisdiction, contact details, team, and current usage figures. Fill them in
> or delete the sentence; do not publish the brackets.

---

## 1. Abstract

View2Earn is a digital engagement and rewards platform. Users complete verified activities —
following pages, joining channels, answering quizzes, completing surveys — and earn reward
points. Points are redeemed for mobile airtime and data bundles, the rewards that matter most
in the markets we serve.

The platform's distinguishing feature is not the earning mechanic, which is common, but the
**verification layer** beneath it. Reward platforms fail for one of two reasons: they pay for
work that never happened, or they refuse so much legitimate work that honest users leave.
View2Earn is built around a multi-stage verification system and a layered risk model designed to
pay real users reliably while making coordinated abuse expensive.

Points are an in-app virtual reward. **Points are not a currency and have no cash value.**

---

## 2. The problem

**For users.** Engagement with digital content generates value, and almost none of it returns to
the person providing the engagement. In markets where mobile data is a meaningful share of
household spending, that gap is not abstract — a data bundle is a real cost that recurs monthly.

**For the people seeking engagement.** Anyone promoting a page, channel or app in these markets
faces a market full of hollow metrics: bought followers, bot traffic, engagement that never
belonged to a real person. Paying for reach and receiving noise is the normal outcome.

**For reward platforms.** The two failures above have a shared cause. Verification is hard, so
most platforms choose a side: pay generously and get farmed, or verify aggressively and drive
honest users away. Neither builds something durable.

**Our position.** The verification layer is the product. Everything else — the task feed, the
rewards catalogue, the engagement features — is ordinary, and should be. The work is in making
"this really happened, and a real person did it" cheap for us to establish and expensive for
anyone to fake.

---

## 3. Who this is for

View2Earn targets users in markets where:

- Android is the dominant platform, often on modest hardware
- Mobile data and airtime are purchased in small, frequent amounts
- Participation in the Pi Network and similar communities is high
- Conventional reward platforms either do not operate or do not pay out locally

Practical consequences, treated as product requirements rather than nice-to-haves: the app must
stay small, work on low-end devices, tolerate intermittent connectivity, and use as little data
as possible.

`[PRIMARY COUNTRIES / REGIONS]`

---

## 4. How it works

### 4.1 The user journey

1. **Sign in** — email and password, a one-time email code, or Telegram. No seed phrase, no
   private key, no wallet credentials are ever requested.
2. **Complete an activity** — follow a page, join a channel, answer a quiz, take a survey.
3. **Prove it** — depending on the activity, this is automatic, a bot check, or a screenshot.
4. **Verification** — the proof is assessed. Most results are immediate; some pass through a
   holding period or human review.
5. **Points are credited** to an append-only ledger.
6. **Redeem** — points are exchanged for airtime or data bundles, delivered automatically.

### 4.2 Activity types

| Activity | What the user does |
|---|---|
| Follow a page | Follows a public page or profile on a supported platform |
| Join a channel | Joins a public channel; verified directly through our bot |
| Quiz | Answers questions on blockchain and ecosystem topics |
| Survey | Completes a survey from an integrated provider |
| Rewarded video | Optionally watches a video. Always user-initiated — never automatic |

### 4.3 Engagement features

Daily check-in streaks, a daily quiz, a weekly leaderboard, combo bonuses, a learning academy
with level quizzes, and a referral programme that rewards the referrer only once the referred
user has genuinely participated.

### 4.4 The marketplace

Users can spend points to list their own public profile so other users can discover and follow
it. Every listing passes human review before it appears, and the listing fee is refunded if a
listing is rejected.

**A deliberate omission:** View2Earn never displays follower or friend counts anywhere in the
product. We show how many activities a user has completed, never how popular anyone is. Counting
followers is what turns a rewards platform into a vanity market, and vanity markets attract
fraud.

---

## 5. The points model

Points are earned at published rates:

| Activity | Points |
|---|---|
| Follow a page | 10 |
| Join a channel | 8 |
| Correct quiz answer | 3 |
| Survey completion | from 50, by provider and length |
| Qualified referral | 100 to the referrer, 50 to the new user |
| Check-in streak | 1 to 10, growing across a seven-day cycle |
| Combo bonus | 5 |

Rates are configurable and may change; the app always shows the current rate before a user
starts an activity.

**Design rules we hold to:**

- **Points are not money.** They are an in-app virtual reward with no cash value, not a
  currency, not a security, and not an investment.
- **The ledger is append-only.** Every credit and debit is a permanent row. Balances are derived
  from the ledger, never edited directly.
- **Credits are idempotent.** A retried callback from a provider cannot pay twice.
- **No peer-to-peer point transfers.** Deliberately removed. Transfers between users are the
  primary cash-out route for fraud rings, and the feature is not worth the exposure.
- **Separate economies.** Points earned on different surfaces are tracked on separate ledgers and
  do not mix. Which economy a user is earning in is determined server-side from their
  authenticated session and cannot be changed by the client.

---

## 6. Verification and trust

This section describes our approach. It deliberately omits thresholds, limits, timings and
scoring rules — publishing those would be publishing the instructions for defeating them.

### 6.1 Staged verification

Proof is assessed in stages, cheapest first:

- **Direct verification** where a platform allows it. Channel joins are confirmed through our own
  bot — no screenshot, nothing for the user to upload, nothing for us to assess.
- **Profile linking.** A user proves profile ownership once using a short-lived code placed in
  their public bio. We fetch and validate the real profile, and the link is held for a fixed
  period. Each external profile can be linked to exactly one account, platform-wide.
- **Automated screenshot assessment** for activities needing visual proof.
- **Human review** when automated assessment is unavailable or inconclusive. Review fallback is
  automatic — users are never left without a path to a decision.
- **Sampled re-verification.** Established users with a clean history are verified less
  intensively than new or flagged accounts. Trust is earned and it is spendable.

Some results are released after a holding period rather than instantly. The purpose is to let
background checks complete before points become spendable.

### 6.2 Layered risk assessment

No single signal decides anything. The layers:

1. **Identity anchors** — one verified external profile per account.
2. **Device signals** — a composite device fingerprint, used to detect one device operating many
   accounts of the same type. Legitimate multi-ecosystem use on one device is explicitly not
   flagged; we distinguish the two cases rather than punishing both.
3. **Connection reputation** — assessment of connection type, including VPN, proxy and data
   centre traffic, which is weighted in redemption decisions.
4. **Behavioural signals** — timing and interaction patterns inconsistent with a human completing
   the task.
5. **Economic containment** — rate limits on claims, uploads, quizzes and redemptions, and
   reduced earning capacity for accounts that have not yet established history.

Signals accumulate into a risk score and a tier, surfaced to reviewers alongside each queue item.
A high score reduces what an account can do; it does not silently delete their points.

### 6.3 What we will not do

- We do not ask for social media passwords. Ever.
- We do not ask for seed phrases, private keys, or wallet credentials. Ever.
- We do not require users to install anything beyond our own app.
- We do not instruct users to violate any platform's terms of service, and activities that would
  require it are not offered.

---

## 7. Rewards and fulfilment

Points are redeemed for mobile airtime and data bundles, delivered automatically through an
integrated telecommunications fulfilment provider. The sequence is deliberate:

1. Points are debited and the redemption recorded.
2. Fulfilment is requested from the provider.
3. The provider's callback confirms delivery, or reports failure.
4. **On failure, points are automatically returned to the user's ledger.** A failed delivery is
   our problem to resolve, not the user's loss to absorb.

Redemption status is visible to the user throughout. Higher-risk redemptions pass through
additional checks before fulfilment.

---

## 8. Architecture

```
                  ┌──────────────────────────────────┐
                  │   Backend (Convex)               │
                  │                                  │
                  │   points ledger · verification   │
                  │   risk engine · rewards          │
                  │   fulfilment · admin queues      │
                  │   scheduled jobs · file storage   │
                  └───┬──────────┬──────────┬────────┘
                      │          │          │
         ┌────────────┴───┐ ┌────┴─────┐ ┌──┴───────────┐
         │ Android app    │ │ Web apps │ │ Admin panel  │
         │ (React Native) │ │ (Next.js)│ │ (Next.js)    │
         └────────────────┘ └──────────┘ └──────────────┘
                      │
         ┌────────────┴──────────────────────────────────┐
         │ Integrations: messaging bot · survey provider  │
         │ advertising partners · telecom fulfilment      │
         │ automated content assessment                   │
         └───────────────────────────────────────────────┘
```

**Choices worth explaining:**

- **One backend, many front-ends.** Every surface shares one backend, so the ledger, the risk
  model and the fulfilment pipeline exist once. There is no second implementation to drift.
- **Server-side enforcement, always.** Every function that earns, spends or redeems re-derives
  the user and their economy from the authenticated session. A client claim is never trusted on
  its own — including claims about completed activities.
- **Real-time by default.** Balances and queue states update live rather than by polling, which
  matters on metered data.
- **Automatic background work.** Holding periods, retention deletion and periodic checks run as
  scheduled jobs rather than depending on anyone remembering.

---

## 9. Privacy, data and compliance

**What we collect:** account details, the activities completed, device signals used for fraud
prevention, connection information, external profile identifiers for linked profiles, and
screenshots submitted as proof.

**Retention:** proof screenshots are deleted automatically after a short retention period. They
exist to verify one activity and have no purpose afterwards.

**Advertising.** All advertising in the app is user-initiated and opt-in. Advertising is delivered
by third-party partners, and users are presented with a consent flow before personalised
advertising is enabled, in line with applicable regional requirements. Our Privacy Policy names
our advertising partners and links to their own disclosures.

**Consent and control.** Users can review our policies in the app and on our website, request
account deletion, and withdraw advertising consent.

**Published policies:** Terms of Service · Privacy Policy · Cookie Policy · Anti-Fraud Policy ·
Rewards & Redemption Policy · Child Safety Policy.

**Compliance commitments:**

- We comply with the terms of every advertising, survey and social platform we integrate with.
- We do not offer activities that would require a user to breach a platform's rules.
- User-submitted content — marketplace listings in particular — passes human review before
  publication.

`[LEGAL ENTITY NAME]` · `[JURISDICTION OF INCORPORATION]` · `[REGISTERED ADDRESS]` ·
`[CONTACT EMAIL]`

---

## 10. Where we are

`[CURRENT USAGE FIGURES — registered users, activities verified, redemptions fulfilled.
Use real numbers from your own records, or delete this section. Do not publish projections.]`

The platform is live on Android, with the rewards, verification, fraud and fulfilment systems
operating end to end. See our [Roadmap](./ROADMAP.md) for what is shipped, in progress, and
under consideration.

---

## 11. Team

`[NAMES, ROLES, AND RELEVANT BACKGROUND. If the team is small, say so plainly — a short honest
team section reads better than an inflated one.]`

---

## 12. Important disclaimers

- **Points are not money.** Reward points are an in-app virtual reward. They are not a currency,
  not a financial instrument, not a security, and not an investment. They have no cash value and
  confer no ownership, profit entitlement or redemption right beyond the rewards offered in the
  app at the time of redemption.
- **No earnings promise.** Nothing here is a representation that any user will earn any particular
  amount. Reward rates, activity availability and the rewards catalogue change.
- **Availability varies.** Activities, rewards and payment methods differ by country and by
  partner availability, and may be withdrawn.
- **Not investment advice.** This document describes a product. It is not an offer to sell
  anything, a solicitation of investment, or advice of any kind.
- **Third-party services.** Some features depend on third parties. Their availability, terms and
  pricing are outside our control.
- **This document may change.** It describes the platform as of the version date above.

---

*View2Earn — `[WEBSITE URL]` · `[CONTACT EMAIL]`*
