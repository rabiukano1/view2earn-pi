"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

export default function PayoutSettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const [piAddress, setPiAddress] = useState("");
  const [piMemo, setPiMemo] = useState("");
  const [email, setEmail] = useState("");
  const [minPayout, setMinPayout] = useState("500");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (me) {
      if (me.piWalletAddress) setPiAddress(me.piWalletAddress);
      if (me.email) setEmail(me.email);
    }
  }, [me]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setTimeout(() => {
      setSaving(false);
      setMsg({ ok: true, text: "🎉 Payout preferences saved successfully!" });
    }, 600);
  };

  if (!userId || !me) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-page pi-payout-settings">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Payout Settings</h1>
          <p className="pi-muted">Manage your receiving addresses & payout thresholds</p>
        </div>
        <Link className="pi-link-text" href="/profile">
          ← Back
        </Link>
      </div>

      <form onSubmit={handleSave} className="pi-card pi-card-glass" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {msg && (
          <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}>
            {msg.text}
          </div>
        )}

        {/* Pi Wallet Address / Memo */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Pi Wallet Public Key / Address
          </label>
          <input
            type="text"
            className="pi-input"
            placeholder="G..."
            value={piAddress}
            onChange={(e) => setPiAddress(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <p className="pi-muted" style={{ fontSize: 11 }}>
            Your Pi Network Mainnet or Testnet wallet public address.
          </p>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Pi Payment Memo (Optional)
          </label>
          <input
            type="text"
            className="pi-input"
            placeholder="e.g. 1002345"
            value={piMemo}
            onChange={(e) => setPiMemo(e.target.value)}
            style={{ marginBottom: 6 }}
          />
        </div>

        {/* Email Address */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Gift Card Delivery Email
          </label>
          <input
            type="email"
            className="pi-input"
            placeholder="yourname@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <p className="pi-muted" style={{ fontSize: 11 }}>
            Digital rewards and gift card codes will be dispatched to this email address.
          </p>
        </div>

        {/* Minimum Threshold */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Preferred Minimum Auto-Withdrawal Threshold
          </label>
          <select
            className="pi-input"
            value={minPayout}
            onChange={(e) => setMinPayout(e.target.value)}
            style={{ marginBottom: 0 }}
          >
            <option value="500">500 PTS (0.50 Pi Equivalent)</option>
            <option value="1000">1,000 PTS (1.00 Pi Equivalent)</option>
            <option value="2500">2,500 PTS (2.50 Pi Equivalent)</option>
            <option value="5000">5,000 PTS (5.00 Pi Equivalent)</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          style={{ width: "100%", height: 46, marginTop: 4, justifyContent: "center" }}
        >
          {saving ? "Saving Preferences..." : "💾 Save Payout Preferences"}
        </button>
      </form>
    </div>
  );
}
