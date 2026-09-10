"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

type Level = {
  level: number;
  title: string;
  xp: number;
  next: number;
  progress: number;
};

function calculateLevel(totalEarned: number): Level {
  const thresholds = [
    { level: 1, title: "Starter Pioneer", min: 0, next: 100 },
    { level: 2, title: "Active Viewer", min: 100, next: 500 },
    { level: 3, title: "Engagement Master", min: 500, next: 1500 },
    { level: 4, title: "Pi Champion", min: 1500, next: 5000 },
    { level: 5, title: "Legendary Pioneer", min: 5000, next: 15000 },
  ];

  let current = thresholds[0];
  for (const t of thresholds) {
    if (totalEarned >= t.min) {
      current = t;
    }
  }

  const range = current.next - current.min;
  const earnedInRange = totalEarned - current.min;
  const progress = Math.max(0, Math.min(1, earnedInRange / range));

  return {
    level: current.level,
    title: current.title,
    xp: totalEarned,
    next: current.next,
    progress,
  };
}

type Badge = {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  color: string;
  current: number;
  target: number;
  unlocked: boolean;
  progress: number;
};

export default function AchievementsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const dashboard = useQuery(
    api.profile.smartDashboard,
    userId ? { userId } : "skip"
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const level = useMemo(() => {
    const totalEarned = dashboard?.stats?.totalEarned ?? 0;
    return calculateLevel(totalEarned);
  }, [dashboard]);

  const badges = useMemo<Badge[]>(() => {
    if (!dashboard) return [];
    const stats = dashboard.stats;
    const streak = dashboard.streak;
    const box = dashboard.box;
    const ref = dashboard.referral;

    const list = [
      {
        id: "first_task",
        title: "First Engagement",
        desc: "Complete your first task to earn points",
        emoji: "⭐",
        color: "#3B82F6",
        current: stats.tasksCompleted,
        target: 1,
      },
      {
        id: "task_10",
        title: "Task Champion",
        desc: "Complete 10 tasks on the platform",
        emoji: "🚀",
        color: "#8B5CF6",
        current: stats.tasksCompleted,
        target: 10,
      },
      {
        id: "pts_500",
        title: "Point Collector",
        desc: "Earn a total of 500 points lifetime",
        emoji: "🪙",
        color: "#F59E0B",
        current: stats.totalEarned,
        target: 500,
      },
      {
        id: "pts_2500",
        title: "Point Millionaire",
        desc: "Earn a total of 2,500 points lifetime",
        emoji: "👑",
        color: "#EC4899",
        current: stats.totalEarned,
        target: 2500,
      },
      {
        id: "streak_3",
        title: "Streak Beginner",
        desc: "Maintain a 3-day daily check-in streak",
        emoji: "🔥",
        color: "#EF4444",
        current: streak.current,
        target: 3,
      },
      {
        id: "streak_7",
        title: "Streak Master",
        desc: "Maintain a 7-day daily check-in streak",
        emoji: "⚡",
        color: "#10B981",
        current: streak.current,
        target: 7,
      },
      {
        id: "box_1",
        title: "Mystery Box Opener",
        desc: "Unlock and open your first daily mystery box",
        emoji: "📦",
        color: "#0EA5E9",
        current: box.openedToday ? 1 : 0,
        target: 1,
      },
      {
        id: "referral_1",
        title: "Community Ambassador",
        desc: "Refer your first Pioneer friend to View2Earn",
        emoji: "🤝",
        color: "#6366F1",
        current: ref.count,
        target: 1,
      },
    ];

    return list.map((b) => {
      const unlocked = b.current >= b.target;
      const progress = Math.max(0, Math.min(1, b.current / b.target));
      return { ...b, unlocked, progress };
    });
  }, [dashboard]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const nextBadge = badges.find((b) => !b.unlocked);

  if (!me || !userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-page pi-achievements-page">
      {/* Hero Header */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Achievements & Level Progress 🏆</p>

        {/* Level Ring Card */}
        <div className="pi-level-hero-box">
          <div className="pi-level-ring">
            <span className="pi-level-num">{level.level}</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="pi-level-title">
              Level {level.level} · {level.title}
            </h2>
            <div className="pi-progress-track" style={{ marginTop: 8, height: 10 }}>
              <div
                className="pi-progress-fill"
                style={{ width: `${Math.round(level.progress * 100)}%` }}
              />
            </div>
            <p className="pi-muted" style={{ color: "#EDE9FE", fontSize: 12, marginTop: 4 }}>
              {level.xp.toLocaleString()} XP · {Math.max(0, level.next - level.xp).toLocaleString()} XP to Level {level.level + 1}
            </p>
          </div>
        </div>

        <div className="pi-hero-actions" style={{ marginTop: 14 }}>
          <Link className="pi-chip" href="/home">
            ← Home
          </Link>
          <span className="pi-hero-date">
            {unlockedCount} / {badges.length} UNLOCKED
          </span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Summary Metric Cards */}
        <div className="pi-achv-summary-grid">
          <div className="pi-card pi-card-glass pi-achv-summary-box">
            <span className="pi-achv-summary-num" style={{ color: "#10B981" }}>
              {unlockedCount}
            </span>
            <span className="pi-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Badges Unlocked
            </span>
          </div>
          <div className="pi-card pi-card-glass pi-achv-summary-box">
            <span className="pi-achv-summary-num" style={{ color: "var(--text-3)" }}>
              {badges.length - unlockedCount}
            </span>
            <span className="pi-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Badges Locked
            </span>
          </div>
        </div>

        {/* Next Badge Progress Card */}
        {nextBadge && (
          <section className="pi-card pi-card-glass" style={{ borderColor: nextBadge.color }}>
            <div className="pi-card-head">
              <h2>Next Badge Goal</h2>
              <span className="pi-badge pi-badge-accent">IN PROGRESS</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                className="pi-badge-icon-box"
                style={{ backgroundColor: `${nextBadge.color}20` }}
              >
                <span style={{ fontSize: 28 }}>{nextBadge.emoji}</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="pi-card-title" style={{ fontSize: 16 }}>
                  {nextBadge.title}
                </h3>
                <p className="pi-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  {nextBadge.desc}
                </p>
                <div className="pi-progress-track" style={{ height: 8 }}>
                  <div
                    className="pi-progress-fill"
                    style={{
                      width: `${Math.round(nextBadge.progress * 100)}%`,
                      backgroundColor: nextBadge.color,
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
                  <span className="pi-muted">Progress:</span>
                  <strong>
                    {nextBadge.current.toLocaleString()} / {nextBadge.target.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* All Badges List */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>All Badges ({badges.length})</h2>
          </div>

          <div className="pi-badge-list">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`pi-badge-card ${b.unlocked ? "pi-badge-unlocked" : "pi-badge-locked"}`}
              >
                <div
                  className="pi-badge-icon-box"
                  style={{
                    backgroundColor: b.unlocked ? `${b.color}20` : "var(--bg-2)",
                    filter: b.unlocked ? "none" : "grayscale(100%)",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{b.emoji}</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 className="pi-card-title-sm" style={{ fontSize: 15 }}>
                      {b.title}
                    </h3>
                    {b.unlocked ? (
                      <span className="pi-badge pi-badge-live" style={{ fontSize: 10 }}>
                        ✓ UNLOCKED
                      </span>
                    ) : (
                      <span className="pi-muted" style={{ fontSize: 11, fontWeight: 700 }}>
                        LOCKED
                      </span>
                    )}
                  </div>
                  <p className="pi-muted" style={{ fontSize: 12, margin: "2px 0 6px" }}>
                    {b.desc}
                  </p>

                  <div className="pi-progress-track" style={{ height: 6 }}>
                    <div
                      className="pi-progress-fill"
                      style={{
                        width: `${Math.round(b.progress * 100)}%`,
                        backgroundColor: b.unlocked ? b.color : "var(--border)",
                      }}
                    />
                  </div>
                  <p className="pi-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {b.current.toLocaleString()} / {b.target.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
