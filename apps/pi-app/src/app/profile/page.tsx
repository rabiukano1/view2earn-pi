"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
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
    emoji: "🤝",
    href: "/referral",
  },
  {
    label: "Promote Hub",
    sub: "Promote your channels",
    tint: "#8B5CF6",
    emoji: "🚀",
    href: "/promote",
  },
  {
    label: "Badges & Levels",
    sub: "Level progress & badges",
    tint: "#F59E0B",
    emoji: "🏆",
    href: "/achievements",
  },
  {
    label: "Payout Wallet",
    sub: "Pi wallet & withdraw",
    tint: "#627EEA",
    emoji: "👛",
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
    label: "Daily Quiz",
    sub: "Knowledge challenge",
    tint: "#6366F1",
    emoji: "🧠",
    href: "/quiz",
  },
  {
    label: "Learn Pi",
    sub: "Guided lessons",
    tint: "#F59E0B",
    emoji: "🎓",
    href: "/learn",
  },
];

const LEGAL_MENU = [
  {
    label: "Privacy Policy",
    sub: "Data collection & encryption",
    tint: "#3B82F6",
    emoji: "🛡️",
    href: "/privacy",
  },
  {
    label: "Cookie Policy",
    sub: "Storage & session management",
    tint: "#F59E0B",
    emoji: "🍪",
    href: "/cookies",
  },
  {
    label: "Anti-Fraud Policy",
    sub: "Security & anti-bot rules",
    tint: "#EF4444",
    emoji: "🚨",
    href: "/anti-fraud",
  },
  {
    label: "Terms of Service",
    sub: "Platform terms & guidelines",
    tint: "#8B5CF6",
    emoji: "📜",
    href: "/terms",
  },
  {
    label: "Rewards Policy",
    sub: "Redemption & payout rules",
    tint: "#10B981",
    emoji: "🎁",
    href: "/rewards-redemption",
  },
];

export default function PiProfile() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;
  const data = useQuery(api.profile.smartDashboard, userId ? { userId } : "skip");
  const generatePdf = useAction(api.reports.generatePdf);
  const { signOut } = useAuthActions();

  const [pdfBusy, setPdfBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
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
      // clipboard unavailable
    }
  };

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
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
          <span className="pi-profile-level">
            Level {lvl.level} · {lvl.title}
          </span>
        ) : null}
      </div>

      {/* Referral card */}
      {d?.referral.code ? (
        <div className="pi-card pi-ref-card">
          <div>
            <p className="pi-card-title-sm">Invite Pioneers &amp; Earn</p>
            <p className="pi-ref-code">{d.referral.code}</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={copyCode}>
            {copied ? "Copied! ✓" : "Copy Code"}
          </button>
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
                <span
                  className="pi-insight-icon"
                  style={{ backgroundColor: `${i.tint}1f`, color: i.tint }}
                >
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

      {/* Quick Menu */}
      <div className="pi-section-title">Quick Features</div>
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

      {/* Legal & Security Center */}
      <div className="pi-section-title">Legal &amp; Compliance Center</div>
      <div className="pi-menu">
        {LEGAL_MENU.map((m) => (
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
      </div>

      {/* Account Security & Sign Out */}
      <div className="pi-section-title">Account Security</div>
      <div className="pi-card pi-card-glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p className="pi-card-title-sm" style={{ fontSize: 15 }}>
              Sign Out of Pi Session
            </p>
            <p className="pi-muted" style={{ fontSize: 12 }}>
              Securely sign out of your Pi Browser session on this device.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ color: "#EF4444", borderColor: "#EF4444", fontWeight: 800 }}
            onClick={() => setShowSignOutConfirm(true)}
          >
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="pi-modal-overlay" onClick={() => setShowSignOutConfirm(false)}>
          <div className="pi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pi-modal-head">
              <h3>Confirm Sign Out</h3>
              <button
                type="button"
                className="pi-modal-x"
                onClick={() => setShowSignOutConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div className="pi-modal-body">
              <p className="pi-muted" style={{ fontSize: 14 }}>
                Are you sure you want to sign out of your account? You can sign back in anytime using your Pi Browser identity.
              </p>

              <div className="pi-modal-actions" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSignOutConfirm(false)}
                  disabled={signingOut}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#EF4444", borderColor: "#EF4444" }}
                  onClick={handleConfirmSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing Out…" : "Yes, Sign Out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
