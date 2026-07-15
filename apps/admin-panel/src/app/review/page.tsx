"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { Modal, PageHeader, EmptyRow, RiskBadge, timeAgo } from "@/components/ui";

const FILTERS = [
  { value: "ADMIN_REVIEW", label: "Needs review" },
  { value: "PROOF_SUBMITTED", label: "Proof submitted" },
  { value: "PENDING_HOLD", label: "On hold" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

export default function ReviewPage() {
  const [filter, setFilter] = useState("ADMIN_REVIEW");
  const rows = useAdminQuery(api.admin.listVerifications, filter ? { state: filter } : {});
  const approve = useAdminMutation(api.admin.approveVerification);
  const reject = useAdminMutation(api.admin.rejectVerification);
  const [preview, setPreview] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Review queue"
        sub={`${rows?.length ?? "—"} verifications`}
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
      <div className="card table-wrap">
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
            {rows?.map((r) => (
              <tr key={r._id}>
                <td>
                  {r.screenshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.screenshotUrl}
                      alt="proof screenshot"
                      className="shot-thumb"
                      onClick={() => setPreview(r.screenshotUrl)}
                    />
                  ) : (
                    <span className="badge badge-gray">none</span>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{r.username}</td>
                <td><RiskBadge score={r.fraudScore} tier={r.fraudTier} /></td>
                <td>{r.taskLabel}</td>
                <td className="num">+{r.points}</td>
                <td className="num">
                  {r.aiConfidence != null ? `${(r.aiConfidence * 100).toFixed(0)}%` : "—"}
                </td>
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
                    {(r.state === "ADMIN_REVIEW" || r.state === "PROOF_SUBMITTED") && (
                      <>
                        <button
                          className="btn btn-ok btn-sm"
                          onClick={() => act(() => approve({ verificationId: r._id }))}>
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => act(() => reject({ verificationId: r._id }))}>
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && <EmptyRow colSpan={9} text="Nothing here" />}
          </tbody>
        </table>
      </div>

      <Modal title="Proof screenshot" open={preview !== null} onClose={() => setPreview(null)}>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="proof screenshot full size" className="shot-full" />
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
