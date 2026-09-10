"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { ReactNode } from "react";
import { PiBottomNav } from "./PiBottomNav";

export function PiAppShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();

  return (
    <div className="pi-shell">
      <header className="pi-nav">
        <div className="container pi-nav-inner">
          <Link href="/home" className="pi-brand">
            <img
              src="/icon.png"
              alt="View2Earn Logo"
              className="pi-brand-mark"
              width={40}
              height={40}
              style={{ borderRadius: "12px", objectFit: "contain" }}
            />
            View2Earn
            <span className="pi-brand-tag">PI</span>
          </Link>
          {me ? <span className="pi-username pi-nav-user">@{me.username}</span> : null}
          {me ? (
            <button
              type="button"
              className="pi-nav-signout"
              onClick={() => signOut()}
              title="Sign out"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <main className="container pi-main">{children}</main>

      {/* Modernized Dark Glassmorphic Footer */}
      <footer className="pi-footer-modern">
        <div className="container pi-footer-modern-inner">
          <div className="pi-footer-top-row">
            <div className="pi-footer-brand-col">
              <Link href="/home" className="pi-brand" style={{ color: "#FFF" }}>
                <img
                  src="/icon.png"
                  alt="View2Earn Logo"
                  className="pi-brand-mark"
                  width={36}
                  height={36}
                  style={{ borderRadius: "10px", objectFit: "contain" }}
                />
                View2Earn
                <span className="pi-brand-tag">PI</span>
              </Link>
              <p className="pi-footer-tagline">
                Earn instant points & rewards for every social engagement on Pi Network.
              </p>
            </div>

            <div className="pi-footer-links-grid">
              <div className="pi-footer-col">
                <h4>Ecosystem</h4>
                <Link href="/home">Home</Link>
                <Link href="/tasks">Tasks Feed</Link>
                <Link href="/spin">Spin &amp; Win</Link>
                <Link href="/quiz">Daily Quiz</Link>
                <Link href="/leaderboard">Leaderboard</Link>
              </div>

              <div className="pi-footer-col">
                <h4>Growth &amp; Wallet</h4>
                <Link href="/promote">Promote Hub</Link>
                <Link href="/redeem">Rewards</Link>
                <Link href="/wallet">Pi Wallet</Link>
                <Link href="/referral">Referral Program</Link>
                <Link href="/payout-settings">Payout Settings</Link>
              </div>

              <div className="pi-footer-col">
                <h4>Legal Center</h4>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/cookies">Cookie Policy</Link>
                <Link href="/anti-fraud">Anti-Fraud Policy</Link>
                <Link href="/rewards-redemption">Rewards Policy</Link>
                <Link href="/terms">Terms of Service</Link>
              </div>
            </div>
          </div>

          <div className="pi-footer-bottom-row">
            <span className="pi-footer-copy">
              © {new Date().getFullYear()} View2Earn. Powered by Pi Network Developer SDK.
            </span>
            <div className="pi-footer-bottom-actions">
              <button type="button" className="pi-footer-signout-btn" onClick={() => signOut()}>
                🚪 Sign out of session
              </button>
            </div>
          </div>
        </div>
      </footer>

      <PiBottomNav />
    </div>
  );
}
