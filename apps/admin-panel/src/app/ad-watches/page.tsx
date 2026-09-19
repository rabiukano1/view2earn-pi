"use client";

import { useState } from "react";
import { useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { PageHeader, EmptyRow, timeAgo } from "@/components/ui";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const KIND_LABEL: Record<string, string> = {
  rewarded: "Rewarded video",
  spin_double: "Spin 2× ad",
  spin_bonus: "Bonus-spin ad",
};

// Admin-only. Ad watch logs and the leaderboard are never shown to users.
export default function AdWatchesPage() {
  const logs = useAdminQuery(api.admin.listAdWatches);
  const board = useAdminQuery(api.admin.adWatchLeaderboard);
  const [tab, setTab] = useState<"log" | "board">("log");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "rewarded" | "spin_double" | "spin_bonus">("all");

  const filtered = (logs ?? []).filter((l) => {
    const s = q.trim().toLowerCase();
    return (kind === "all" || l.kind === kind) && (!s || l.username.toLowerCase().includes(s) || l.provider.toLowerCase().includes(s));
  });

  const downloadCsv = () => {
    const rows = [
      ["watchedAt", "username", "userId", "kind", "provider", "points", "platform"],
      ...filtered.map((l) => [new Date(l.at).toISOString(), l.username, l.userId, l.kind, l.provider, String(l.points), l.economy]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `ad-watches-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pdfAllUsers = () =>
    board &&
    downloadPdf(
      `ad-watch-totals-${new Date().toISOString().slice(0, 10)}.pdf`,
      "Ad watches — all users",
      `${board.topUsers.length} users · ${board.total} ads · ${board.totalPoints.toLocaleString()} PTS paid · ${new Date().toLocaleString()}`,
      ["#", "User", "Ads", "Rewarded", "Spin 2x", "Bonus spin", "Points"],
      [5, 34, 9, 12, 11, 13, 12],
      board.topUsers.map((u, i) => [String(i + 1), u.username, String(u.watches), String(u.rewarded), String(u.spinDouble), String(u.spinBonus), u.points.toLocaleString()]),
    );

  const pdfUser = (userId: string) => {
    const u = board?.topUsers.find((x) => x.userId === userId);
    if (!u) return;
    const mine = (logs ?? []).filter((l) => l.userId === userId);
    downloadPdf(
      `ad-watches-${u.username}-${new Date().toISOString().slice(0, 10)}.pdf`,
      `Ad watches — ${u.username}`,
      `${u.watches} ads · rewarded ${u.rewarded} · spin 2x ${u.spinDouble} · bonus spin ${u.spinBonus} · ${u.points.toLocaleString()} PTS · ${new Date().toLocaleString()}`,
      ["When", "Kind", "Provider", "Points", "Platform"],
      [30, 18, 30, 10, 12],
      mine.map((l) => [new Date(l.at).toLocaleString(), KIND_LABEL[l.kind] ?? l.kind, l.provider, l.points ? `+${l.points}` : "-", l.economy]),
    );
  };

  return (
    <div>
      <PageHeader
        title="Ad watches"
        sub={board ? `${board.total} ads watched · ${board.byKind.rewarded} rewarded · ${board.byKind.spin_double} spin 2× · ${board.byKind.spin_bonus} bonus spin · ${board.totalPoints.toLocaleString()} PTS paid` : "—"}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={pdfAllUsers} disabled={!board?.topUsers.length}>⬇ PDF · all users totals</button>
            <button className="btn btn-primary" onClick={downloadCsv} disabled={!filtered.length}>⬇ CSV · log</button>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className={`btn ${tab === "log" ? "btn-primary" : "btn-ghost"} btn-sm`} onClick={() => setTab("log")}>Watch log</button>
        <button className={`btn ${tab === "board" ? "btn-primary" : "btn-ghost"} btn-sm`} onClick={() => setTab("board")}>Leaderboard</button>
        {tab === "log" && (
          <>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value="all">All kinds</option>
              <option value="rewarded">Rewarded video</option>
              <option value="spin_double">Spin 2× ad</option>
              <option value="spin_bonus">Bonus-spin ad</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by user or provider…" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 220 }} />
          </>
        )}
      </div>

      {tab === "log" ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>When</th><th>User</th><th>Kind</th><th>Provider</th><th>Points</th><th>Platform</th></tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l._id}>
                  <td>{timeAgo(l.at)}</td>
                  <td style={{ fontWeight: 600 }}>{l.username}</td>
                  <td><span className="badge">{KIND_LABEL[l.kind] ?? l.kind}</span></td>
                  <td className="mono truncate">{l.provider}</td>
                  <td>{l.points ? `+${l.points}` : "—"}</td>
                  <td>{l.economy}</td>
                </tr>
              ))}
              {(!logs || filtered.length === 0) && <EmptyRow colSpan={6} text={logs ? "No ad watches match" : "Loading…"} />}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>#</th><th>User</th><th>Ads watched</th><th>Rewarded</th><th>Spin 2×</th><th>Bonus spin</th><th>Points earned</th><th></th></tr></thead>
            <tbody>
              {board?.topUsers.map((u, i) => (
                <tr key={u.userId}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td style={{ fontWeight: 700 }}>{u.watches}</td>
                  <td>{u.rewarded}</td>
                  <td>{u.spinDouble}</td>
                  <td>{u.spinBonus}</td>
                  <td>{u.points.toLocaleString()}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => pdfUser(u.userId)}>PDF</button></td>
                </tr>
              ))}
              {(!board || board.topUsers.length === 0) && <EmptyRow colSpan={8} text="No ad watches yet" />}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Minimal table-to-PDF: monospace-free fixed column widths (in % of the text
// width), auto page breaks, header repeated on every page.
async function downloadPdf(filename: string, title: string, subtitle: string, header: string[], widthsPct: number[], rows: string[][]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 40, LINE = 16, SIZE = 9;
  const textW = W - 2 * M;
  const cols = widthsPct.map((p) => (textW * p) / 100);
  // Standard fonts only cover WinAnsi — usernames with Arabic/emoji etc.
  // would throw at draw time, so anything outside Latin-1 becomes "?".
  const safe = (s: string) => s.replace(/…/g, "...").replace(/×/g, "x").replace(/[—–]/g, "-").replace(/·/g, "-").replace(/[^ -~ -ÿ]/g, "?");
  const clip = (s: string, w: number, f = font) => {
    let t = safe(s);
    while (t.length > 1 && f.widthOfTextAtSize(t, SIZE) > w - 4) t = t.slice(0, -4) + "...";
    return t;
  };

  let page = doc.addPage([W, H]);
  let y = H - M;
  const drawHeader = () => {
    let x = M;
    page.drawRectangle({ x: M, y: y - 4, width: textW, height: LINE, color: rgb(0.93, 0.93, 0.96) });
    header.forEach((h, i) => { page.drawText(clip(h, cols[i], bold), { x: x + 2, y, size: SIZE, font: bold }); x += cols[i]; });
    y -= LINE + 2;
  };

  page.drawText(safe(title), { x: M, y, size: 16, font: bold });
  y -= 20;
  page.drawText(safe(subtitle), { x: M, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
  y -= 22;
  drawHeader();

  for (const r of rows) {
    if (y < M + LINE) {
      page = doc.addPage([W, H]);
      y = H - M;
      drawHeader();
    }
    let x = M;
    r.forEach((c, i) => { page.drawText(clip(c, cols[i]), { x: x + 2, y, size: SIZE, font }); x += cols[i]; });
    y -= LINE;
  }

  const bytes = await doc.save();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
