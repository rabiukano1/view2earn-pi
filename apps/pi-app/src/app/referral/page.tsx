"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

export default function ReferralPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const referralData = useQuery(
    api.rewards.myReferral,
    userId ? { userId } : "skip"
  );
  const applyReferralCode = useMutation(api.rewards.applyReferralCode);

  const [inputCode, setInputCode] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!me || !userId || !referralData) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const myCode = referralData.code;
  const shareLink = `https://view2earn-pi.pages.dev?ref=${myCode}`;

  const copyToClipboard = async (text: string, type: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      alert(`Copied: ${text}`);
    }
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!inputCode.trim()) {
      setMsg({ ok: false, text: "Please enter a referral code." });
      return;
    }

    setBusy(true);
    try {
      const res = await applyReferralCode({ userId, code: inputCode.trim() });
      setMsg({
        ok: true,
        text: `Success! You were referred by @${res.referrerName} and received +${res.bonusPoints} PTS welcome bonus!`,
      });
      setInputCode("");
    } catch (err) {
      setMsg({
        ok: false,
        text: String((err as Error)?.message ?? err).replace("[CONVEX] ", ""),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-page pi-referral-page">
      {/* Hero Header */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Referral &amp; Invite Hub 🤝</p>
        <p className="pi-balance-label">Total Referral Bonus Earned</p>
        <p className="pi-balance-value">+{referralData.totalEarned.toLocaleString()} PTS</p>

        <div className="pi-hero-actions" style={{ marginTop: 14 }}>
          <Link className="pi-chip" href="/home">
            ← Home
          </Link>
          <span className="pi-hero-date">
            {referralData.count} FRIENDS INVITED
          </span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Referral Code & Link Card */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Your Invite Code &amp; Link</h2>
            <span className="pi-badge pi-badge-accent">+250 PTS per Friend</span>
          </div>

          <div className="pi-ref-code-box">
            <span className="pi-ref-code-text">{myCode}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => copyToClipboard(myCode, "code")}
            >
              {copiedCode ? "Copied! ✓" : "Copy Code"}
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="pi-muted" style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 12 }}>
              Your Unique Referral Link:
            </label>
            <div className="pi-ref-link-box">
              <input
                type="text"
                readOnly
                className="pi-input"
                value={shareLink}
                style={{ marginBottom: 0, fontSize: 13 }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => copyToClipboard(shareLink, "link")}
                style={{ flexShrink: 0 }}
              >
                {copiedLink ? "Copied! ✓" : "Copy Link"}
              </button>
            </div>
          </div>
        </section>

        {/* Enter Referrer Code Form */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Have a Referral Code?</h2>
            <span className="pi-badge pi-badge-live">+100 PTS Welcome</span>
          </div>

          {referralData.referredBy ? (
            <div className="pi-msg pi-msg-ok">
              ✓ You were referred by <strong>@{referralData.referredBy}</strong>
            </div>
          ) : (
            <form onSubmit={handleApplyCode}>
              <p className="pi-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                Enter your friend's code below to claim a <strong>+100 PTS</strong> bonus!
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="pi-input"
                  placeholder="e.g. V2E-A1B2C3"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  style={{ marginBottom: 0, flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !inputCode.trim()}
                >
                  {busy ? "Applying…" : "Apply Code"}
                </button>
              </div>

              {msg && (
                <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`} style={{ marginTop: 12 }}>
                  {msg.text}
                </div>
              )}
            </form>
          )}
        </section>

        {/* Referral Stats Counter */}
        <div className="pi-ref-stats-grid">
          <div className="pi-card pi-card-glass pi-ref-stat-box">
            <span className="pi-ref-stat-num" style={{ color: "var(--accent)" }}>
              {referralData.count}
            </span>
            <span className="pi-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Friends Invited
            </span>
          </div>
          <div className="pi-card pi-card-glass pi-ref-stat-box">
            <span className="pi-ref-stat-num" style={{ color: "#10B981" }}>
              {referralData.qualifiedCount}
            </span>
            <span className="pi-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Qualified Referrals
            </span>
          </div>
          <div className="pi-card pi-card-glass pi-ref-stat-box">
            <span className="pi-ref-stat-num" style={{ color: "#F59E0B" }}>
              +{referralData.totalEarned}
            </span>
            <span className="pi-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Bonus Points
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
