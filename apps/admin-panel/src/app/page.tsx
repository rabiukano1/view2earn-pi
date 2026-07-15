"use client";

import { api } from "@convex/api";
import { useAdminQuery } from "./useAdmin";
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

function Meters({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  if (rows.length === 0) {
    return <div className="activity-item" style={{ color: "var(--text-3)" }}>Nothing yet</div>;
  }
  return (
    <>
      {rows.map(([label, v]) => (
        <div className="meter-row" key={label}>
          <span className="meter-label">{label}</span>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${(v / max) * 100}%`, opacity: v === 0 ? 0 : 1 }} />
          </div>
          <span className="meter-value">{v}</span>
        </div>
      ))}
    </>
  );
}

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" } as const;

export default function DashboardPage() {
  const stats = useAdminQuery(api.admin.getStats);
  const analytics = useAdminQuery(api.admin.getAnalytics);
  const counts = stats?.stateCounts ?? {};
  const maxCount = Math.max(1, ...STATE_LABELS.map(([k]) => counts[k] ?? 0));

  const pts = analytics?.points;
  const payoutRatio = pts && pts.issued > 0 ? Math.round((pts.spent / pts.issued) * 100) : 0;

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

      <div style={twoCol}>
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

      {/* Points economy — success rule #2: payout ≤ 50% of what's issued. */}
      <h2 style={{ margin: "22px 0 10px" }}>Points economy</h2>
      <div className="stats">
        <div className="stat-card">
          <div className="label">Points issued</div>
          <div className="value">{pts ? pts.issued.toLocaleString() : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Points spent</div>
          <div className="value">{pts ? pts.spent.toLocaleString() : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Outstanding balance</div>
          <div className="value">{pts ? pts.outstanding.toLocaleString() : "—"}</div>
          <div className="hint">issued − spent, live across all users</div>
        </div>
        <div className="stat-card">
          <div className="label">Payout ratio</div>
          <div className="value" style={{ color: payoutRatio > 50 ? "#EF4444" : undefined }}>
            {pts ? `${payoutRatio}%` : "—"}
          </div>
          <div className="hint">spent ÷ issued · target ≤ 50%</div>
        </div>
      </div>

      <div style={twoCol}>
        <div className="card">
          <h2>User risk tiers</h2>
          <div style={{ height: 8 }} />
          <Meters
            rows={
              analytics
                ? [
                    ["Normal", analytics.tiers.normal],
                    ["Watch", analytics.tiers.watch],
                    ["Restricted", analytics.tiers.restricted],
                    ["Banned", analytics.tiers.banned],
                  ]
                : []
            }
          />
        </div>

        <div className="card">
          <h2>Fraud signals by type</h2>
          <div style={{ height: 8 }} />
          <Meters
            rows={
              analytics
                ? Object.entries(analytics.fraudByType).sort((a, b) => b[1] - a[1])
                : []
            }
          />
        </div>
      </div>

      <div style={twoCol}>
        <div className="card">
          <h2>New users · last 7 days</h2>
          <div style={{ height: 8 }} />
          <Meters
            rows={
              analytics
                ? analytics.newUsersByDay.map(
                    (d) =>
                      [
                        new Date(d.ts).toLocaleDateString(undefined, { weekday: "short" }),
                        d.count,
                      ] as [string, number],
                  )
                : []
            }
          />
        </div>

        <div className="card">
          <h2>Redemptions by status</h2>
          <div style={{ height: 8 }} />
          <Meters
            rows={
              analytics
                ? Object.entries(analytics.redemptionsByStatus).sort((a, b) => b[1] - a[1])
                : []
            }
          />
        </div>
      </div>
    </div>
  );
}
