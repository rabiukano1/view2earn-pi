import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Roadmap - View2Earn",
  description:
    "What View2Earn has shipped, what we are building next, and what we are still weighing. Updated as reality dictates.",
};

type Tone = "live" | "ship" | "gated" | "plan";

type Item = {
  title: string;
  desc: string;
  tag: string;
  tone: Tone;
  icon: string;
  items?: string[];
};

// Icon paths are 24x24 stroke outlines, matching the homepage set.
const I = {
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3",
  tasks: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  flame: "M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1 0 1-4-1-8z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  radar: "M19.07 4.93A10 10 0 1 1 4.93 19.07 M12 12l4-4 M12 2v4 M22 12h-4",
  gift: "M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  store: "M3 9l1.5-6h15L21 9 M4 9v12h16V9 M9 21v-7h6v7",
  gauge: "M12 20v-6 M6.3 17.7A8 8 0 1 1 20 12 M12 4v2",
  pi: "M4 7h16 M8 7v12 M16 7v12",
  play: "M5 3l14 9-14 9V3z",
  apple: "M12 7c-2 0-4 1.5-4 5s2 5 4 5 4-1.5 4-5-2-5-4-5z M12 7V3",
  poll: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92z",
  brain: "M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3h1V3H9z M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-3 3h-1V3h1z",
  scale: "M12 3v18 M5 7h14 M5 7l-3 7h6L5 7z M19 7l-3 7h6l-3-7z",
  server: "M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z",
  feather: "M4 20l10-10a4.95 4.95 0 1 0-7-7L4 6v14z M4 20h9 M14 10l6 6",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z M16 8a5 5 0 0 1 0 8 M19 5a9 9 0 0 1 0 14",
  wallet: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z",
  code: "M16 18l6-6-6-6 M8 6l-6 6 6 6",
};

const NOW: Item[] = [
  {
    title: "Accounts & access",
    desc: "Three ways in, and no credentials we should never hold.",
    tag: "Live",
    tone: "live",
    icon: I.key,
    items: [
      "Email and password sign-in",
      "One-time codes by email",
      "Sign in with Telegram",
      "Non-custodial payout addresses — never a seed phrase",
    ],
  },
  {
    title: "Earning activities",
    desc: "The task feed, with four activity types and server-side limits.",
    tag: "Live",
    tone: "live",
    icon: I.tasks,
    items: ["Follow a page", "Join a channel", "Quizzes", "Surveys", "Optional rewarded video, user-initiated"],
  },
  {
    title: "Engagement features",
    desc: "Reasons to come back that do not depend on new tasks existing.",
    tag: "Live",
    tone: "live",
    icon: I.flame,
    items: [
      "Daily check-in streak",
      "Daily quiz",
      "Weekly leaderboard",
      "Combo bonuses and daily bonuses",
      "Learning academy with level quizzes",
    ],
  },
  {
    title: "Verification",
    desc: "Staged proof assessment — cheapest check first, human review as the floor.",
    tag: "Live",
    tone: "live",
    icon: I.shield,
    items: [
      "Channel joins verified by our bot, no screenshot",
      "Automated screenshot assessment",
      "Human review fallback, always available",
      "Profile linking by one-time bio code",
    ],
  },
  {
    title: "Fraud protection",
    desc: "Layered signals, scored together. No single check decides anything.",
    tag: "Live",
    tone: "live",
    icon: I.radar,
    items: [
      "Device signals and cluster detection",
      "Connection reputation",
      "Behavioural checks",
      "Risk score and tier, surfaced to reviewers",
      "Proof screenshots deleted after a short retention period",
    ],
  },
  {
    title: "Rewards & fulfilment",
    desc: "Airtime and data bundles, delivered automatically — and refunded if delivery fails.",
    tag: "Live",
    tone: "live",
    icon: I.gift,
    items: ["Rewards catalogue", "Live redemption status", "Automatic reversal on failed delivery"],
  },
  {
    title: "Marketplace",
    desc: "Spend points to have your own public profile discovered. Every listing is reviewed first.",
    tag: "Live",
    tone: "live",
    icon: I.store,
    items: ["Listing creation and review queue", "Fee refunded on rejection", "Follower counts never shown"],
  },
  {
    title: "Operations & policies",
    desc: "Review queues for the humans, and six published policies for everyone else.",
    tag: "Live",
    tone: "live",
    icon: I.gauge,
    items: [
      "Verification, redemption, listing and risk queues",
      "Referral programme with qualification",
      "Terms, Privacy, Cookies, Anti-Fraud, Rewards, Child Safety",
    ],
  },
];

const NEXT: Item[] = [
  {
    title: "Pi Network sign-in & payments",
    desc: "Pi sign-in and Pi payments inside the Pi Browser app.",
    tag: "Gated",
    tone: "gated",
    icon: I.pi,
  },
  {
    title: "Google Play release",
    desc: "Consent gating and advertising configuration finalised before submission.",
    tag: "In progress",
    tone: "ship",
    icon: I.play,
  },
  {
    title: "App Store release",
    desc: "Requires the iOS tracking permission flow before we can submit.",
    tag: "Gated",
    tone: "gated",
    icon: I.apple,
  },
  {
    title: "Expanded survey inventory",
    desc: "More surveys, more often. Waiting on a provider publisher account.",
    tag: "Gated",
    tone: "gated",
    icon: I.poll,
  },
  {
    title: "Phone & WhatsApp codes",
    desc: "Two more ways to sign in, pending messaging provider approval.",
    tag: "Gated",
    tone: "gated",
    icon: I.phone,
  },
  {
    title: "Generated quiz banks",
    desc: "Larger, continuously refreshed question pools instead of fixed sets.",
    tag: "In progress",
    tone: "ship",
    icon: I.brain,
  },
  {
    title: "Independent legal review",
    desc: "Terms and Privacy Policy reviewed independently before wider launch.",
    tag: "In progress",
    tone: "ship",
    icon: I.scale,
  },
  {
    title: "Production backend",
    desc: "Full separation of development and production deployments.",
    tag: "In progress",
    tone: "ship",
    icon: I.server,
  },
];

const LATER: Item[] = [
  {
    title: "Marketplace depth",
    desc: "Richer discovery, categories, and campaign controls for listings.",
    tag: "Planned",
    tone: "plan",
    icon: I.store,
  },
  {
    title: "Wider reward catalogue",
    desc: "More bundle sizes, and more countries served.",
    tag: "Planned",
    tone: "plan",
    icon: I.gift,
  },
  {
    title: "Notifications",
    desc: "Streak reminders, redemption status, leaderboard changes.",
    tag: "Planned",
    tone: "plan",
    icon: I.bell,
  },
  {
    title: "Per-administrator identity",
    desc: "Individual admin accounts and roles, replacing shared access.",
    tag: "Planned",
    tone: "plan",
    icon: I.users,
  },
  {
    title: "Sidra Chain ecosystem",
    desc: "A separate app for Sidra users, with its own economy.",
    tag: "Planned",
    tone: "plan",
    icon: I.globe,
  },
  {
    title: "Low-end device work",
    desc: "App size and data use are product features here, not afterthoughts — our users run modest Android hardware on expensive data.",
    tag: "Planned",
    tone: "plan",
    icon: I.feather,
  },
];

const EXPLORING: Item[] = [
  {
    title: "Advertising infrastructure",
    desc: "We plan to expand our advertising infrastructure to better connect brands with an engaged audience.",
    tag: "Exploring",
    tone: "plan",
    icon: I.megaphone,
  },
  {
    title: "Wallet features",
    desc: "Multi-asset deposit and withdrawal, pending legal and regulatory review.",
    tag: "Exploring",
    tone: "plan",
    icon: I.wallet,
  },
  {
    title: "Developer partnerships",
    desc: "Tooling for other developers in the ecosystems we serve.",
    tag: "Exploring",
    tone: "plan",
    icon: I.code,
  },
];

function Card({ item }: { item: Item }) {
  return (
    <div className="roadmap-card">
      <div className="roadmap-top">
        <div className="roadmap-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d={item.icon} />
          </svg>
        </div>
        <span className={`roadmap-tag ${item.tone}`}>{item.tag}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.desc}</p>
      {item.items && (
        <ul>
          {item.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stage({
  id,
  kicker,
  title,
  sub,
  items,
  alt,
}: {
  id: string;
  kicker: string;
  title: string;
  sub: string;
  items: Item[];
  alt?: boolean;
}) {
  return (
    <section className={alt ? "section section-alt" : "section"} id={id}>
      <div className="container">
        <Reveal className="section-head">
          <span className="kicker">{kicker}</span>
          <h2 className="section-title">{title}</h2>
          <p className="section-sub">{sub}</p>
        </Reveal>
        <div style={{ height: 36 }} />
        <div className="roadmap-grid">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 90}>
              <Card item={item} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// Source of truth for the content on this page: /ROADMAP.md at the repo root.
export default function RoadmapPage() {
  return (
    <>
      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">Roadmap · October 2026</span>
            <h2 className="section-title">Where View2Earn is going</h2>
            <p className="section-sub">
              What we have shipped, what we are building, and what we are still weighing. Items marked{" "}
              <strong>Gated</strong> wait on an outside approval, so their timing is not entirely ours to
              set — and we publish no dates we cannot control.
            </p>
          </Reveal>

          <div className="stats-band">
            {[
              { v: NOW.length, l: "Live today" },
              { v: NEXT.length, l: "In development" },
              { v: LATER.length, l: "Planned" },
              { v: EXPLORING.length, l: "Exploring" },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 80}>
                <div className="stat-card">
                  <div className="v">{s.v}</div>
                  <div className="l">{s.l}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Stage
        id="now"
        kicker="Now"
        title="Shipped and live"
        sub="Everything here exists today and you can use it in the app."
        items={NOW}
        alt
      />

      <Stage
        id="next"
        kicker="Next"
        title="In active development"
        sub="Being worked on now. The gated items depend on someone else saying yes."
        items={NEXT}
      />

      <Stage
        id="later"
        kicker="Later"
        title="Planned, not yet started"
        sub="Agreed in principle, unstarted, and honestly described as such."
        items={LATER}
        alt
      />

      <Stage
        id="exploring"
        kicker="Exploring"
        title="No commitment yet"
        sub="Ideas we are weighing. Some of these will never ship, and that is the point of listing them here."
        items={EXPLORING}
      />

      <section className="section section-alt">
        <div className="container">
          <Reveal className="section-head">
            <span className="kicker">How to read this</span>
            <h2 className="section-title">A short true roadmap beats a long optimistic one</h2>
            <p className="section-sub">
              Items move between stages as reality dictates, and this page is updated when they do. For
              the full technical and economic picture, read the{" "}
              <Link href="/whitepaper">whitepaper</Link>. Questions or corrections:{" "}
              <Link href="/contact">get in touch</Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
