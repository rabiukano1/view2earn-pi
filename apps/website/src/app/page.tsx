import Link from "next/link";
import { FaqItem } from "@/components/FaqItem";
import { Reveal } from "@/components/Reveal";
import { Counter } from "@/components/Counter";

const FEATURES = [
  {
    title: "Earn by completing tasks",
    desc: "Follow pages, join channels and complete social actions for points — simple, fast and tracked automatically.",
    icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  },
  {
    title: "Watch ads, get rewarded",
    desc: "Short rewarded ads pay you points directly to your app wallet. No gimmicks, no hidden requirements.",
    icon: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  },
  {
    title: "Daily habits & bonuses",
    desc: "Check-in streaks, daily mystery boxes, quiz challenges and combo bonuses keep you coming back for more.",
    icon: "M12 8v4l3 3 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
  {
    title: "Redeem real rewards",
    desc: "Swap your points for airtime, data bundles and more. Pay for rewards with Pi or Sidra on the app.",
    icon: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z",
  },
  {
    title: "Refer & earn together",
    desc: "Invite friends and earn qualified-referral rewards when they join and stay active on the platform.",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    title: "Safe & secure",
    desc: "Server-side fraud detection, verified payouts and no user secrets. Your points and rewards are protected.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
];

const STEPS = [
  {
    title: "Sign in",
    desc: "Sign in with your Pi or Sidra account. Your ecosystem is detected automatically.",
  },
  {
    title: "Complete tasks & watch ads",
    desc: "Pick from daily tasks, rewarded ads, quizzes and surveys to start earning points.",
  },
  {
    title: "Redeem rewards",
    desc: "Swap your points for airtime, data and more — right from the app wallet.",
  },
];

const TRUST = [
  { label: "Pi Network", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2" },
  { label: "Sidra Chain", icon: "M8 3v18 M8 3l8 5-8 5" },
  { label: "Google Play", icon: "M3 5l9 6-9 6V5z M21 5l-9 6 9 6V5z" },
  { label: "App Store", icon: "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z" },
  { label: "Airtime & Data", icon: "M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3" },
  { label: "Referral Rewards", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
];

const FAQS: [string, string][] = [
  [
    "How do I earn points?",
    "Complete social tasks (following pages and joining channels), watch rewarded ads, answer daily quizzes, complete surveys, and build your check-in streak. Every action credits your app wallet automatically.",
  ],
  [
    "Can I really get rewarded?",
    "Yes. Points are redeemable for real rewards like airtime and data bundles through our verified providers. Some purchases can also be made with Pi or Sidra directly in the app.",
  ],
  [
    "What is the difference between Pi and Sidra?",
    "View2Earn runs two separate, fully isolated economies — one on Pi Network and one on Sidra Chain. Your ecosystem is chosen at sign-in and your points stay within it.",
  ],
  [
    "Is my personal data safe?",
    "We never store user secrets or seed phrases. Logins use the Pi SDK and Sidra's secure auth, and our backend enforces strict anti-fraud rules on every action.",
  ],
  [
    "How do I get paid out?",
    "Rewards are delivered through integrated redemption providers as airtime, data bundles and similar vouchers. Follow the redemption steps inside the app wallet.",
  ],
  [
    "I'm an advertiser or creator — can I join?",
    "Absolutely. Use the partner request form to list your page or channel as a task, or run rewarded ads to a targeted audience. We'll get back to you quickly.",
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
              <div className="pt-meta">Telegram · social</div>
            </div>
            <div className="pt-pts">+40</div>
          </div>
          <div className="phone-task">
            <div className="pt-icon">▶</div>
            <div>
              <div className="pt-title">Watch Rewarded Ad</div>
              <div className="pt-meta">AdMob · rewarded</div>
            </div>
            <div className="pt-pts">+50</div>
          </div>
          <div className="phone-task">
            <div className="pt-icon">? </div>
            <div>
              <div className="pt-title">Daily Quiz</div>
              <div className="pt-meta">Pi Network · academy</div>
            </div>
            <div className="pt-pts">+30</div>
          </div>
        </div>
      </div>
      <div className="phone-float pf-1">
        <div className="pf-value">+50 pts</div>
        <div className="pf-label">Rewarded ad watched</div>
      </div>
      <div className="phone-float pf-2">
        <div className="pf-value">Reward redeemed</div>
        <div className="pf-label">Airtime · 1 GB data</div>
      </div>
    </div>
  );
}

function TrustMarquee() {
  const items = [...TRUST, ...TRUST];
  return (
    <div className="trust-strip">
      <div className="trust-label">Built for the ecosystems you already use</div>
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
                Earn rewards for <span className="grad">your attention</span>
              </h1>
              <p className="lead">
                View2Earn turns your daily screen time into points. Complete
                tasks, watch rewarded ads, answer quizzes and redeem real
                rewards — all in one app.
              </p>
              <div className="hero-actions" id="download">
                <a className="btn btn-lg btn-on-dark" href="/#download">
                  Get the app
                </a>
                <Link className="btn btn-lg btn-outline-light" href="/contact">
                  Contact us
                </Link>
              </div>
              <p className="hero-note">
                Android & iOS · Pi Network · Sidra Chain
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
            <h2 className="section-title">Rewards are being earned right now</h2>
            <p className="section-sub">
              Real activity across the platform — updated as members complete
              tasks and redeem rewards.
            </p>
          </Reveal>
          <div className="stats-band">
            {[
              { to: 1200000, prefix: "", suffix: "+", label: "Points earned" },
              { to: 34000, prefix: "", suffix: "+", label: "Tasks completed" },
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
              A complete reward platform built around your daily habits.
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

      {/* How it works */}
      <section className="section" id="how-it-works">
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
      <section className="section section-alt" id="faq">
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
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <h2>Ready to start earning?</h2>
              <p>
                Join View2Earn today and turn your daily attention into
                rewards. Or partner with us to reach an engaged, active
                audience.
              </p>
              <div className="cta-actions">
                <a className="btn btn-lg btn-on-dark" href="/#download">
                  Get the app
                </a>
                <Link className="btn btn-lg btn-outline-light" href="/partner">
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
