"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { requireRewardedAd } from "../../pi/pi";
import {
  buildActivities,
  hubSummary,
  type ActivitiesHubData,
} from "@/pi/activities/hub";
import { formatPts, levelInfo } from "@/pi/profile/smart";

// Pi home (mobile-first) — mirror of the Android app's home: animated
// gradient hero with balance, Achievements hub card, progress-to-reward,
// daily streak, mystery box, explore grid + recent activity (plus the pi-app
// extra: daily combo).
export default function PiHome() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const streak = useQuery(api.streaks.getStreak, userId ? { userId } : "skip");
  const box = useQuery(api.bonus.getBoxStatus, userId ? { userId } : "skip");
  const combo = useQuery(api.combos.getComboStatus, userId ? { userId } : "skip");
  const progress = useQuery(api.rewards.progressToNext, userId ? { userId } : "skip");
  const history = useQuery(api.points.history, userId ? { userId, limit: 5 } : "skip");
  const hub = useQuery(api.activities.getActivitiesHub, userId ? { userId } : "skip");
  const dash = useQuery(api.profile.smartDashboard, userId ? { userId } : "skip");
  const checkIn = useMutation(api.streaks.checkIn);
  const openBox = useMutation(api.bonus.openBox);
  const claimCombo = useMutation(api.combos.claimCombo);

  const [boxWon, setBoxWon] = useState<number | null>(null);
  const [comboWon, setComboWon] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Up late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  if (!me || !userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const hubData = hub as ActivitiesHubData | undefined;
  const hubS = hubData ? hubSummary(hubData, buildActivities(hubData)) : null;
  const lvl = dash ? levelInfo(dash.stats.totalEarned) : null;

  let hubHeadline = "Track today's activities";
  if (hubS) {
    if (hubS.claimableCount > 0) {
      hubHeadline = `${hubS.claimableCount} reward${hubS.claimableCount === 1 ? "" : "s"} ready to claim`;
    } else if (hubS.availableCount > 0) {
      hubHeadline = `${hubS.availableCount} activities available today`;
    } else if (hubS.remainingToday > 0) {
      hubHeadline = `Complete ${hubS.remainingToday} more to earn ${formatPts(hubS.potentialRemaining)} PTS`;
    } else {
      hubHeadline = `All ${hubS.totalToday} activities done today`;
    }
  }

  const doCheckIn = async () => {
    if (busy || !streak?.canCheckIn) return;
    setBusy(true);
    try {
      // Rewarded-ad gate is best-effort (mirrors Android's StreakCard): try to
      // watch the Pi ad and verify it server-side, but never block check-in if
      // the ad is skipped or unavailable.
      const gate = await requireRewardedAd();
      await checkIn({ userId, adId: gate.ok ? gate.adId ?? undefined : undefined });
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  const doOpenBox = async () => {
    if (busy || !box?.eligible) return;
    setBusy(true);
    try {
      // Rewarded-ad gate (mirrors Android's DailyBox).
      const gate = await requireRewardedAd();
      if (!gate.ok) throw new Error(gate.reason);
      const res = await openBox({ userId, adId: gate.adId ?? undefined });
      setBoxWon(res.reward);
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  const doClaimCombo = async () => {
    if (busy || !combo?.canClaim) return;
    setBusy(true);
    try {
      // Rewarded-ad gate (mirrors Android's ComboTracker).
      const gate = await requireRewardedAd();
      if (!gate.ok) throw new Error(gate.reason);
      const res = await claimCombo({ userId, adId: gate.adId ?? undefined });
      setComboWon(res.reward);
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  const exploreCategories = [
    {
      title: "🔥 Earn Points",
      subtitle: "Quick ways to boost your balance",
      items: [
        { href: "/tasks", label: "Tasks", emoji: "✅", desc: "Social media tasks", tint: "#3B82F6" },
        { href: "/quiz", label: "Daily Quiz", emoji: "🧠", desc: "Answer & score bonus", tint: "#6366F1" },
        { href: "/spin", label: "Spin & Win", emoji: "🎰", desc: "Daily lucky wheel", tint: "#EC4899" },
        { href: "/surveys", label: "Surveys", emoji: "📝", desc: "Share your feedback", tint: "#F97316" },
      ],
    },
    {
      title: "💳 Rewards & Growth",
      subtitle: "Cash out and share your profile",
      items: [
        { href: "/redeem", label: "Rewards", emoji: "🎁", desc: "Redeem gift cards & Pi", tint: "#10B981" },
        { href: "/promote", label: "Promote Hub", emoji: "🚀", desc: "Promote your links", tint: "#8B5CF6" },
      ],
    },
    {
      title: "🎓 Learn & Support",
      subtitle: "Guides and ways to help",
      items: [
        { href: "/learn", label: "Learn", emoji: "🎓", desc: "How to earn guide", tint: "#F59E0B" },
        { href: "/donate", label: "Donate π", emoji: "💜", desc: "Support the pool", tint: "#EC4899" },
      ],
    },
  ];

  const boxPct = box ? Math.min(1, box.tasksToday / box.needed) : 0;
  const progressPct = progress?.target
    ? Math.max(0, Math.min(1, progress.balance / progress.target.pointsPrice))
    : 0;
  const firstName = (me.name || me.username || "there").split(" ")[0];

  return (
    <div className="pi-page pi-home">
      {/* Hero */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">{greeting}, {firstName} 👋</p>
        <p className="pi-balance-label">Points Balance</p>
        <p className="pi-balance-value">{balance === undefined ? "—" : balance}</p>
        <div className="pi-hero-actions">
          <Link className="pi-chip" href="/wallet">View history →</Link>
          <span className="pi-hero-date">
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Achievements hub entry card */}
        <Link href="/achievements" className="pi-card pi-card-glass pi-hub-card">
          <div className="pi-hub-top">
            <div className="pi-hub-title-wrap">
              <span style={{ fontSize: 17 }}>🏆</span>
              <p className="pi-hub-title">Achievements</p>
              {lvl && (
                <span className="pi-hub-badge">🏅 Lvl {lvl.level}</span>
              )}
            </div>
            <p className="pi-hub-headline">{hubHeadline}</p>
          </div>
          <div className="pi-hub-chips">
            {(hubS?.availableCount ?? 0) > 0 && (
              <span className="pi-hub-chip" style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                🔥 {hubS?.availableCount} available now
              </span>
            )}
            {(hubS?.claimableCount ?? 0) > 0 && (
              <span className="pi-hub-chip" style={{ background: "#ECFDF5", color: "#10B981" }}>
                🎁 {hubS?.claimableCount} reward{hubS?.claimableCount === 1 ? "" : "s"} ready
              </span>
            )}
            <span className="pi-hub-chip" style={{ background: "var(--bg-2)", color: "var(--text-2)" }}>
              {hubS?.doneToday ?? 0}/{hubS?.totalToday ?? 0} done today
            </span>
          </div>
          {lvl && (
            <>
              <div className="pi-hub-xp-track">
                <div className="pi-hub-xp-fill" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
              </div>
              <p className="pi-hub-level-text">
                {formatPts(lvl.xp)} XP · {formatPts(lvl.next - lvl.xp)} to Lvl {lvl.level + 1}
              </p>
            </>
          )}
          <span className="pi-hub-btn">View achievements →</span>
        </Link>

        {/* Progress to reward */}
        {progress?.target ? (
          <Link href="/redeem" className="pi-card pi-card-link pi-card-glass">
            <div className="pi-row">
              <span className="pi-gift">🎁</span>
              <p className="pi-grow pi-card-title-sm">
                {progress.ready
                  ? `You can redeem ${progress.target.name}! 🎉`
                  : `${progress.target.pointsPrice - progress.balance} pts from ${progress.target.name}`}
              </p>
              <span className="pi-count">{progress.balance}/{progress.target.pointsPrice}</span>
            </div>
            <div className="pi-progress-track pi-mt">
              <div className={`pi-progress-fill ${progress.ready ? "pi-progress-fill-ready" : ""}`} style={{ width: `${progressPct * 100}%` }} />
            </div>
          </Link>
        ) : null}

        {/* Daily streak */}
        <section className="pi-card pi-card-glass">
          <div className="pi-row">
            <span className="pi-flame">🔥</span>
            <div className="pi-grow">
              <p className="pi-card-title">{streak?.current ?? 0} day{streak?.current === 1 ? "" : "s"}</p>
              <p className="pi-muted">
                {streak?.checkedInToday
                  ? "Checked in today · come back tomorrow"
                  : `Check in for +${streak?.todayReward ?? 0} pts`}
              </p>
            </div>
            <button
              className={`pi-btn-mini ${streak?.canCheckIn && !busy ? "pi-btn-mini-on" : ""}`}
              onClick={doCheckIn}
              disabled={!streak?.canCheckIn || busy}>
              {streak?.checkedInToday ? "✓ Done" : busy ? "…" : "Check in"}
            </button>
          </div>
          {streak ? (
            <div className="pi-dots">
              {streak.schedule.map((pts, i) => {
                const day = i + 1;
                const reached = day <= streak.cycleDay && streak.checkedInToday;
                const isToday = day === streak.cycleDay && !streak.checkedInToday;
                return (
                  <div key={day} className="pi-dot-col">
                    <div className={`pi-dot ${reached ? "pi-dot-reached" : ""} ${isToday ? "pi-dot-today" : ""}`}>
                      {day}
                    </div>
                    <span className="pi-dot-pts">{pts}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <p className="pi-muted pi-mt">Longest streak: {streak?.longest ?? 0} days</p>
        </section>

        {/* Daily mystery box */}
        <section className={`pi-card pi-card-glass pi-box-card ${box?.eligible ? "pi-box-ready" : ""}`}>
          {boxWon !== null ? (
            <div className="pi-row">
              <span className="pi-box-emoji">🎉</span>
              <div className="pi-grow">
                <p className="pi-card-title">Mystery box opened!</p>
                <p className="pi-muted">You won +{boxWon} pts</p>
              </div>
            </div>
          ) : box?.openedToday ? (
            <div className="pi-row">
              <span className="pi-box-emoji pi-dim">📦</span>
              <div className="pi-grow">
                <p className="pi-card-title">Box opened today</p>
                <p className="pi-muted">Come back tomorrow for another</p>
              </div>
            </div>
          ) : (
            <div className="pi-row">
              <span className="pi-box-emoji">{box?.eligible ? "🎁" : "📦"}</span>
              <div className="pi-grow">
                <p className="pi-card-title">{box?.eligible ? "Daily box ready!" : "Daily mystery box"}</p>
                {box?.eligible ? (
                  <p className="pi-muted pi-muted-accent">Tap to open · win up to 250 pts</p>
                ) : (
                  <>
                    <p className="pi-muted">{box?.tasksToday ?? 0}/{box?.needed ?? 0} tasks today to unlock</p>
                    <div className="pi-progress-track pi-mt">
                      <div className="pi-progress-fill" style={{ width: `${boxPct * 100}%` }} />
                    </div>
                  </>
                )}
              </div>
              {box?.eligible ? (
                <button className="pi-btn-mini pi-btn-mini-on" onClick={doOpenBox} disabled={busy}>
                  {busy ? "…" : "Open"}
                </button>
              ) : null}
            </div>
          )}
        </section>

        {/* Explore Sections */}
        <div style={{ marginTop: 8 }}>
          <p className="pi-section-title">Explore Platform</p>
          {exploreCategories.map((cat) => (
            <div key={cat.title} style={{ marginBottom: 20 }}>
              <div className="pi-cat-header">
                <h3 className="pi-cat-title">{cat.title}</h3>
                <p className="pi-cat-sub">{cat.subtitle}</p>
              </div>
              <div className="pi-grid-explore">
                {cat.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="pi-explore-tile"
                  >
                    <span
                      className="pi-explore-icon"
                      style={{ backgroundColor: `${item.tint}1f`, color: item.tint }}
                    >
                      {item.emoji}
                    </span>
                    <span className="pi-explore-tile-label">{item.label}</span>
                    <span className="pi-explore-tile-desc">{item.desc}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Daily combo (pi-app extra) */}
        {combo && !combo.claimedToday && (combo.social || combo.telegram || combo.quiz) ? (
          <section className="pi-card pi-card-glass pi-combo-card">
            <div className="pi-row pi-combo-head">
              <span className="pi-flame pi-combo-flame">⚡</span>
              <div className="pi-grow">
                <p className="pi-card-title">Daily Combo</p>
                <p className="pi-muted pi-muted-accent">+{combo.reward} pts when all 3 are done</p>
              </div>
              {combo.canClaim ? (
                <button
                  className="pi-btn-mini pi-btn-mini-on"
                  onClick={doClaimCombo}
                  disabled={busy}>
                  {busy ? "…" : "Claim"}
                </button>
              ) : (
                <span className="pi-combo-count">
                  {[combo.social, combo.telegram, combo.quiz].filter(Boolean).length}/3
                </span>
              )}
            </div>
            <div className="pi-combo-legs">
              {[
                { key: "social", icon: "🔗", label: "Follow", done: combo.social },
                { key: "telegram", icon: "✈️", label: "Telegram", done: combo.telegram },
                { key: "quiz", icon: "🧠", label: "Quiz", done: combo.quiz },
              ].map((leg) => (
                <div key={leg.key} className="pi-combo-leg">
                  <div className={`pi-combo-dot ${leg.done ? "pi-combo-dot-done" : ""}`}>
                    {leg.done ? "✓" : leg.icon}
                  </div>
                  <span className={`pi-combo-label ${leg.done ? "pi-combo-label-done" : ""}`}>
                    {leg.label}
                  </span>
                </div>
              ))}
            </div>
            {comboWon !== null ? (
              <p className="pi-muted pi-mt pi-muted-accent">+{comboWon} pts earned! ⚡</p>
            ) : null}
          </section>
        ) : null}

        {/* Recent activity */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Recent activity</h2>
            <a className="pi-link-text" href="/tasks">Browse tasks →</a>
          </div>
          {history === undefined ? (
            <div className="pi-spinner" />
          ) : history.length === 0 ? (
            <p className="pi-muted">No activity yet — complete your first task to start earning.</p>
          ) : (
            <div className="pi-activity">
              {history.map((h) => (
                <div key={h._id} className="pi-activity-row">
                  <span className={`pi-delta ${h.delta > 0 ? "pi-delta-plus" : "pi-delta-minus"}`}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                  <div className="pi-grow">
                    <p className="pi-activity-reason">{h.reason.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="pi-muted">{new Date(h._creationTime).toLocaleDateString()}</p>
                  </div>
                  <span className="pi-num">Bal {h.balanceAfter}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
