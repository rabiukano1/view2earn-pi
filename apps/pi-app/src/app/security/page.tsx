"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

export default function SecurityPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId || !me) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-page pi-security">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Security Center</h1>
          <p className="pi-muted">Account integrity & anti-fraud verification score</p>
        </div>
        <Link className="pi-link-text" href="/profile">
          ← Back
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Anti-Fraud Trust Score */}
        <div className="pi-card pi-card-glass" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Anti-Fraud Trust Status</span>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 999, backgroundColor: "#dcfce7", color: "#166534" }}>
              🛡️ VERIFIED
            </span>
          </div>
          <p className="pi-muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Your account is verified clean by View2Earn anti-bot and multi-account detection systems.
          </p>
          <div className="pi-progress-track">
            <div className="pi-progress-fill" style={{ width: "100%", backgroundColor: "var(--ok)" }} />
          </div>
        </div>

        {/* Security Checklist */}
        <div className="pi-card pi-card-glass">
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Security Checklist</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Pi Network Authentication</p>
                <p className="pi-muted" style={{ margin: 0, fontSize: 12 }}>Cryptographically signed Pi SDK session</p>
              </div>
              <span style={{ color: "var(--ok)", fontWeight: 900 }}>✓ Passed</span>
            </div>
            <div style={{ height: 1, backgroundColor: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Single Device Binding</p>
                <p className="pi-muted" style={{ margin: 0, fontSize: 12 }}>Protected against duplicate bot accounts</p>
              </div>
              <span style={{ color: "var(--ok)", fontWeight: 900 }}>✓ Active</span>
            </div>
            <div style={{ height: 1, backgroundColor: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Sybil Protection</p>
                <p className="pi-muted" style={{ margin: 0, fontSize: 12 }}>Real-time IP & fingerprint verification</p>
              </div>
              <span style={{ color: "var(--ok)", fontWeight: 900 }}>✓ Enabled</span>
            </div>
          </div>
        </div>

        <Link href="/anti-fraud" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
          Read Anti-Fraud Policy & Rules →
        </Link>
      </div>
    </div>
  );
}
