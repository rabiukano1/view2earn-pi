"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  telegram: "Telegram",
  instagram: "Instagram",
  app: "In-app",
};

const PLATFORM_EMOJI: Record<string, string> = {
  facebook: "🅵",
  tiktok: "🎵",
  telegram: "✈️",
  instagram: "📸",
  app: "⭐",
};

// Pi task feed (plan §7.3 / §7.9c). Reads the same shared task feed as the
// mobile apps. Opening the link on a low-data device is handled by the app
// chooser; the proof step runs in the mobile app.
export default function PiTasks() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const tasks = useQuery(api.tasks.list, userId ? { userId } : "skip");
  const limits = useQuery(api.tasks.myLimits, userId ? { userId } : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const openTask = (url: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pi-page">
      <div className="pi-page-head">
        <h1>Earn tasks</h1>
        <p className="pi-muted">Follow, join and engage — points credit after verification.</p>
      </div>

      {limits && (
        <div className="pi-limits">
          {limits.map((l) => (
            <span key={l.platform} className="pi-limit-chip">
              {PLATFORM_EMOJI[l.platform]} {PLATFORM_LABEL[l.platform]}: {l.remaining}/{l.limit} today
            </span>
          ))}
        </div>
      )}

      {tasks === undefined ? (
        <div className="pi-centered"><div className="pi-spinner" /></div>
      ) : tasks.length === 0 ? (
        <section className="pi-card pi-empty">
          <p>No tasks available right now. Check back soon!</p>
        </section>
      ) : (
        <div className="pi-task-list">
          {tasks.map((t) => (
            <section key={t._id} className="pi-card pi-task">
              <div className="pi-task-icon">
                {PLATFORM_EMOJI[t.platform] ?? "💠"}
              </div>
              <div className="pi-task-body">
                <div className="pi-task-top">
                  <h3>{t.name || PLATFORM_LABEL[t.type] || "Task"}</h3>
                  <span className="pi-badge pi-badge-accent">+{t.points} pts</span>
                </div>
                <p className="pi-muted">
                  {PLATFORM_LABEL[t.platform] ?? t.platform} · {t.type.replaceAll("_", " ")}
                </p>
                {Array.isArray(t.steps) && t.steps.length > 0 ? (
                  <ul className="pi-steps">
                    {t.steps.map((s, i) => (
                      <li key={i}>{s.label || s.action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {t.targetUrl ? (
                <button className="btn btn-primary btn-sm" onClick={() => openTask(t.targetUrl)}>
                  Open
                </button>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <p className="pi-hint-block">
        Proof screenshots are submitted from the View2Earn mobile app. The Pi web app keeps you
        connected to your balance and available tasks in the Pi Browser.
      </p>
    </div>
  );
}
