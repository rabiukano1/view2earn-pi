"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { taskTargetUrl } from "../../lib/deepLink";

type PlatformFilter = "all" | "telegram" | "youtube" | "tiktok" | "facebook" | "instagram" | "x";

const PLATFORM_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string; bg: string }
> = {
  all: { label: "All Platforms", emoji: "🌐", color: "#8B5CF6", bg: "rgba(139,92,246,0.14)" },
  telegram: { label: "Telegram", emoji: "✈️", color: "#0088cc", bg: "rgba(0,136,204,0.14)" },
  youtube: { label: "YouTube", emoji: "▶️", color: "#FF0000", bg: "rgba(255,0,0,0.14)" },
  tiktok: { label: "TikTok", emoji: "🎵", color: "#EC4899", bg: "rgba(236,72,153,0.14)" },
  facebook: { label: "Facebook", emoji: "🅵", color: "#1877F2", bg: "rgba(24,119,242,0.14)" },
  instagram: { label: "Instagram", emoji: "📸", color: "#E4405F", bg: "rgba(228,64,95,0.14)" },
  x: { label: "X / Twitter", emoji: "🐦", color: "#1DA1F2", bg: "rgba(29,161,242,0.14)" },
  app: { label: "In-App", emoji: "⭐", color: "#F59E0B", bg: "rgba(245,158,11,0.14)" },
};

export default function PiTasks() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const tasks = useQuery(api.tasks.list, userId ? { userId } : "skip");
  const limits = useQuery(api.tasks.myLimits, userId ? { userId } : "skip");
  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");

  const [activeFilter, setActiveFilter] = useState<PlatformFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      const matchFilter =
        activeFilter === "all" || t.platform?.toLowerCase() === activeFilter;
      const matchSearch =
        !searchQuery.trim() ||
        (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.platform || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.type || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [tasks, activeFilter, searchQuery]);

  const totalPointsAvailable = useMemo(() => {
    if (!filteredTasks) return 0;
    return filteredTasks.reduce((sum, t) => sum + (t.points || 0), 0);
  }, [filteredTasks]);

  if (!userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const platformsList: PlatformFilter[] = [
    "all",
    "telegram",
    "youtube",
    "tiktok",
    "facebook",
    "instagram",
  ];

  return (
    <div className="pi-page pi-tasks-page">
      {/* Hero Header */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Tasks & Engagement Hub 🚀</p>
        <p className="pi-balance-label">Total Available Points to Claim</p>
        <p className="pi-balance-value">{totalPointsAvailable.toLocaleString()} PTS</p>
        <div className="pi-hero-actions">
          <span className="pi-chip">
            My Balance: {balance === undefined ? "…" : `${balance} PTS`}
          </span>
          <Link className="pi-chip" href="/wallet">
            Withdraw Pi →
          </Link>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Platform Limit Caps */}
        {limits && limits.length > 0 && (
          <section className="pi-card pi-card-glass" style={{ padding: 14 }}>
            <p className="pi-card-title-sm" style={{ marginBottom: 8 }}>
              🛡️ Daily Engagement Protection Caps
            </p>
            <div className="pi-limits-grid">
              {limits.map((l) => {
                const cfg = PLATFORM_CONFIG[l.platform] ?? {
                  label: l.platform,
                  emoji: "💠",
                  color: "#8B5CF6",
                };
                const pct = Math.round((l.used / l.limit) * 100);
                return (
                  <div key={l.platform} className="pi-limit-box">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span>
                        {cfg.emoji} <strong>{cfg.label}</strong>
                      </span>
                      <span className="pi-muted">
                        {l.remaining}/{l.limit} left
                      </span>
                    </div>
                    <div className="pi-progress-track" style={{ marginTop: 6, height: 6 }}>
                      <div
                        className="pi-progress-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cfg.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Platform Dropdown Selector & Search Bar */}
        <div className="pi-task-controls" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <select
              className="pi-input"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as PlatformFilter)}
              style={{
                marginBottom: 0,
                paddingLeft: 38,
                fontWeight: 700,
                backgroundColor: PLATFORM_CONFIG[activeFilter]?.bg ?? "var(--surface)",
                borderColor: PLATFORM_CONFIG[activeFilter]?.color ?? "var(--border)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {platformsList.map((pf) => {
                const cfg = PLATFORM_CONFIG[pf];
                const count =
                  pf === "all"
                    ? tasks?.length ?? 0
                    : tasks?.filter((t) => t.platform?.toLowerCase() === pf).length ?? 0;
                return (
                  <option key={pf} value={pf} style={{ backgroundColor: "#1e1b4b", color: "#FFF" }}>
                    {cfg.emoji} {cfg.label} ({count} tasks)
                  </option>
                );
              })}
            </select>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 16,
                pointerEvents: "none",
              }}
            >
              {PLATFORM_CONFIG[activeFilter]?.emoji}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="pi-input"
              placeholder="Search tasks by name, type, platform…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>

        {/* Task List Feed */}
        {tasks === undefined ? (
          <div className="pi-centered">
            <div className="pi-spinner" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <section className="pi-card pi-empty">
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              No tasks found in this category!
            </p>
            <p className="pi-muted">
              Check back soon for new task drops or clear your search filter.
            </p>
          </section>
        ) : (
          <div className="pi-task-list">
            {filteredTasks.map((t) => {
              const cfg =
                PLATFORM_CONFIG[t.platform?.toLowerCase()] ??
                PLATFORM_CONFIG.app;

              return (
                <section key={t._id} className="pi-card pi-card-glass pi-task-card-modern">
                  <div className="pi-task-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        className="pi-platform-badge-icon"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.emoji}
                      </div>
                      <div>
                        <h3 className="pi-card-title" style={{ fontSize: 16 }}>
                          {t.name || `${cfg.label} Task`}
                        </h3>
                        <p className="pi-muted" style={{ fontSize: 12 }}>
                          {cfg.label} · {t.type.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                    <span className="pi-badge pi-badge-accent" style={{ fontSize: 13, fontWeight: 800 }}>
                      +{t.points} PTS
                    </span>
                  </div>

                  {Array.isArray(t.steps) && t.steps.length > 0 && (
                    <div className="pi-task-steps-box">
                      <p className="pi-muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>
                        Task Steps:
                      </p>
                      <ul className="pi-steps-list">
                        {t.steps.map((s, i) => (
                          <li key={i} className="pi-step-item">
                            <span className="pi-step-num">{i + 1}</span>
                            <span>{s.label || s.action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pi-task-card-footer">
                    {t.targetUrl ? (
                      <a
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        href={taskTargetUrl(t.platform, t.targetUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Task &amp; Complete ↗
                      </a>
                    ) : (
                      <button className="btn btn-primary" style={{ width: "100%" }} disabled>
                        In-App Verification
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Verification Info */}
        <section className="pi-card pi-card-glass" style={{ textAlign: "center", padding: "18px 14px" }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
            💡 How Task Verification Works
          </p>
          <p className="pi-muted" style={{ fontSize: 12 }}>
            Tap <strong>Open Task &amp; Complete</strong> to follow, join, or like on the target platform. Proof verification runs automatically in the background to credit your points!
          </p>
        </section>
      </div>
    </div>
  );
}
