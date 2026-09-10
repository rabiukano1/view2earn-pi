"use client";

import { useState } from "react";
import { useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { PageHeader, EmptyRow, timeAgo } from "@/components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;

function DayRange({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  const options = [1, 7, 30, 90] as const;
  return (
    <select
      value={days}
      onChange={(e) => setDays(Number(e.target.value))}
      style={{ width: 120 }}>
      {options.map((d) => (
        <option key={d} value={d}>
          Last {d} day{d > 1 ? "s" : ""}
        </option>
      ))}
    </select>
  );
}

export default function VisitorsPage() {
  const [days, setDays] = useState(7);
  const stats = useAdminQuery(api.visitors.getVisitorStats, { since: Date.now() - days * DAY_MS });

  return (
    <div>
      <PageHeader
        title="Website visitors"
        sub="Consent-gated analytics from the public website (apps/website)"
        action={<DayRange days={days} setDays={setDays} />}
      />

      <div className="stats">
        <div className="stat-card">
          <div className="label">Page views</div>
          <div className="value">{stats?.pageViews ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Unique visitors</div>
          <div className="value">{stats?.uniqueVisitors ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">New visits</div>
          <div className="value">{stats?.newVisits ?? "—"}</div>
        </div>
      </div>

      <div className="card" style={{ padding: "18px 22px" }}>
        <h2 style={{ marginBottom: 12 }}>Top pages</h2>
        {(stats?.topPaths?.length ?? 0) === 0 ? (
          <div className="activity-item" style={{ color: "var(--text-3)" }}>
            No views yet in this window
          </div>
        ) : (
          stats!.topPaths.map((p) => (
            <div className="meter-row" key={p.path}>
              <span className="meter-label" style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.path}
              </span>
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${(p.count / stats!.topPaths[0].count) * 100}%` }} />
              </div>
              <span className="meter-value">{p.count}</span>
            </div>
          ))
        )}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Page</th>
              <th>Visit #</th>
              <th>New visit</th>
              <th>Referrer</th>
              <th>Screen</th>
              <th>Lang</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {stats?.recent.map((e) => (
              <tr key={e._id}>
                <td className="mono" style={{ fontSize: 12.5 }}>{e.vid.slice(0, 8)}</td>
                <td className="truncate" style={{ maxWidth: 180 }}>{e.path}</td>
                <td className="num">{e.visitNumber}</td>
                <td>{e.isNewVisit ? <span className="badge badge-green">new</span> : <span className="badge badge-gray">return</span>}</td>
                <td className="truncate" style={{ maxWidth: 140 }}>{e.referrer ?? "—"}</td>
                <td className="num">{e.screen ?? "—"}</td>
                <td>{e.lang ?? "—"}</td>
                <td style={{ color: "var(--text-3)", whiteSpace: "nowrap" }}>{timeAgo(e._creationTime)}</td>
              </tr>
            ))}
            {(!stats?.recent || stats.recent.length === 0) && (
              <EmptyRow colSpan={8} text="No visitor events in this window" />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
