"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { ReactNode } from "react";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/wallet", label: "Wallet" },
  { href: "/redeem", label: "Redeem" },
];

export function PiAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();

  return (
    <div className="pi-shell">
      <header className="pi-nav">
        <div className="container pi-nav-inner">
          <Link href="/home" className="pi-brand">
            <span className="pi-brand-mark">V</span>
            View2Earn
            <span className="pi-brand-tag">PI</span>
          </Link>
          <nav className="pi-links">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`pi-link ${pathname?.startsWith(n.href) ? "pi-link-active" : ""}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="pi-user">
            {me ? <span className="pi-username">@{me.username}</span> : null}
            <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
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
          </nav>
        </div>
      </footer>
    </div>
  );
}
