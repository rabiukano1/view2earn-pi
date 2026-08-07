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
            <img src="/icon.png" alt="View2Earn Logo" className="pi-brand-mark" width={40} height={40} style={{ borderRadius: '12px', objectFit: 'contain' }} />
            View2Earn
            <span className="pi-brand-tag">PI</span>
          </Link>
          {me ? <span className="pi-username pi-nav-user">@{me.username}</span> : null}
        </div>
      </header>
      <main className="container pi-main">{children}</main>
      <footer className="pi-footer">
        <div className="container pi-footer-inner">
          <span>© {new Date().getFullYear()} View2Earn. All rights reserved.</span>
          <nav className="pi-footer-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/anti-fraud">Anti-Fraud</Link>
            <Link href="/rewards-redemption">Rewards &amp; Redemption</Link>
            <Link href="/terms">Terms</Link>
            <button className="pi-signout" onClick={() => signOut()}>
              Sign out
            </button>
          </nav>
        </div>
      </footer>
      <PiBottomNav />
    </div>
  );
}
