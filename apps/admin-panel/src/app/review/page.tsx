"use client";

import { useMemo, useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { Modal, PageHeader, EmptyRow, RiskBadge, confirmThen, timeAgo } from "@/components/ui";

const FILTERS = [
  { value: "ADMIN_REVIEW", label: "Needs review" },
  { value: "PROOF_SUBMITTED", label: "Proof submitted" },
  { value: "PENDING_HOLD", label: "On hold" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

const ACTIONABLE = new Set(["ADMIN_REVIEW", "PROOF_SUBMITTED"]);

export default function ReviewPage() {
  const [filter, setFilter] = useState("ADMIN_REVIEW");
  const rows = useAdminQuery(api.admin.listVerifications, filter ? { state: filter } : {});
  const approve = useAdminMutation(api.admin.approveVerification);
  const reject = useAdminMutation(api.admin.rejectVerification);
  const bulk = useAdminMutation(api.admin.bulkVerifications);
  const [preview, setPreview] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);

  // One section per platform, biggest queue first.
  const groups = useMemo(() => {
    const by = new Map<string, NonNullable<typeof rows>>();
    for (const r of rows ?? []) {
      const key = r.platform || "OTHER";
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(r);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      alert(String(e));
    }
  };

  const bulkAct = (platform: string, ids: string[], action: "approve" | "reject") =>
    confirmThen(`${action === "approve" ? "Approve" : "Reject"} all ${ids.length} ${platform} verifications?`, async () => {
      setBusyPlatform(platform);
      try {
        const res = await bulk({ verificationIds: ids as any, action });
        if (res.skipped) alert(`${res.done} ${action}d, ${res.skipped} skipped (already handled).`);
      } catch (e) {
        alert(String(e));
      } finally {
        setBusyPlatform(null);
      }
    });

  return (
    <div>
      <PageHeader
        title="Review queue"
        sub={`${rows?.length ?? "—"} verifications across ${groups.length} platform${groups.length === 1 ? "" : "s"}`}
        action={
          <select
            className="btn btn-ghost"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ cursor: "pointer" }}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        }
      />

      {rows && rows.length === 0 && (
        <div className="card table-wrap">
          <table><tbody><EmptyRow colSpan={9} text="Nothing here" /></tbody></table>
        </div>
      )}

      {groups.map(([platform, list]) => {
        const pending = list.filter((r) => ACTIONABLE.has(r.state)).map((r) => r._id as string);
        const busy = busyPlatform === platform;
        return (
          <section key={platform} className="card table-wrap" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{platform}</span>
                <span className="badge badge-gray">{list.length}</span>
                {pending.length > 0 && <span className="badge badge-yellow">{pending.length} pending</span>}
              </div>
              {pending.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ok btn-sm" disabled={busy} onClick={() => bulkAct(platform, pending, "approve")}>
                    {busy ? "Working…" : `Approve all (${pending.length})`}
                  </button>
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => bulkAct(platform, pending, "reject")}>
                    {busy ? "Working…" : `Reject all (${pending.length})`}
                  </button>
                </div>
              )}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Screenshot</th>
                  <th>User</th>
                  <th>Risk</th>
                  <th>Task</th>
                  <th>Points</th>
                  <th>AI confidence</th>
                  <th>State</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r._id}>
                    <td>
                      {r.screenshotUrl ? (
                        <div className="flex gap-2 flex-wrap max-w-[120px]">
                          <img
                            src={r.screenshotUrl}
                            alt="proof screenshot"
                            className="shot-thumb"
                            onClick={() => setPreview(r.screenshotUrl!)}
                          />
                          {r.additionalScreenshotsUrls?.filter((url): url is string => Boolean(url)).map((url: string, i: number) => (
                            <img key={i} src={url} alt="additional proof" className="shot-thumb" onClick={() => setPreview(url)} />
                          ))}
                        </div>
                      ) : (
                        <span className="badge badge-gray">none</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.username}</td>
                    <td><RiskBadge score={r.fraudScore} tier={r.fraudTier} /></td>
                    <td>
                      <div className="task-name">{r.taskName || r.taskLabel}</div>
                      <div className="task-url">{r.taskLabel}</div>
                    </td>
                    <td className="num">+{r.points}</td>
                    <td className="num">{r.aiConfidence != null ? `${(r.aiConfidence * 100).toFixed(0)}%` : "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.state === "RELEASED"
                            ? "badge-green"
                            : r.state === "REJECTED" || r.state === "CANCELLED"
                              ? "badge-red"
                              : r.state === "ADMIN_REVIEW"
                                ? "badge-yellow"
                                : "badge-gray"
                        }`}>
                        {r.state.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{timeAgo(r._creationTime)}</td>
                    <td>
                      <div className="row-actions">
                        {ACTIONABLE.has(r.state) && (
                          <>
                            <button className="btn btn-ok btn-sm" onClick={() => act(() => approve({ verificationId: r._id }))}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => act(() => reject({ verificationId: r._id }))}>
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <Modal title="Proof screenshot" open={preview !== null} onClose={() => setPreview(null)}>
        {preview && <img src={preview} alt="proof screenshot full size" className="shot-full" />}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
