"use client";

import { useState } from "react";
import { api } from "@convex/api";
import { PW_KEY, useAdminMutation, useAdminQuery } from "../useAdmin";
import { Modal, PageHeader, EmptyRow, RiskBadge, confirmThen, timeAgo } from "@/components/ui";
import { Video, Trash2 } from "lucide-react";

const FILTERS = [
  { value: "PROCESSING", label: "Awaiting review" },
  { value: "ACTIVE", label: "Approved" },
  { value: "BLOCKED", label: "Rejected" },
  { value: "", label: "All" },
];

// Convex HTTP actions live on the .site domain of the same deployment.
const SITE_URL = (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(".convex.cloud", ".convex.site");
// The admin secret lets the proxy serve uploads that are still pending review.
const fileUrl = (id: string, thumb = false) => {
  const token = typeof window === "undefined" ? "" : localStorage.getItem(PW_KEY) ?? "";
  return `${SITE_URL}/video/file?id=${id}${thumb ? "&thumb=1" : ""}&token=${encodeURIComponent(token)}`;
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function VideosPage() {
  const [filter, setFilter] = useState("PROCESSING");
  const rows = useAdminQuery(api.videos.listForReview, filter ? { status: filter } : {});
  const setStatus = useAdminMutation(api.videos.setVideoStatus);
  const remove = useAdminMutation(api.videos.removeVideo);
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = (rows ?? []).filter((r) => r.status === "PROCESSING").map((r) => r._id as string);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      alert(String(e));
    }
  };

  const bulk = (status: "ACTIVE" | "BLOCKED") =>
    confirmThen(`${status === "ACTIVE" ? "Approve" : "Reject"} all ${pending.length} pending videos?`, async () => {
      setBusy(true);
      try {
        await setStatus({ videoIds: pending as any, status });
      } catch (e) {
        alert(String(e));
      } finally {
        setBusy(false);
      }
    });

  return (
    <div>
      <PageHeader
        title="User videos"
        sub="Review uploads before they appear in the app. Files are stored in the private Telegram channel."
        icon={<Video size={24} color="var(--primary)" />}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {pending.length > 0 && (
              <>
                <button className="btn btn-ok btn-sm" disabled={busy} onClick={() => bulk("ACTIVE")}>
                  Approve all ({pending.length})
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => bulk("BLOCKED")}>
                  Reject all ({pending.length})
                </button>
              </>
            )}
            <select className="btn btn-ghost" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ cursor: "pointer" }}>
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Video</th>
              <th>Title</th>
              <th>Uploader</th>
              <th>Risk</th>
              <th>Length</th>
              <th>Views</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && <EmptyRow colSpan={9} text="Nothing here" />}
            {rows?.map((r) => (
              <tr key={r._id}>
                <td>
                  <div
                    onClick={() => setPreview({ id: r._id, title: r.title })}
                    style={{ width: 64, height: 96, borderRadius: 8, background: "#111", cursor: "pointer", overflow: "hidden", display: "grid", placeItems: "center" }}>
                    {r.thumbnailUrl ? (
                      <img src={fileUrl(r._id, true)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Video size={18} color="#666" />
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 700, maxWidth: 260 }}>{r.title}</div>
                  {r.description ? <div style={{ fontSize: 12, color: "var(--text-3)" }}>{r.description}</div> : null}
                </td>
                <td style={{ fontWeight: 600 }}>{r.username}</td>
                <td><RiskBadge score={r.fraudScore} tier={r.fraudScore >= 70 ? "HIGH" : r.fraudScore >= 40 ? "MEDIUM" : "LOW"} /></td>
                <td>{r.durationSeconds ? fmt(r.durationSeconds) : "—"}</td>
                <td className="num">{r.viewsCount}</td>
                <td>
                  <span className={`badge ${r.status === "ACTIVE" ? "badge-green" : r.status === "BLOCKED" ? "badge-red" : "badge-yellow"}`}>
                    {r.status === "PROCESSING" ? "awaiting review" : r.status.toLowerCase()}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-3)" }}>{timeAgo(r.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    {r.status !== "ACTIVE" && (
                      <button className="btn btn-ok btn-sm" onClick={() => act(() => setStatus({ videoIds: [r._id], status: "ACTIVE" }))}>
                        Approve
                      </button>
                    )}
                    {r.status !== "BLOCKED" && (
                      <button className="btn btn-danger btn-sm" onClick={() => act(() => setStatus({ videoIds: [r._id], status: "BLOCKED" }))}>
                        Reject
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete row"
                      onClick={() => confirmThen(`Delete "${r.title}" permanently?`, () => act(() => remove({ id: r._id })))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={preview?.title ?? "Video"} open={preview !== null} onClose={() => setPreview(null)}>
        {preview && (
          <video src={fileUrl(preview.id)} controls autoPlay style={{ width: "100%", maxHeight: "70vh", background: "#000", borderRadius: 8 }} />
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
