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
    desc: "Engagement is currency. Like, share and comment on creator posts — every social action on the task feed earns points.",
    icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  },
  {
    title: "Daily streaks & combos",
    desc: "Check-in streaks, daily quests and combo bonuses keep your momentum — and your points — compounding every day.",
    icon: "M12 8v4l3 3 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
  {
    title: "Redeem reward points",
    desc: "Redeem your points for available in-app perks, partner offers, and digital rewards across supported ecosystems.",
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
    desc: "Sign in with your Pi or Sidra account. Your ecosystem is detected automatically.",
  },
  {
    title: "Engage on social",
    desc: "Follow, like, share and join channels across Telegram, Facebook and TikTok to earn points.",
  },
  {
    title: "Redeem points",
    desc: "Redeem verified points for available platform rewards and digital vouchers right from your wallet.",
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
  { label: "Pi Network", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2" },
  { label: "Sidra Chain", icon: "M8 3v18 M8 3l8 5-8 5" },
];

const ROADMAP = [
  {
    title: "AI task matching",
    desc: "A smart feed that learns what you actually do and surfaces the highest-value engagements for you.",
    icon: "M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z",
    tag: "In development",
    tone: "ship",
  },
  {
    title: "Team quests & contests",
    desc: "Form squads, compete in weekly contests and split bonus pools with the people you earn with.",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    tag: "Planned",
    tone: "plan",
  },
  {
    title: "Creator dashboard",
    desc: "Turn your own page or channel into a featured engagement magnet with transparent campaign analytics.",
    icon: "M18 20V10 M12 20V4 M6 20v-6",
    tag: "Planned",
    tone: "plan",
  },
  {
    title: "Faster redemptions",
    desc: "Streamlined point redemptions and partner rewards with lower claim thresholds.",
    icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    tag: "Planned",
    tone: "plan",
  },
  {
    title: "Streak multipliers",
    desc: "Combo multipliers that boost every point you earn when your daily engagement streak keeps growing.",
    icon: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
    tag: "Planned",
    tone: "plan",
  },
  {
    title: "Leaderboards & badges",
    desc: "Weekly leaderboards and collectible achievement badges for your biggest engagement milestones.",
    icon: "M18 2H6v7a6 6 0 0 0 12 0V2z M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
    tag: "Planned",
    tone: "plan",
  },
];

const FAQS: [string, string][] = [
  [
    "How do I earn points?",
    "Complete social engagements — follow pages, like and share posts, join channels — answer daily quizzes and build your check-in streak. Every action is verified and credited to your app wallet automatically.",
  ],
  [
    "How do reward points work?",
    "Points accumulated from verified activities can be redeemed for eligible digital rewards, vouchers, and ecosystem perks as made available by verified partners.",
  ],
  [
    "What is the difference between Pi and Sidra?",
    "View2Earn runs two separate, fully isolated economies — one on Pi Network and one on Sidra Chain. Your ecosystem is chosen at sign-in and your points stay within it.",
  ],
  [
    "Is my personal data safe?",
    "We never store user secrets or seed phrases. Logins use the Pi SDK and Sidra's secure auth, and our backend enforces strict anti-fraud rules on every engagement.",
  ],
  [
    "How do redemptions work?",
    "Eligible rewards and digital vouchers are processed through integrated redemption providers. Simply follow the redemption steps inside the app wallet.",
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
                Now live on Pi Network & Sidra Chain
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
                Available on Google Play & Android APK · iOS coming soon · Pi &amp; Sidra Chain
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
            <h2 className="section-title">Engagements are earning points right now</h2>
            <p className="section-sub">
              Real activity across the platform — updated as members complete
              engagements and redeem available rewards.
            </p>
          </Reveal>
          <div className="stats-band">
            {[
              { to: 1200000, prefix: "", suffix: "+", label: "Points earned" },
              { to: 34000, prefix: "", suffix: "+", label: "Engagements completed" },
              { to: 8700, prefix: "", suffix: "+", label: "Rewards redeemed" },
              { to: 12600, prefix: "", suffix: "+", label: "Active members" },
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
            <h2 className="section-title">Modern features, coming next</h2>
            <p className="section-sub">
              We're building a smarter way to earn. Here's what's on the way —
              built on the social engagement engine you already use.
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
