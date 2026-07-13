"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { PageHeader, timeAgo } from "@/components/ui";

const STATE_LABELS: [string, string][] = [
  ["USER_CLAIMED_DONE", "Claimed"],
  ["PROOF_SUBMITTED", "Proof submitted"],
  ["ADMIN_REVIEW", "Admin review"],
  ["PENDING_HOLD", "On hold"],
  ["RELEASED", "Released"],
  ["REJECTED", "Rejected"],
  ["CANCELLED", "Cancelled"],
];

export default function DashboardPage() {
  const stats = useQuery(api.admin.getStats);
  const counts = stats?.stateCounts ?? {};
  const maxCount = Math.max(1, ...STATE_LABELS.map(([k]) => counts[k] ?? 0));

  return (
    <div>
      <PageHeader title="Dashboard" sub="Live overview of the View2Earn platform" />

      <div className="stats">
        <div className="stat-card">
          <div className="label">Total users</div>
          <div className="value">{stats?.totalUsers ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active tasks</div>
          <div className="value">{stats?.activeTasks ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending review</div>
          <div className="value">{stats?.pendingReview ?? "—"}</div>
          <div className="hint">verifications waiting on an admin</div>
        </div>
        <div className="stat-card">
          <div className="label">Redemptions</div>
          <div className="value">{stats?.redemptions ?? "—"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="card" style={{ paddingBottom: 10 }}>
          <h2>Verification pipeline</h2>
          <div style={{ height: 8 }} />
          {STATE_LABELS.map(([key, label]) => {
            const count = counts[key] ?? 0;
            return (
              <div className="meter-row" key={key}>
                <span className="meter-label">{label}</span>
                <div className="meter-track">
                  <div
                    className="meter-fill"
                    style={{ width: `${(count / maxCount) * 100}%`, opacity: count === 0 ? 0 : 1 }}
                  />
                </div>
                <span className="meter-value">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h2>Recent points activity</h2>
          <div style={{ height: 8 }} />
          {stats?.recentActivity?.length ? (
            stats.recentActivity.map((a) => (
              <div className="activity-item" key={a._id}>
                <span className="who">{a.username}</span>
                <span className="what">{a.reason.toLowerCase().replace(/_/g, " ")}</span>
                <span className={`delta ${a.delta >= 0 ? "pos" : "neg"}`}>
                  {a.delta >= 0 ? "+" : ""}{a.delta}
                </span>
                <span className="when">{timeAgo(a.at)}</span>
              </div>
            ))
          ) : (
            <div className="activity-item" style={{ color: "var(--text-3)" }}>
              No activity yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
