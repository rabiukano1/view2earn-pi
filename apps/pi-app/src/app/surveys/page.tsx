"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

// Pi surveys (plan §7.5). Opens the CPX survey wall from the Pi Browser; points
// are credited server-side via the /survey/cpx postback once you finish.
export default function PiSurveys() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const surveys = useQuery(api.surveys.listAvailable, userId ? { userId } : "skip");
  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const getOfferwallUrl = useMutation(api.cpx.getOfferwallUrl);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const openWall = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const url = await getOfferwallUrl({ userId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg({ ok: false, text: String(e).replace("[CONVEX] ", "") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-page pi-surveys">
      {/* Hero */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Earn with surveys 📝</p>
        <p className="pi-balance-label">Points Balance</p>
        <p className="pi-balance-value">{balance === undefined ? "—" : balance}</p>
        <div className="pi-hero-actions">
          <button className="pi-chip pi-chip-btn" onClick={openWall} disabled={busy}>
            {busy ? "Opening…" : "Open Survey Wall"}
          </button>
          <span className="pi-hero-date">Credited automatically on completion</span>
        </div>
      </div>

      {msg ? (
        <p className={`pi-survey-msg ${msg.ok ? "pi-survey-msg-ok" : "pi-survey-msg-err"}`}>{msg.text}</p>
      ) : null}

      <div className="pi-survey-wall pi-card pi-card-glass">
        <p className="pi-card-title">Partner surveys</p>
        <p className="pi-muted pi-survey-wall-sub">
          Answer surveys from our partner wall and get points credited automatically when you finish.
        </p>
        <button className="btn btn-primary pi-full" onClick={openWall} disabled={busy}>
          {busy ? "Opening…" : "Open Survey Wall"}
        </button>
      </div>

      {surveys === undefined ? (
        <div className="pi-centered"><div className="pi-spinner" /></div>
      ) : surveys.length === 0 ? (
        <p className="pi-muted pi-survey-none">More survey partners coming soon.</p>
      ) : (
        <>
          <p className="pi-section-title">Available</p>
          <div className="pi-levels">
            {surveys.map((s, i) => (
              <div key={s.id} className="pi-level-card" style={{ animationDelay: `${i * 45}ms` }}>
                <span className="pi-level-num">📝</span>
                <span className="pi-level-info">
                  <span className="pi-level-title">{s.name}</span>
                  <span className="pi-level-meta">
                    {s.platform === "sidra-mobile" || s.platform === "both"
                      ? "Available on mobile"
                      : "Web survey"}
                  </span>
                </span>
                <button className="pi-level-chev" onClick={openWall}>Start</button>
              </div>
            ))}
          </div>
        </>
      )}

      <section className="pi-card pi-card-glass pi-learn-tip">
        <span className="pi-tip-icon">💡</span>
        <div className="pi-grow">
          <p className="pi-card-title-sm">How it works</p>
          <p className="pi-muted">
            Open the wall, pick a survey and finish it. Once the partner confirms completion,
            your points are added automatically — no need to send proof.
          </p>
        </div>
      </section>
    </div>
  );
}
