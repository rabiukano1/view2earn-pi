"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

export default function StatsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const streak = useQuery(api.streaks.getStreak, userId ? { userId } : "skip");
  const history = useQuery(api.points.history, userId ? { userId, limit: 50 } : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId || !me) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const historyItems = history ?? [];
  const totalEarned = historyItems.reduce((acc, curr) => (curr.delta > 0 ? acc + curr.delta : acc), 0);
  const totalSpent = historyItems.reduce((acc, curr) => (curr.delta < 0 ? acc + Math.abs(curr.delta) : acc), 0);
  const tasksCount = historyItems.filter((h) => h.reason === "TASK_CLAIM").length;

  return (
    <div className="pi-page pi-stats">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Earning Analytics</h1>
          <p className="pi-muted">Performance stats & daily breakdown</p>
        </div>
        <Link className="pi-link-text" href="/profile">
          ← Back
        </Link>
      </div>

      {/* Grid of Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div className="pi-card pi-card-glass" style={{ padding: 16 }}>
          <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
            Current Balance
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "var(--accent-2)" }}>
            {balance ?? 0} PTS
          </span>
        </div>
        <div className="pi-card pi-card-glass" style={{ padding: 16 }}>
          <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
            Lifetime Points
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "var(--ok)" }}>
            +{totalEarned} PTS
          </span>
        </div>
        <div className="pi-card pi-card-glass" style={{ padding: 16 }}>
          <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
            Tasks Completed
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
            {tasksCount} Tasks
          </span>
        </div>
        <div className="pi-card pi-card-glass" style={{ padding: 16 }}>
          <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
            Streak Record
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#F59E0B" }}>
            🔥 {streak?.longest ?? 0} Days
          </span>
        </div>
      </div>

      {/* Activity Distribution */}
      <section className="pi-card pi-card-glass" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Earning Summary</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Total Points Earned</span>
              <span style={{ fontWeight: 800, color: "var(--ok)" }}>+{totalEarned} PTS</span>
            </div>
            <div className="pi-progress-track">
              <div className="pi-progress-fill" style={{ width: "100%", backgroundColor: "var(--ok)" }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>Points Spent & Redeemed</span>
              <span style={{ fontWeight: 800, color: "var(--danger)" }}>-{totalSpent} PTS</span>
            </div>
            <div className="pi-progress-track">
              <div
                className="pi-progress-fill"
                style={{
                  width: `${totalEarned > 0 ? Math.min(100, (totalSpent / totalEarned) * 100) : 0}%`,
                  backgroundColor: "var(--danger)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div style={{ textAlign: "center" }}>
        <Link href="/wallet" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
          View Detailed Ledger History →
        </Link>
      </div>
    </div>
  );
}
