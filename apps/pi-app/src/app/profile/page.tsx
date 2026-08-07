"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import {
  achievements,
  coachHref,
  coachInsights,
  formatPts,
  iconEmoji,
  levelInfo,
  smartScore,
  type SmartDashboard,
} from "@/pi/profile/smart";

const MENU = [
  {
    label: "Referral Program",
    sub: "Invite friends & earn",
    tint: "#10B981",
    emoji: "👥",
    href: "/rewards-redemption",
  },
  {
    label: "Payout Wallet",
    sub: "Pi wallet & withdraw",
    tint: "#627EEA",
    emoji: "👛",
    href: "/wallet",
  },
  {
    label: "Points History",
    sub: "Full ledger records",
    tint: "#8B8894",
    emoji: "🕘",
    href: "/wallet",
  },
  {
    label: "Spin & Win",
    sub: "Lucky wheel",
    tint: "#EC4899",
    emoji: "🎰",
    href: "/spin",
  },
  {
    label: "Learn Pi",
    sub: "Guided lessons",
    tint: "#F59E0B",
    emoji: "🎓",
    href: "/learn",
  },
];

export default function PiProfile() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;
  const data = useQuery(api.profile.smartDashboard, userId ? { userId } : "skip");
  const generatePdf = useAction(api.reports.generatePdf);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const d = (data ?? null) as SmartDashboard | null;
  const lvl = d ? levelInfo(d.stats.totalEarned) : null;
  const score = d ? smartScore(d) : null;
  const insights = d ? coachInsights(d) : [];
  const achv = d ? achievements(d) : [];
  const unlocked = achv.filter((a) => a.unlocked);
  const locked = achv.filter((a) => !a.unlocked).slice(0, 3);

  const displayName = d?.user.name || d?.user.username || "View2Earn Member";
  const displayContact = d?.user.telegramUserId ? `@${d.user.telegramUserId}` : "";
  const ecosystemTag = d?.user.ecosystem === "PI" ? "Pi Network" : "Sidra Chain";

  const downloadReport = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const result = await generatePdf({ userId });
      if (result?.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setPdfBusy(false);
    }
  };

  const copyCode = async () => {
    if (!d?.referral.code) return;
    try {
      await navigator.clipboard.writeText(d.referral.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div className="pi-page pi-profile">
      {/* Bio header */}
      <div className="pi-profile-head">
        <div className="pi-profile-avatar">👤</div>
        <p className="pi-profile-name">{displayName}</p>
        {displayContact ? <p className="pi-muted">{displayContact}</p> : null}
        {lvl ? (
          <span className="pi-badge pi-badge-accent pi-profile-lvl">
            ⚡ Lv {lvl.level} · {lvl.title}
          </span>
        ) : null}
        {lvl ? (
          <div className="pi-profile-xp">
            <div className="pi-progress-track">
              <div className="pi-progress-fill" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
            </div>
            <p className="pi-muted">
              {formatPts(lvl.xp)} XP · {formatPts(lvl.next - lvl.xp)} to Level {lvl.level + 1}
            </p>
          </div>
        ) : null}
        <div className="pi-profile-badges">
          <span className="pi-badge pi-badge-accent">{ecosystemTag}</span>
          <span className="pi-badge pi-badge-live">✅ Verified Account</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="pi-profile-stats">
        <div className="pi-stat-tile">
          <span className="pi-stat-value pi-stat-accent">{d ? formatPts(d.stats.balance) : "…"}</span>
          <span className="pi-stat-label">Balance</span>
        </div>
        <div className="pi-stat-tile">
          <span className="pi-stat-value pi-stat-ok">{d ? formatPts(d.stats.totalEarned) : "…"}</span>
          <span className="pi-stat-label">Earned</span>
        </div>
        <div className="pi-stat-tile">
          <span className="pi-stat-value pi-stat-blue">{d ? formatPts(d.stats.tasksCompleted) : "…"}</span>
          <span className="pi-stat-label">Tasks</span>
        </div>
        <div className="pi-stat-tile">
          <span className="pi-stat-value pi-stat-gold">{d ? (d.rank.rank ? `#${d.rank.rank}` : "—") : "…"}</span>
          <span className="pi-stat-label">Rank</span>
        </div>
      </div>

      {/* Referral code */}
      {d?.referral.code ? (
        <div className="pi-card pi-referral-card">
          <div className="pi-row">
            <span className="pi-gift">🎟️</span>
            <div className="pi-grow">
              <p className="pi-card-title-sm">Your referral code</p>
              <p className="pi-muted">
                {d.referral.count} invited · {d.referral.qualifiedCount} qualified · +{d.referral.totalEarned} pts earned
              </p>
            </div>
            <button className="pi-btn-mini pi-btn-mini-on" onClick={copyCode}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="pi-referral-code">{d.referral.code}</p>
        </div>
      ) : null}

      {/* Smart coach */}
      <div className="pi-section-title">Smart Coach</div>
      <div className="pi-card">
        {score ? (
          <div className="pi-score-row">
            <div className="pi-score-ring">
              <span className="pi-score-value">{score.score}</span>
            </div>
            <div className="pi-grow">
              <p className="pi-card-title-sm">Daily Smart Score · {score.label}</p>
              <p className="pi-muted">Based on today's activity so far</p>
            </div>
          </div>
        ) : null}
        <div className="pi-insights">
          {insights.map((i) => {
            const href = i.action ? coachHref(i.action) : null;
            const inner = (
              <>
                <span className="pi-insight-icon" style={{ backgroundColor: `${i.tint}1f`, color: i.tint }}>
                  {iconEmoji(i.icon)}
                </span>
                <div className="pi-grow">
                  <p className="pi-insight-title">{i.title}</p>
                  <p className="pi-muted">{i.body}</p>
                </div>
                {i.action ? <span className="pi-insight-arrow">→</span> : null}
              </>
            );
            return href ? (
              <Link key={i.id} href={href} className="pi-insight-row pi-insight-row-active">
                {inner}
              </Link>
            ) : (
              <div key={i.id} className="pi-insight-row">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements preview */}
      <div className="pi-section-title">Achievements</div>
      <div className="pi-achv-row">
        {achv.length === 0 ? (
          <p className="pi-muted">Complete tasks to unlock badges</p>
        ) : (
          <>
            {unlocked.slice(0, 3).map((a) => (
              <div key={a.id} className="pi-achv-tile">
                <span className="pi-achv-icon" style={{ backgroundColor: `${a.tint}1f` }}>
                  {iconEmoji(a.icon)}
                </span>
                <p className="pi-achv-title">{a.title}</p>
              </div>
            ))}
            {locked.map((a) => (
              <div key={a.id} className="pi-achv-tile pi-achv-tile-locked">
                <span className="pi-achv-icon pi-achv-icon-locked">🔒</span>
                <p className="pi-achv-title-locked">Locked</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Menu */}
      <div className="pi-section-title">More</div>
      <div className="pi-menu">
        {MENU.map((m) => (
          <Link key={m.label} href={m.href} className="pi-menu-row">
            <span className="pi-menu-icon" style={{ backgroundColor: `${m.tint}1e` }}>
              {m.emoji}
            </span>
            <div className="pi-grow">
              <p className="pi-menu-label">{m.label}</p>
              <p className="pi-muted">{m.sub}</p>
            </div>
            <span className="pi-insight-arrow">→</span>
          </Link>
        ))}
        <button className="pi-menu-row pi-menu-row-btn" onClick={downloadReport} disabled={pdfBusy}>
          <span className="pi-menu-icon" style={{ backgroundColor: "#ef44441e" }}>
            📄
          </span>
          <div className="pi-grow">
            <p className="pi-menu-label">Download Report</p>
            <p className="pi-muted">{pdfBusy ? "Generating…" : "PDF activity report"}</p>
          </div>
          <span className="pi-insight-arrow">→</span>
        </button>
      </div>
    </div>
  );
}
