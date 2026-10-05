import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Whitepaper - View2Earn",
  description:
    "View2Earn is a verified engagement and rewards platform for emerging markets. How it works, the points model, the verification layer, and our privacy and compliance commitments.",
};

// Source of truth for this page: /WHITEPAPER.md at the repo root. Keep them in step.
//
// TODO before wider distribution — three facts only the company can supply:
//   1. Legal entity name, jurisdiction of incorporation, registered address (see "Company" below).
//   2. Current usage figures for the "Where we are" section (real numbers only, never projections).
//   3. Team names, roles and background (add a section before "Disclaimers").
// Those sentences are intentionally absent rather than filled with placeholder text.
export default function WhitepaperPage() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>View2Earn Whitepaper</h1>
        <p className="legal-updated">
          A verified engagement and rewards platform for emerging markets · Version 1.0 — October 2026
        </p>

        <h2>1. Abstract</h2>
        <p>
          View2Earn is a digital engagement and rewards platform. Users complete verified activities —
          following pages, joining channels, answering quizzes, completing surveys — and earn reward
          points. Points are redeemed for mobile airtime and data bundles, the rewards that matter most
          in the markets we serve.
        </p>
        <p>
          The platform&apos;s distinguishing feature is not the earning mechanic, which is common, but
          the <strong>verification layer</strong> beneath it. Reward platforms fail for one of two
          reasons: they pay for work that never happened, or they refuse so much legitimate work that
          honest users leave. View2Earn is built around a multi-stage verification system and a layered
          risk model designed to pay real users reliably while making coordinated abuse expensive.
        </p>
        <p>
          Points are an in-app virtual reward. <strong>Points are not a currency and have no cash
          value.</strong>
        </p>

        <h2>2. The problem</h2>
        <p>
          <strong>For users.</strong> Engagement with digital content generates value, and almost none of
          it returns to the person providing the engagement. In markets where mobile data is a meaningful
          share of household spending, that gap is not abstract — a data bundle is a real cost that
          recurs monthly.
        </p>
        <p>
          <strong>For the people seeking engagement.</strong> Anyone promoting a page, channel or app in
          these markets faces a market full of hollow metrics: bought followers, bot traffic, engagement
          that never belonged to a real person. Paying for reach and receiving noise is the normal
          outcome.
        </p>
        <p>
          <strong>For reward platforms.</strong> The two failures above have a shared cause. Verification
          is hard, so most platforms choose a side: pay generously and get farmed, or verify aggressively
          and drive honest users away. Neither builds something durable.
        </p>
        <p>
          <strong>Our position.</strong> The verification layer is the product. Everything else — the
          task feed, the rewards catalogue, the engagement features — is ordinary, and should be. The
          work is in making &ldquo;this really happened, and a real person did it&rdquo; cheap for us to
          establish and expensive for anyone to fake.
        </p>

        <h2>3. Who this is for</h2>
        <p>View2Earn targets users in markets where:</p>
        <ul>
          <li>Android is the dominant platform, often on modest hardware</li>
          <li>Mobile data and airtime are purchased in small, frequent amounts</li>
          <li>Participation in the Pi Network and similar communities is high</li>
          <li>Conventional reward platforms either do not operate or do not pay out locally</li>
        </ul>
        <p>
          Practical consequences, treated as product requirements rather than nice-to-haves: the app must
          stay small, work on low-end devices, tolerate intermittent connectivity, and use as little data
          as possible.
        </p>

        <h2>4. How it works</h2>

        <h3>4.1 The user journey</h3>
        <ol>
          <li>
            <strong>Sign in</strong> — email and password, a one-time email code, or Telegram. No seed
            phrase, no private key, no wallet credentials are ever requested.
          </li>
          <li>
            <strong>Complete an activity</strong> — follow a page, join a channel, answer a quiz, take a
            survey.
          </li>
          <li>
            <strong>Prove it</strong> — depending on the activity, this is automatic, a bot check, or a
            screenshot.
          </li>
          <li>
            <strong>Verification</strong> — the proof is assessed. Most results are immediate; some pass
            through a holding period or human review.
          </li>
          <li>
            <strong>Points are credited</strong> to an append-only ledger.
          </li>
          <li>
            <strong>Redeem</strong> — points are exchanged for airtime or data bundles, delivered
            automatically.
          </li>
        </ol>

        <h3>4.2 Activity types</h3>
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>What the user does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Follow a page</td>
              <td>Follows a public page or profile on a supported platform</td>
            </tr>
            <tr>
              <td>Join a channel</td>
              <td>Joins a public channel; verified directly through our bot</td>
            </tr>
            <tr>
              <td>Quiz</td>
              <td>Answers questions on blockchain and ecosystem topics</td>
            </tr>
            <tr>
              <td>Survey</td>
              <td>Completes a survey from an integrated provider</td>
            </tr>
            <tr>
              <td>Rewarded video</td>
              <td>Optionally watches a video. Always user-initiated — never automatic</td>
            </tr>
          </tbody>
        </table>

        <h3>4.3 Engagement features</h3>
        <p>
          Daily check-in streaks, a daily quiz, a weekly leaderboard, combo bonuses, a learning academy
          with level quizzes, and a referral programme that rewards the referrer only once the referred
          user has genuinely participated.
        </p>

        <h3>4.4 The marketplace</h3>
        <p>
          Users can spend points to list their own public profile so other users can discover and follow
          it. Every listing passes human review before it appears, and the listing fee is refunded if a
          listing is rejected.
        </p>
        <p>
          <strong>A deliberate omission:</strong> View2Earn never displays follower or friend counts
          anywhere in the product. We show how many activities a user has completed, never how popular
          anyone is. Counting followers is what turns a rewards platform into a vanity market, and vanity
          markets attract fraud.
        </p>

        <h2>5. The points model</h2>
        <p>Points are earned at published rates:</p>
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Follow a page</td>
              <td>10</td>
            </tr>
            <tr>
              <td>Join a channel</td>
              <td>8</td>
            </tr>
            <tr>
              <td>Correct quiz answer</td>
              <td>3</td>
            </tr>
            <tr>
              <td>Survey completion</td>
              <td>from 50, by provider and length</td>
            </tr>
            <tr>
              <td>Qualified referral</td>
              <td>100 to the referrer, 50 to the new user</td>
            </tr>
            <tr>
              <td>Check-in streak</td>
              <td>1 to 10, growing across a seven-day cycle</td>
            </tr>
            <tr>
              <td>Combo bonus</td>
              <td>5</td>
            </tr>
          </tbody>
        </table>
        <p>
          Rates are configurable and may change; the app always shows the current rate before a user
          starts an activity.
        </p>
        <p>
          <strong>Design rules we hold to:</strong>
        </p>
        <ul>
          <li>
            <strong>Points are not money.</strong> They are an in-app virtual reward with no cash value,
            not a currency, not a security, and not an investment.
          </li>
          <li>
            <strong>The ledger is append-only.</strong> Every credit and debit is a permanent row.
            Balances are derived from the ledger, never edited directly.
          </li>
          <li>
            <strong>Credits are idempotent.</strong> A retried callback from a provider cannot pay twice.
          </li>
          <li>
            <strong>No peer-to-peer point transfers.</strong> Deliberately removed. Transfers between
            users are the primary cash-out route for fraud rings, and the feature is not worth the
            exposure.
          </li>
          <li>
            <strong>Separate economies.</strong> Points earned on different surfaces are tracked on
            separate ledgers and do not mix. Which economy a user is earning in is determined
            server-side from their authenticated session and cannot be changed by the client.
          </li>
        </ul>

        <h2>6. Verification and trust</h2>
        <p>
          This section describes our approach. It deliberately omits thresholds, limits, timings and
          scoring rules — publishing those would be publishing the instructions for defeating them.
        </p>

        <h3>6.1 Staged verification</h3>
        <p>Proof is assessed in stages, cheapest first:</p>
        <ul>
          <li>
            <strong>Direct verification</strong> where a platform allows it. Channel joins are confirmed
            through our own bot — no screenshot, nothing for the user to upload, nothing for us to
            assess.
          </li>
          <li>
            <strong>Profile linking.</strong> A user proves profile ownership once using a short-lived
            code placed in their public bio. We fetch and validate the real profile, and the link is held
            for a fixed period. Each external profile can be linked to exactly one account,
            platform-wide.
          </li>
          <li>
            <strong>Automated screenshot assessment</strong> for activities needing visual proof.
          </li>
          <li>
            <strong>Human review</strong> when automated assessment is unavailable or inconclusive.
            Review fallback is automatic — users are never left without a path to a decision.
          </li>
          <li>
            <strong>Sampled re-verification.</strong> Established users with a clean history are verified
            less intensively than new or flagged accounts. Trust is earned and it is spendable.
          </li>
        </ul>
        <p>
          Some results are released after a holding period rather than instantly. The purpose is to let
          background checks complete before points become spendable.
        </p>

        <h3>6.2 Layered risk assessment</h3>
        <p>No single signal decides anything. The layers:</p>
        <ol>
          <li>
            <strong>Identity anchors</strong> — one verified external profile per account.
          </li>
          <li>
            <strong>Device signals</strong> — a composite device fingerprint, used to detect one device
            operating many accounts of the same type. Legitimate multi-ecosystem use on one device is
            explicitly not flagged; we distinguish the two cases rather than punishing both.
          </li>
          <li>
            <strong>Connection reputation</strong> — assessment of connection type, including VPN, proxy
            and data centre traffic, which is weighted in redemption decisions.
          </li>
          <li>
            <strong>Behavioural signals</strong> — timing and interaction patterns inconsistent with a
            human completing the task.
          </li>
          <li>
            <strong>Economic containment</strong> — rate limits on claims, uploads, quizzes and
            redemptions, and reduced earning capacity for accounts that have not yet established
            history.
          </li>
        </ol>
        <p>
          Signals accumulate into a risk score and a tier, surfaced to reviewers alongside each queue
          item. A high score reduces what an account can do; it does not silently delete their points.
        </p>

        <h3>6.3 What we will not do</h3>
        <ul>
          <li>We do not ask for social media passwords. Ever.</li>
          <li>We do not ask for seed phrases, private keys, or wallet credentials. Ever.</li>
          <li>We do not require users to install anything beyond our own app.</li>
          <li>
            We do not instruct users to violate any platform&apos;s terms of service, and activities that
            would require it are not offered.
          </li>
        </ul>

        <h2>7. Rewards and fulfilment</h2>
        <p>
          Points are redeemed for mobile airtime and data bundles, delivered automatically through an
          integrated telecommunications fulfilment provider. The sequence is deliberate:
        </p>
        <ol>
          <li>Points are debited and the redemption recorded.</li>
          <li>Fulfilment is requested from the provider.</li>
          <li>The provider&apos;s callback confirms delivery, or reports failure.</li>
          <li>
            <strong>On failure, points are automatically returned to the user&apos;s ledger.</strong> A
            failed delivery is our problem to resolve, not the user&apos;s loss to absorb.
          </li>
        </ol>
        <p>
          Redemption status is visible to the user throughout. Higher-risk redemptions pass through
          additional checks before fulfilment.
        </p>

        <h2>8. Architecture</h2>
        <p>
          One backend serves every surface: the Android app, our web apps, and the internal admin panel.
          The points ledger, the verification pipeline, the risk engine, the rewards catalogue,
          fulfilment, scheduled jobs and file storage all live there — once, with no second
          implementation to drift out of step.
        </p>
        <p>
          <strong>Choices worth explaining:</strong>
        </p>
        <ul>
          <li>
            <strong>One backend, many front-ends.</strong> Every surface shares one backend, so the
            ledger, the risk model and the fulfilment pipeline exist once.
          </li>
          <li>
            <strong>Server-side enforcement, always.</strong> Every function that earns, spends or
            redeems re-derives the user and their economy from the authenticated session. A client claim
            is never trusted on its own — including claims about completed activities.
          </li>
          <li>
            <strong>Real-time by default.</strong> Balances and queue states update live rather than by
            polling, which matters on metered data.
          </li>
          <li>
            <strong>Automatic background work.</strong> Holding periods, retention deletion and periodic
            checks run as scheduled jobs rather than depending on anyone remembering.
          </li>
        </ul>
        <p>
          External integrations: a messaging bot for direct verification, a survey provider, advertising
          partners, a telecommunications fulfilment provider, and automated content assessment.
        </p>

        <h2>9. Privacy, data and compliance</h2>
        <p>
          <strong>What we collect:</strong> account details, the activities completed, device signals
          used for fraud prevention, connection information, external profile identifiers for linked
          profiles, and screenshots submitted as proof.
        </p>
        <p>
          <strong>Retention:</strong> proof screenshots are deleted automatically after a short retention
          period. They exist to verify one activity and have no purpose afterwards.
        </p>
        <p>
          <strong>Advertising.</strong> All advertising in the app is user-initiated and opt-in.
          Advertising is delivered by third-party partners, and users are presented with a consent flow
          before personalised advertising is enabled, in line with applicable regional requirements. Our{" "}
          <Link href="/privacy">Privacy Policy</Link> names our advertising partners and links to their
          own disclosures.
        </p>
        <p>
          <strong>Consent and control.</strong> Users can review our policies in the app and on this
          website, <Link href="/delete-account">request account deletion</Link>, and withdraw advertising
          consent.
        </p>
        <p>
          <strong>Published policies:</strong> <Link href="/terms">Terms of Service</Link> ·{" "}
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/cookies">Cookie Policy</Link> ·{" "}
          <Link href="/anti-fraud">Anti-Fraud Policy</Link> ·{" "}
          <Link href="/rewards-redemption">Rewards &amp; Redemption Policy</Link> ·{" "}
          <Link href="/child-safety">Child Safety Policy</Link>.
        </p>
        <p>
          <strong>Compliance commitments:</strong>
        </p>
        <ul>
          <li>
            We comply with the terms of every advertising, survey and social platform we integrate with.
          </li>
          <li>We do not offer activities that would require a user to breach a platform&apos;s rules.</li>
          <li>
            User-submitted content — marketplace listings in particular — passes human review before
            publication.
          </li>
        </ul>

        <h2>10. Where we are</h2>
        <p>
          The platform is live on Android, with the rewards, verification, fraud and fulfilment systems
          operating end to end. See our <Link href="/roadmap">roadmap</Link> for what is shipped, in
          progress, and under consideration.
        </p>

        <h2>11. Important disclaimers</h2>
        <ul>
          <li>
            <strong>Points are not money.</strong> Reward points are an in-app virtual reward. They are
            not a currency, not a financial instrument, not a security, and not an investment. They have
            no cash value and confer no ownership, profit entitlement or redemption right beyond the
            rewards offered in the app at the time of redemption.
          </li>
          <li>
            <strong>No earnings promise.</strong> Nothing here is a representation that any user will
            earn any particular amount. Reward rates, activity availability and the rewards catalogue
            change.
          </li>
          <li>
            <strong>Availability varies.</strong> Activities, rewards and payment methods differ by
            country and by partner availability, and may be withdrawn.
          </li>
          <li>
            <strong>Not investment advice.</strong> This document describes a product. It is not an offer
            to sell anything, a solicitation of investment, or advice of any kind.
          </li>
          <li>
            <strong>Third-party services.</strong> Some features depend on third parties. Their
            availability, terms and pricing are outside our control.
          </li>
          <li>
            <strong>This document may change.</strong> It describes the platform as of the version date
            above.
          </li>
        </ul>

        <p>
          Questions: <Link href="/contact">contact us</Link>.
        </p>
      </div>
    </div>
  );
}
