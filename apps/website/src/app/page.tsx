import Link from "next/link";
import { FaqItem } from "@/components/FaqItem";
import { Reveal } from "@/components/Reveal";
import { Counter } from "@/components/Counter";
import { AppStoreButtons } from "@/components/AppStoreButtons";

const FEATURES = [
  {
    title: "Follow & join to earn",
    desc: "Follow pages and join channels on Telegram, Facebook and TikTok. Points are credited the moment your action is verified.",
    icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  },
  {
    title: "Like, share & comment",
    desc: "Multi-step tasks bundle follows, likes, comments and shares into one job — complete every step, submit one proof.",
    icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  },
  {
    title: "Daily streaks & combos",
    desc: "Check-in streaks, daily quests and combo bonuses keep your momentum — and your points — compounding every day.",
    icon: "M12 8v4l3 3 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
  {
    title: "Redeem reward points",
    desc: "Redeem your points for mobile airtime and data bundles. Delivery is automatic, and points come back if it fails.",
    icon: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z",
  },
  {
    title: "Refer & earn together",
    desc: "Invite friends and earn qualified-referral rewards when they join and keep engaging on the platform.",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    title: "Verified & fair",
    desc: "Every engagement is checked server-side with anti-fraud rules, so points go only to real, verifiable actions.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
];

const STEPS = [
  {
    title: "Sign in",
    desc: "Sign in with your email, a one-time email code, or Telegram. No wallet credentials, ever.",
  },
  {
    title: "Engage on social",
    desc: "Follow, like, share and join channels across Telegram, Facebook and TikTok to earn points.",
  },
  {
    title: "Redeem points",
    desc: "Redeem verified points for mobile airtime and data bundles, delivered automatically.",
  },
];

const TRUST = [
  { label: "Follow", icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19 8v6 M22 11h-6" },
  { label: "Like", icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" },
  { label: "Share", icon: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13" },
  { label: "Comment", icon: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" },
  { label: "Join Channels", icon: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" },
  { label: "Telegram", icon: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" },
  { label: "Facebook", icon: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" },
  { label: "TikTok", icon: "M9 12a4 4 0 1 0 4 4V4c.5 2.5 2.5 4 5 4" },
  { label: "Instagram", icon: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z M17.5 6.5h.01" },
];

// The six items we are actually building. Mirrors the "Next" stage of
// /roadmap — keep the two in step. `gated` means it waits on an outside
// approval, so we publish no date for it.
const ROADMAP = [
  {
    title: "Pi Network sign-in & payments",
    desc: "Sign in with Pi and pay with Pi inside the Pi Browser app.",
    icon: "M4 7h16 M8 7v12 M16 7v12",
    tag: "Gated",
    tone: "gated",
  },
  {
    title: "Google Play release",
    desc: "A full Play Store listing, once consent gating and advertising configuration are finalised.",
    icon: "M5 3l14 9-14 9V3z",
    tag: "In development",
    tone: "ship",
  },
  {
    title: "iOS app",
    desc: "An App Store build, pending the iOS tracking permission flow Apple requires before we can submit.",
    icon: "M12 7c-2 0-4 1.5-4 5s2 5 4 5 4-1.5 4-5-2-5-4-5z M12 7V3",
    tag: "Gated",
    tone: "gated",
  },
  {
    title: "More surveys",
    desc: "A wider survey inventory so there is always something to earn from. Waiting on a provider account.",
    icon: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
    tag: "Gated",
    tone: "gated",
  },
  {
    title: "Phone & WhatsApp sign-in",
    desc: "Two more ways to get in, using a one-time code sent to your phone.",
    icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92z",
    tag: "Gated",
    tone: "gated",
  },
  {
    title: "Bigger quiz banks",
    desc: "Continuously refreshed question pools, so the daily quiz stops repeating itself.",
    icon: "M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3h1V3H9z M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-3 3h-1V3h1z",
    tag: "In development",
    tone: "ship",
  },
];

const FAQS: [string, string][] = [
  [
    "How do I earn points?",
    "Complete social engagements — follow pages, join channels, finish multi-step tasks — answer daily quizzes, take surveys and build your check-in streak. Every action is verified before points are credited; most results are immediate, and anything inconclusive goes to human review.",
  ],
  [
    "How do reward points work?",
    "Points from verified activities are redeemed for mobile airtime and data bundles, delivered automatically through our fulfilment partner. Points are an in-app reward with no cash value, and if a delivery fails your points are returned automatically.",
  ],
  [
    "What about Pi Network and Sidra Chain?",
    "View2Earn is built for two fully separate economies that never mix. Pi Network sign-in and payments are in development, and Sidra Chain support is planned — see our roadmap for where each one stands today.",
  ],
  [
    "Is my personal data safe?",
    "We never ask for a seed phrase, private key or social media password. Sign-in uses email, a one-time email code or Telegram, and our backend enforces anti-fraud checks on every engagement. Proof screenshots are deleted automatically after 14 days.",
  ],
  [
    "How do redemptions work?",
    "Choose a bundle in the app, confirm, and the top-up is requested from our fulfilment partner straight away. You can watch the status change in your redemption history, and a failed delivery refunds your points automatically.",
  ],
  [
    "I'm an advertiser or creator — can I join?",
    "Absolutely. Use the partner request form to list your page or channel as a featured promotional campaign, reaching an active community. We'll get back to you quickly.",
  ],
];

function PhoneMockup() {
  return (
    <div className="hero-visual">
      <div className="phone-glow" />
      <div className="phone">
        <div className="phone-screen">
          <div className="phone-topbar">
            <span>9:41</span>
            <div className="phone-status">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span>100%</span>
            </div>
          </div>
          <div className="phone-balance">
            <div className="pb-label">POINTS BALANCE</div>
            <div className="pb-value">1,284</div>
            <div className="pb-row">
              <span>Today +86</span>
              <span>Streak 7 days</span>
            </div>
          </div>
          <div className="phone-task">
            <div className="pt-icon">✓</div>
            <div>
              <div className="pt-title">Follow Channel</div>
              <div className="pt-meta">Telegram · verified</div>
            </div>
            <div className="pt-pts">+40</div>
          </div>
          <div className="phone-task">
            <div className="pt-icon">♡</div>
            <div>
              <div className="pt-title">Like & Share Post</div>
              <div className="pt-meta">Facebook · verified</div>
            </div>
            <div className="pt-pts">+25</div>
          </div>
          <div className="phone-task">
            <div className="pt-icon">?</div>
            <div>
              <div className="pt-title">Daily Quiz</div>
              <div className="pt-meta">Pi Network · academy</div>
            </div>
            <div className="pt-pts">+30</div>
          </div>
        </div>
      </div>
      <div className="phone-float pf-1">
        <div className="pf-value">+40 pts</div>
        <div className="pf-label">Join confirmed</div>
      </div>
      <div className="phone-float pf-2">
        <div className="pf-value">Points Redeemed</div>
        <div className="pf-label">Digital Perk · Verified</div>
      </div>
    </div>
  );
}

function TrustMarquee() {
  const items = [...TRUST, ...TRUST];
  return (
    <div className="trust-strip">
      <div className="trust-label">The social engagements that earn — on the platforms you already use</div>
      <div className="marquee">
        <div className="marquee-track">
          {items.map((t, i) => (
            <span className="marquee-item" key={i} aria-hidden={i >= TRUST.length}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Dark hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-badge">
                <span className="dot" />
                Now live on Android
              </div>
              <h1>
                Earn points for <span className="grad">verified engagements</span>
              </h1>
              <p className="lead">
                View2Earn rewards your verified daily social activity with points. Follow,
                like, share and join across your favorite apps — then redeem
                your points for available digital rewards and perks.
              </p>
              <div className="hero-actions" id="download">
                <AppStoreButtons />
                <Link className="btn btn-outline-light" href="/contact" style={{ padding: "11px 22px" }}>
                  Contact us
                </Link>
              </div>
              <p className="hero-note">
                Available on Google Play & Android APK · iOS coming soon
              </p>
            </div>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Trust / marquee */}
      <TrustMarquee />

      {/* Live stats ticker */}
      <section className="section" id="live">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">Live platform</span>
            <h2 className="section-title">What&rsquo;s live today</h2>
            <p className="section-sub">
              The platform as it stands right now — not a projection. See the{" "}
              <Link href="/roadmap">roadmap</Link> for what is still being built.
            </p>
          </Reveal>
          <div className="stats-band">
            {[
              { to: 4, prefix: "", suffix: "", label: "Social platforms supported" },
              { to: 5, prefix: "", suffix: "", label: "Ways to earn points" },
              { to: 3, prefix: "", suffix: "", label: "Ways to sign in" },
              { to: 14, prefix: "", suffix: " days", label: "Until proof screenshots are deleted" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div className="stat-card">
                  <div className="v">
                    <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
                  </div>
                  <div className="l">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section-alt" id="features">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">Features</span>
            <h2 className="section-title">Everything you need to start earning</h2>
            <p className="section-sub">
              A complete engagement-reward platform built around your daily
              social habits.
            </p>
          </Reveal>
          <div style={{ height: 36 }} />
          <div className="grid-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={f.icon} />
                    </svg>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap — what's next */}
      <section className="section" id="roadmap">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">Roadmap</span>
            <h2 className="section-title">What we’re building next</h2>
            <p className="section-sub">
              What we are building now, on top of the engagement engine you already use. Items marked{" "}
              <strong>Gated</strong> wait on an outside approval, so we publish no date for them.
            </p>
          </Reveal>
          <div style={{ height: 36 }} />
          <div className="roadmap-grid">
            {ROADMAP.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="roadmap-card">
                  <div className="roadmap-top">
                    <div className="roadmap-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={f.icon} />
                      </svg>
                    </div>
                    <span className={`roadmap-tag ${f.tone}`}>{f.tag}</span>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="cta-actions">
            <Link href="/roadmap" className="btn btn-secondary btn-lg">
              See the full roadmap
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section section-alt" id="how-it-works">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">How it works</span>
            <h2 className="section-title">Three simple steps to your first reward</h2>
          </Reveal>
          <div style={{ height: 36 }} />
          <div className="steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 110}>
                <div className="step">
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">FAQ</span>
            <h2 className="section-title">Frequently asked questions</h2>
          </Reveal>
          <div style={{ height: 36 }} />
          <Reveal>
            <div className="faq">
              {FAQS.map(([q, a]) => (
                <FaqItem key={q} q={q} a={a} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="section section-alt">
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <h2>Ready to start earning points?</h2>
              <p>
                Join View2Earn today and turn your verified social activity into
                points. Or partner with us to put your page in front of an
                engaged, active audience.
              </p>
              <div className="cta-actions" style={{ flexDirection: "column", alignItems: "center", gap: 16 }}>
                <AppStoreButtons />
                <Link className="btn btn-outline-light" href="/partner">
                  Become a partner
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
