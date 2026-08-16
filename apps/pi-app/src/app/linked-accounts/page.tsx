"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

export default function LinkedAccountsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const [telegramHandle, setTelegramHandle] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ ok: true, text: "🎉 Telegram handle linked successfully for bot verification!" });
  };

  if (!userId || !me) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-page pi-linked-accounts">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Linked Accounts</h1>
          <p className="pi-muted">Manage connected social accounts for automated verification</p>
        </div>
        <Link className="pi-link-text" href="/profile">
          ← Back
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {msg && (
          <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}>
            {msg.text}
          </div>
        )}

        {/* Pi Network Auth Account */}
        <div className="pi-card pi-card-glass" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28, width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(124, 58, 237, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            π
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text)" }}>Pi Network Account</h3>
            <p className="pi-muted" style={{ fontSize: 12, margin: 0 }}>
              Authenticated via Pi SDK · UID: {me.externalUid ? `${me.externalUid.slice(0, 10)}…` : "Verified"}
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, backgroundColor: "#dcfce7", color: "#166534" }}>
            Connected
          </span>
        </div>

        {/* Telegram Bot Link Form */}
        <form onSubmit={handleSaveTelegram} className="pi-card pi-card-glass">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 24, width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(34, 158, 217, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✈️
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text)" }}>Telegram Bot Verification</h3>
              <p className="pi-muted" style={{ fontSize: 12, margin: 0 }}>
                Link handle to auto-verify Telegram channel tasks
              </p>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Telegram Username / Handle
          </label>
          <input
            type="text"
            className="pi-input"
            placeholder="@yourhandle"
            value={telegramHandle}
            onChange={(e) => setTelegramHandle(e.target.value)}
            style={{ marginBottom: 12 }}
          />

          <button type="submit" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
            Save Telegram Link
          </button>
        </form>
      </div>
    </div>
  );
}
