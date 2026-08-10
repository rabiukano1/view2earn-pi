"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

type PlatformOption = "telegram" | "youtube" | "tiktok" | "facebook" | "instagram";

const PLATFORM_PRESETS: Record<
  PlatformOption,
  { label: string; emoji: string; color: string; placeholder: string }
> = {
  telegram: {
    label: "Telegram Channel",
    emoji: "✈️",
    color: "#0088cc",
    placeholder: "https://t.me/your_channel",
  },
  youtube: {
    label: "YouTube Video / Channel",
    emoji: "▶️",
    color: "#FF0000",
    placeholder: "https://youtube.com/watch?v=...",
  },
  tiktok: {
    label: "TikTok Profile / Video",
    emoji: "🎵",
    color: "#EC4899",
    placeholder: "https://tiktok.com/@your_username",
  },
  facebook: {
    label: "Facebook Page",
    emoji: "🅵",
    color: "#1877F2",
    placeholder: "https://facebook.com/your_page",
  },
  instagram: {
    label: "Instagram Account",
    emoji: "📸",
    color: "#E4405F",
    placeholder: "https://instagram.com/your_handle",
  },
};

export default function PromoteHubPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const activeListings = useQuery(api.marketplace.listListings);
  const myListings = useQuery(
    api.marketplace.myListings,
    userId ? { userId } : "skip"
  );

  const createListing = useMutation(api.marketplace.createListing);
  const cancelListing = useMutation(api.marketplace.cancelListing);

  const [platform, setPlatform] = useState<PlatformOption>("telegram");
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [pointsReward, setPointsReward] = useState<number>(50);
  const [maxCompletions, setMaxCompletions] = useState<number>(20);

  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"create" | "community" | "mine">("create");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!me || !userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const userBalance = balance ?? 0;
  const totalCost = pointsReward * maxCompletions;
  const activePreset = PLATFORM_PRESETS[platform];

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!targetUrl.trim()) {
      setMsg({ ok: false, text: "Please enter your channel or profile URL." });
      return;
    }

    if (pointsReward < 10) {
      setMsg({ ok: false, text: "Minimum reward per user is 10 points." });
      return;
    }

    if (maxCompletions < 1 || maxCompletions > 100) {
      setMsg({ ok: false, text: "Target completions must be between 1 and 100." });
      return;
    }

    if (userBalance < totalCost) {
      setMsg({
        ok: false,
        text: `Insufficient points balance. You need ${totalCost} pts but have ${userBalance} pts.`,
      });
      return;
    }

    setBusy(true);
    try {
      await createListing({
        userId,
        platform,
        targetUrl: targetUrl.trim(),
        pointsReward,
        maxCompletions,
      });
      setMsg({
        ok: true,
        text: "Campaign launched successfully! Your link is now live for Pi Pioneers to complete.",
      });
      setTargetUrl("");
      setTab("mine");
    } catch (err) {
      setMsg({
        ok: false,
        text: String((err as Error)?.message ?? err).replace("[CONVEX] ", ""),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (listingId: Id<"marketplaceListings">) => {
    if (!confirm("Are you sure you want to cancel this campaign? Unused points will be refunded.")) {
      return;
    }
    try {
      const res = await cancelListing({ userId, listingId });
      alert(`Campaign cancelled. ${res.refund} unused points refunded to your wallet!`);
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    }
  };

  return (
    <div className="pi-page pi-promote-page">
      {/* Hero Header */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Promote Hub 🚀</p>
        <p className="pi-balance-label">Promote Your Social Channels</p>
        <p className="pi-balance-value">{userBalance.toLocaleString()} PTS</p>
        <div className="pi-hero-actions">
          <Link className="pi-chip" href="/tasks">
            ← Tasks Feed
          </Link>
          <span className="pi-hero-date">COMMUNITY PROMOTIONS</span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Navigation Tabs */}
        <div className="pi-promote-tabs">
          <button
            className={`pi-promote-tab ${tab === "create" ? "pi-promote-tab-active" : ""}`}
            onClick={() => setTab("create")}
          >
            ➕ Launch Campaign
          </button>
          <button
            className={`pi-promote-tab ${tab === "community" ? "pi-promote-tab-active" : ""}`}
            onClick={() => setTab("community")}
          >
            🌐 Active Hub ({activeListings?.length ?? 0})
          </button>
          <button
            className={`pi-promote-tab ${tab === "mine" ? "pi-promote-tab-active" : ""}`}
            onClick={() => setTab("mine")}
          >
            👤 My Campaigns ({myListings?.length ?? 0})
          </button>
        </div>

        {/* Tab 1: Create Listing Form */}
        {tab === "create" && (
          <section className="pi-card pi-card-glass">
            <div className="pi-card-head">
              <h2>Launch a Promotion Campaign</h2>
              <span className="pi-badge pi-badge-live">Instant Reach</span>
            </div>

            <form onSubmit={handleLaunch}>
              {/* Select Platform */}
              <label className="pi-muted" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                1. Select Platform:
              </label>
              <div className="pi-platform-selector">
                {(Object.keys(PLATFORM_PRESETS) as PlatformOption[]).map((key) => {
                  const p = PLATFORM_PRESETS[key];
                  const isSelected = platform === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`pi-platform-chip ${isSelected ? "pi-platform-selected" : ""}`}
                      onClick={() => setPlatform(key)}
                      style={{
                        borderColor: isSelected ? p.color : "var(--border)",
                        backgroundColor: isSelected ? `${p.color}18` : "var(--surface)",
                        color: isSelected ? p.color : "var(--text)",
                      }}
                    >
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Target Link URL */}
              <div style={{ marginTop: 14 }}>
                <label className="pi-muted" style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                  2. Channel / Profile Link URL:
                </label>
                <input
                  type="url"
                  className="pi-input"
                  placeholder={activePreset.placeholder}
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                />
              </div>

              {/* Reward per User & Completions Grid */}
              <div className="pi-promote-grid">
                <div>
                  <label className="pi-muted" style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                    3. Reward per Pioneer (PTS):
                  </label>
                  <input
                    type="number"
                    className="pi-input"
                    min="10"
                    step="5"
                    value={pointsReward}
                    onChange={(e) => setPointsReward(parseInt(e.target.value, 10) || 10)}
                    required
                  />
                </div>
                <div>
                  <label className="pi-muted" style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                    4. Target Users (Max 100):
                  </label>
                  <input
                    type="number"
                    className="pi-input"
                    min="1"
                    max="100"
                    step="1"
                    value={maxCompletions}
                    onChange={(e) => setMaxCompletions(parseInt(e.target.value, 10) || 1)}
                    required
                  />
                </div>
              </div>

              {/* Budget Calculation Card */}
              <div className="pi-budget-card">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Total Campaign Cost:</span>
                  <strong style={{ color: "var(--accent-2)", fontSize: 16 }}>
                    {totalCost.toLocaleString()} PTS
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                  <span className="pi-muted">Your Current Balance:</span>
                  <span style={{ color: userBalance >= totalCost ? "#10B981" : "#EF4444", fontWeight: 700 }}>
                    {userBalance.toLocaleString()} PTS
                  </span>
                </div>
              </div>

              {/* Message Banner */}
              {msg && (
                <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`} style={{ marginTop: 14 }}>
                  {msg.text}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 16 }}
                disabled={busy || userBalance < totalCost}
              >
                {busy ? "Launching Campaign…" : `Launch Campaign (${totalCost.toLocaleString()} PTS)`}
              </button>
            </form>
          </section>
        )}

        {/* Tab 2: Community Active Hub */}
        {tab === "community" && (
          <section className="pi-card pi-card-glass">
            <div className="pi-card-head">
              <h2>🌐 Active Community Campaigns</h2>
              <span className="pi-badge pi-badge-accent">{activeListings?.length ?? 0} Live</span>
            </div>

            {activeListings === undefined ? (
              <div className="pi-spinner" />
            ) : activeListings.length === 0 ? (
              <p className="pi-muted">No active community campaigns right now. Be the first to launch one!</p>
            ) : (
              <div className="pi-task-list">
                {activeListings.map((item) => {
                  const p =
                    PLATFORM_PRESETS[item.platform as PlatformOption] ??
                    PLATFORM_PRESETS.telegram;
                  const pct = Math.round(
                    (item.completionsSoFar / item.maxCompletions) * 100
                  );

                  return (
                    <div key={item._id} className="pi-card pi-task-card-modern" style={{ padding: 14 }}>
                      <div className="pi-task-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 22 }}>{p.emoji}</span>
                          <div>
                            <h3 className="pi-card-title-sm">{p.label}</h3>
                            <p className="pi-muted" style={{ fontSize: 12 }}>
                              Target: {item.targetUrl.slice(0, 30)}…
                            </p>
                          </div>
                        </div>
                        <span className="pi-badge pi-badge-accent">+{item.pointsReward} PTS</span>
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span className="pi-muted">Progress:</span>
                          <strong>
                            {item.completionsSoFar} / {item.maxCompletions} users
                          </strong>
                        </div>
                        <div className="pi-progress-track" style={{ marginTop: 4, height: 6 }}>
                          <div className="pi-progress-fill" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                        </div>
                      </div>

                      <a
                        href={item.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 8, justifyContent: "center" }}
                      >
                        Open Target Link ↗
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: My Campaigns */}
        {tab === "mine" && (
          <section className="pi-card pi-card-glass">
            <div className="pi-card-head">
              <h2>👤 My Promotion Campaigns</h2>
              <span className="pi-badge pi-badge-accent">{myListings?.length ?? 0} Campaigns</span>
            </div>

            {myListings === undefined ? (
              <div className="pi-spinner" />
            ) : myListings.length === 0 ? (
              <p className="pi-muted">You haven't launched any campaigns yet.</p>
            ) : (
              <div className="pi-task-list">
                {myListings.map((item) => {
                  const p =
                    PLATFORM_PRESETS[item.platform as PlatformOption] ??
                    PLATFORM_PRESETS.telegram;
                  const pct = Math.round(
                    (item.completionsSoFar / item.maxCompletions) * 100
                  );

                  return (
                    <div key={item._id} className="pi-card pi-task-card-modern" style={{ padding: 14 }}>
                      <div className="pi-task-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 22 }}>{p.emoji}</span>
                          <div>
                            <h3 className="pi-card-title-sm">{p.label}</h3>
                            <p className="pi-muted" style={{ fontSize: 12 }}>
                              {item.targetUrl.slice(0, 30)}…
                            </p>
                          </div>
                        </div>
                        <span className={`pi-status ${item.status === "active" ? "pi-status-completed" : "pi-status-failed"}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span className="pi-muted">Completions:</span>
                          <strong>
                            {item.completionsSoFar} / {item.maxCompletions} users ({pct}%)
                          </strong>
                        </div>
                        <div className="pi-progress-track" style={{ marginTop: 4, height: 6 }}>
                          <div className="pi-progress-fill" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                        </div>
                      </div>

                      {item.status === "active" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: 8, color: "#EF4444", borderColor: "#EF4444" }}
                          onClick={() => handleCancel(item._id)}
                        >
                          Cancel &amp; Refund Unused Points
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
