"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const PLATFORMS = [
  { value: "telegram", label: "Telegram", emoji: "✈️", color: "#229ED9", placeholder: "https://t.me/yourchannel" },
  { value: "youtube", label: "YouTube", emoji: "▶️", color: "#FF0000", placeholder: "https://youtube.com/@yourchannel" },
  { value: "tiktok", label: "TikTok", emoji: "🎵", color: "#000000", placeholder: "https://tiktok.com/@yourhandle" },
  { value: "facebook", label: "Facebook", emoji: "📘", color: "#1877F2", placeholder: "https://facebook.com/yourpage" },
  { value: "x", label: "X (Twitter)", emoji: "𝕏", color: "#000000", placeholder: "https://x.com/yourhandle" },
  { value: "instagram", label: "Instagram", emoji: "📸", color: "#E4405F", placeholder: "https://instagram.com/yourhandle" },
];

export default function CreateCampaignPage() {
  const router = useRouter();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;
  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const createListing = useMutation(api.marketplace.createListing);

  const [platform, setPlatform] = useState("telegram");
  const [targetUrl, setTargetUrl] = useState("");
  const [pointsReward, setPointsReward] = useState("25");
  const [maxCompletions, setMaxCompletions] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reward = parseInt(pointsReward, 10) || 0;
  const completions = parseInt(maxCompletions, 10) || 0;
  const totalCost = reward * completions;
  const userBalance = balance ?? 0;
  const canAfford = userBalance >= totalCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || submitting) return;

    if (!targetUrl.trim()) {
      setMsg({ ok: false, text: "Target URL is required" });
      return;
    }
    if (reward < 10) {
      setMsg({ ok: false, text: "Minimum reward is 10 PTS per completion" });
      return;
    }
    if (completions < 1 || completions > 100) {
      setMsg({ ok: false, text: "Completions must be between 1 and 100" });
      return;
    }
    if (!canAfford) {
      setMsg({ ok: false, text: `Insufficient points balance. You need ${totalCost} PTS.` });
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      await createListing({
        userId,
        platform,
        targetUrl: targetUrl.trim(),
        pointsReward: reward,
        maxCompletions: completions,
      });
      setMsg({ ok: true, text: "🎉 Campaign created successfully! Redirecting..." });
      setTimeout(() => router.push("/promote"), 1200);
    } catch (err) {
      setMsg({ ok: false, text: String((err as Error)?.message ?? err).replace("[CONVEX] ", "") });
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-page pi-create-campaign">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Create Campaign</h1>
          <p className="pi-muted">Promote your channel, page, or post to pioneers</p>
        </div>
        <Link className="pi-link-text" href="/promote">
          ← Back
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="pi-card pi-card-glass" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {msg && (
          <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}>
            {msg.text}
          </div>
        )}

        {/* Platform Selection */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 8, color: "var(--text)" }}>
            Select Platform
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {PLATFORMS.map((p) => {
              const selected = platform === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "10px 8px",
                    borderRadius: 12,
                    border: `1.5px solid ${selected ? p.color || "var(--accent)" : "var(--border)"}`,
                    backgroundColor: selected ? "rgba(124, 58, 237, 0.15)" : "var(--surface)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{p.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target URL Input */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Target URL / Handle Link
          </label>
          <input
            type="url"
            className="pi-input"
            placeholder={PLATFORMS.find((p) => p.value === platform)?.placeholder || "https://..."}
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            required
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* Reward per completion & max completions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
              PTS per Action (min 10)
            </label>
            <input
              type="number"
              className="pi-input"
              min="10"
              max="500"
              value={pointsReward}
              onChange={(e) => setPointsReward(e.target.value)}
              required
              style={{ marginBottom: 0 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
              Target Actions (1-100)
            </label>
            <input
              type="number"
              className="pi-input"
              min="1"
              max="100"
              value={maxCompletions}
              onChange={(e) => setMaxCompletions(e.target.value)}
              required
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>

        {/* Cost calculation summary */}
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: "rgba(124, 58, 237, 0.1)",
            border: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
              Total Budget Required
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: canAfford ? "var(--accent-2)" : "var(--danger)" }}>
              {totalCost} PTS
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
              Your Balance
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
              {userBalance} PTS
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !canAfford}
          style={{ width: "100%", height: 48, marginTop: 4, justifyContent: "center" }}
        >
          {submitting ? "Launching Campaign..." : `🚀 Launch Campaign (${totalCost} PTS)`}
        </button>
      </form>
    </div>
  );
}
