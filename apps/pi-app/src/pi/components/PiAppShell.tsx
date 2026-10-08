"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import type { ReactNode } from "react";
import { PiBottomNav } from "./PiBottomNav";
import { useIsTelegram } from "@/pi/telegram";
import { PiToaster } from "@/pi/ui/toast";

// App chrome, not web chrome: a compact top bar and the floating tab bar, with
// nothing below the content. Sign-out and the legal pages live on /profile —
// a site footer full of link columns is the main thing that made this read as
// a web page embedded in Pi Browser rather than an app.

export function PiAppShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  const tg = useIsTelegram();

  return (
    <div className="pi-shell">
      <header className="pi-nav">
        <div className="container pi-nav-inner">
          <Link href="/home" className="pi-brand">
            <img
              src="/icon.png"
              alt=""
              className="pi-brand-mark"
              width={32}
              height={32}
            />
            View2Earn
            <span className="pi-brand-tag">{tg ? "TG" : "PI"}</span>
          </Link>
          {me ? (
            <Link href="/profile" className="pi-nav-user" aria-label="Your profile">
              @{me.username}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="container pi-main">{children}</main>

      <PiBottomNav />
      <PiToaster />
    </div>
  );
}
