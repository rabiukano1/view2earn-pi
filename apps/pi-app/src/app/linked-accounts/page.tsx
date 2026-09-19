"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useIsTelegram } from "@/pi/telegram";

// 3-in-1 identity: one View2Earn account across Pi Browser, Telegram and
// Android. This page shows what is linked + per-surface level, and links the
// remaining surfaces with a 6-digit code (no foreign logins — Pi rule).
const SURFACES = [
  { key: "pi-browser", label: "Pi Browser", emoji: "π", tint: "rgba(124,58,237,0.15)" },
  { key: "telegram", label: "Telegram", emoji: "✈️", tint: "rgba(34,158,217,0.15)" },
  { key: "android", label: "Android app", emoji: "🤖", tint: "rgba(16,185,129,0.15)" },
] as const;

export default function LinkedAccountsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;
  const tg = useIsTelegram();

  const overview = useQuery(api.identity.overview, userId ? { userId } : "skip");
  const createCode = useMutation(api.identity.createLinkCode);
  const redeemCode = useMutation(api.identity.redeemLinkCode);

  const [code, setCode] = useState<string>("");
  const [entered, setEntered] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId || !me || !overview) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const here = tg ? "Telegram" : "Pi Browser";
  const other = tg ? "Pi Browser" : "Telegram";

  const onGenerate = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await createCode({ userId });
      setCode(res.code);
      setMsg({ ok: true, text: `Enter this code in the ${other} app within ${res.expiresInMin} minutes.` });
    } catch (e) {
      setMsg({ ok: false, text: String(e).replace("[CONVEX] ", "") });
    } finally { setBusy(false); }
  };

  const onRedeem = async () => {
    if (entered.trim().length !== 6) return;
    setBusy(true); setMsg(null);
    try {
      const res = await redeemCode({ userId, code: entered.trim() });
      setMsg({ ok: true, text: `Linked to @${res.linkedTo}. Signing you in to that account…` });
      // This session belonged to the now-merged account; re-sign-in lands on the target.
      setTimeout(() => { void signOut(); }, 1500);
    } catch (e) {
      setMsg({ ok: false, text: String(e).replace("[CONVEX] ", "") });
    } finally { setBusy(false); }
  };

  return (
    <div className="pi-page pi-linked-accounts">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Linked Accounts</h1>
          <p className="pi-muted">One account across Pi Browser, Telegram and Android</p>
        </div>
        <Link className="pi-link-text" href="/profile">← Back</Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {msg && <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}>{msg.text}</div>}

        {SURFACES.map((s) => {
          const linked = overview.linked[s.key];
          return (
            <div key={s.key} className="pi-card pi-card-glass" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 24, width: 44, height: 44, borderRadius: 12, backgroundColor: s.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {s.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text)" }}>{s.label}</h3>
                <p className="pi-muted" style={{ fontSize: 12, margin: 0 }}>
                  {linked ? `Level ${overview.levels[s.key]} · ${overview.balances[s.key].toLocaleString()} PTS` : "Not linked"}
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, backgroundColor: linked ? "#dcfce7" : "#fee2e2", color: linked ? "#166534" : "#991b1b" }}>
                {linked ? "Linked" : "Missing"}
              </span>
            </div>
          );
        })}

        <div className="pi-card pi-card-glass">
          <p className="pi-card-title-sm" style={{ marginBottom: 6 }}>
            {overview.current !== "wallet" && overview.eligible[overview.current]
              ? "✅ Withdrawals unlocked here"
              : `🔒 Each app unlocks withdrawals on its own at level ${overview.minLevel}`}
          </p>
          <ul className="pi-steps-list">
            {(Object.entries(overview.reasons) as [string, string | null][])
              .filter(([, r]) => r)
              .map(([k, r]) => <li key={k} className="pi-step-item"><span>{r}</span></li>)}
          </ul>
          <p className="pi-muted" style={{ fontSize: 12, marginTop: 8 }}>You can always spend points in Promote Hub.</p>
        </div>

        {/* Link the other surface with a code */}
        <div className="pi-card pi-card-glass">
          <p className="pi-card-title-sm">Link {other}</p>
          <p className="pi-muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Generate a code on the app that already has your points, then enter it on the other app
            (that account must be new, with no points yet).
          </p>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={onGenerate}>
            Generate code (keep this {here} account)
          </button>
          {code && <code style={{ display: "block", textAlign: "center", fontSize: 28, letterSpacing: 6, margin: "12px 0" }}>{code}</code>}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <input
              className="pi-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter code from the other app"
              value={entered}
              onChange={(e) => setEntered(e.target.value.replace(/\D/g, ""))}
              style={{ marginBottom: 0, flex: 1 }}
            />
            <button className="btn btn-secondary" disabled={busy || entered.length !== 6} onClick={onRedeem}>
              Link
            </button>
          </div>
          <p className="pi-muted" style={{ fontSize: 11, marginTop: 8 }}>
            Android: use “Link Pi” / “Link Telegram” inside the Android app.
          </p>
        </div>
      </div>
    </div>
  );
}
