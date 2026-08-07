"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  tasks: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  review: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  providers: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  redemptions: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z",
  fraud: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  rewards: "M12 8c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5z M12 2v2 M12 20v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M2 12h2 M20 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  achievements: "M12 2l2.4 4.8L20 8l-3.5 4.5L18 19l-6-3-6 3 1.5-6.5L4 8l5.6-1.2z",
  exchange: "M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3",
};

const links = [
  { href: "/", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/users", label: "Users", icon: ICONS.users },
  { href: "/tasks", label: "Tasks", icon: ICONS.tasks },
  { href: "/review", label: "Review queue", icon: ICONS.review },
  { href: "/providers", label: "Providers", icon: ICONS.providers },
  { href: "/rewards", label: "Rewards", icon: ICONS.rewards },
  { href: "/achievements", label: "Achievements", icon: ICONS.achievements },
  { href: "/exchange", label: "Exchange", icon: ICONS.exchange },
  { href: "/redemptions", label: "Redemptions", icon: ICONS.redemptions },
  { href: "/inquiries", label: "Inquiries", icon: ICONS.exchange },
  { href: "/fraud", label: "Fraud", icon: ICONS.fraud },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand" style={{ gap: '14px' }}>
        <img src="/icon.png" alt="View2Earn Logo" width={60} height={60} style={{ borderRadius: '13px', objectFit: 'contain' }} />
        <div>
          <div className="brand-name" style={{ fontSize: '1.55rem', fontWeight: 800 }}>View2Earn</div>
          <div className="brand-sub">Admin console</div>
        </div>
      </div>
      <nav>
        <div className="nav-label">Manage</div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : ""}>
            <Icon d={l.icon} />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">dev · valuable-ostrich-597</div>
    </aside>
  );
}
