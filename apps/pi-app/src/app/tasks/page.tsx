"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { webTargetUrl } from "@view2earn/core";
import { openLink, useIsTelegram } from "@/pi/telegram";

// In the Pi Browser, tasks live on Fireside Forum only (Pi's own social app, so
// users stay inside the Pi Browser: no external redirects). In the Telegram
// Mini App every platform is allowed. Flow per task:
//   Open -> I completed it (claim) -> Upload screenshot (proof) -> review -> paid.
const PLATFORM_EMOJI: Record<string, string> = {
  fireside: "🔥", telegram: "✈️", youtube: "▶️", tiktok: "🎵", facebook: "🅵",
  instagram: "📸", x: "🐦", whatsapp: "💬", linkedin: "💼", app: "⭐",
};
const platformOf = (t: { platform?: string }) => (t.platform ?? "").toLowerCase();

const STATE_LABEL: Record<string, string> = {
  USER_CLAIMED_DONE: "Upload a screenshot as proof",
  PROOF_SUBMITTED: "⏳ Proof received — under review",
  ADMIN_REVIEW: "⏳ Under admin review",
  PENDING_HOLD: "⏳ Approved — points on hold, releasing soon",
  REJECTED: "❌ Rejected — upload a clearer screenshot",
};

export default function PiTasks() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const tasks = useQuery(api.tasks.list, userId ? { userId } : "skip");
  const mine = useQuery(api.verifications.listMine, userId ? { userId } : "skip");
  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const claim = useMutation(api.verifications.claim);
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl);
  const submitProof = useMutation(api.verifications.submitProof);

  const tg = useIsTelegram();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<Id<"verifications"> | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const fireside = (tasks ?? []).filter((t) => tg || platformOf(t) === "fireside");
  const byTask = new Map((mine ?? []).map((v) => [v.taskId, v]));
  const totalPts = fireside.reduce((s, t) => s + (t.points || 0), 0);

  const doClaim = async (taskId: Id<"tasks">) => {
    setBusyId(taskId);
    setMsg(null);
    try {
      await claim({ taskId, userId });
      setMsg({ ok: true, text: "Now upload a screenshot showing you completed it." });
    } catch (e) {
      setMsg({ ok: false, text: String(e).replace("[CONVEX] ", "") });
    } finally {
      setBusyId(null);
    }
  };

  const pickProof = (verificationId: Id<"verifications">) => {
    uploadTarget.current = verificationId;
    fileInput.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const verificationId = uploadTarget.current;
    e.target.value = "";
    if (!file || !verificationId) return;
    setBusyId(verificationId);
    setMsg(null);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await submitProof({ verificationId, storageId });
      setMsg({ ok: true, text: "Screenshot submitted — points are credited after review." });
    } catch (err) {
      setMsg({ ok: false, text: String(err).replace("[CONVEX] ", "") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pi-page pi-tasks-page">
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />

      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">{tg ? "🚀 Tasks & Engagement Hub" : "🔥 Fireside Forum Tasks"}</p>
        <p className="pi-balance-label">Total Available Points to Claim</p>
        <p className="pi-balance-value">{totalPts.toLocaleString()} PTS</p>
        <div className="pi-hero-actions">
          <span className="pi-chip">My Balance: {balance === undefined ? "…" : `${balance} PTS`}</span>
          <Link className="pi-chip" href="/wallet">{tg ? "Wallet →" : "Withdraw Pi →"}</Link>
        </div>
      </div>

      <div className="pi-home-body">
        {msg && (
          <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`} style={{ textAlign: "center" }}>
            {msg.text}
          </div>
        )}

        {tasks === undefined ? (
          <div className="pi-centered"><div className="pi-spinner" /></div>
        ) : fireside.length === 0 ? (
          <section className="pi-card pi-empty">
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{tg ? "No tasks right now" : "No Fireside tasks right now"}</p>
            <p className="pi-muted">Check back soon for new task drops.</p>
          </section>
        ) : (
          <div className="pi-task-list">
            {fireside.map((t) => {
              const v = byTask.get(t._id);
              const busy = busyId === t._id || (v ? busyId === v._id : false);
              const canUpload = v && (v.state === "USER_CLAIMED_DONE" || v.state === "REJECTED");
              return (
                <section key={t._id} className="pi-card pi-card-glass pi-task-card-modern">
                  <div className="pi-task-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="pi-platform-badge-icon" style={{ backgroundColor: "rgba(249,115,22,0.14)", color: "#F97316" }}>{PLATFORM_EMOJI[platformOf(t)] ?? "🌐"}</div>
                      <div>
                        <h3 className="pi-card-title" style={{ fontSize: 16 }}>{t.name || `${t.platform} Task`}</h3>
                        <p className="pi-muted" style={{ fontSize: 12 }}>{t.platform} · {t.type.replaceAll("_", " ")}</p>
                      </div>
                    </div>
                    <span className="pi-badge pi-badge-accent" style={{ fontSize: 13, fontWeight: 800 }}>+{t.points} PTS</span>
                  </div>

                  {Array.isArray(t.steps) && t.steps.length > 0 && (
                    <div className="pi-task-steps-box">
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

                  {v && <p className="pi-muted" style={{ fontSize: 12, marginTop: 8 }}>{STATE_LABEL[v.state] ?? v.state}</p>}

                  <div className="pi-task-card-footer" style={{ display: "grid", gap: 8 }}>
                    {t.targetUrl && (
                      <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => openLink(webTargetUrl(t.platform, t.targetUrl))}>
                        {PLATFORM_EMOJI[platformOf(t)] ?? "🌐"} Open task ↗
                      </button>
                    )}
                    {!v ? (
                      <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => doClaim(t._id)}>
                        {busy ? "…" : "✅ I completed it"}
                      </button>
                    ) : canUpload ? (
                      <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => pickProof(v._id)}>
                        {busy ? "Uploading…" : "📸 Upload screenshot"}
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <section className="pi-card pi-card-glass" style={{ textAlign: "center", padding: "18px 14px" }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>💡 How it works</p>
          <p className="pi-muted" style={{ fontSize: 12 }}>
            Open the task, do the action (follow, like, join, comment), tap <strong>I completed it</strong>, then upload a screenshot. Points are credited after verification.
          </p>
        </section>
      </div>
    </div>
  );
}
