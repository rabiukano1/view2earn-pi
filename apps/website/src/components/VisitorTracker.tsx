"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@convex/api";
import { getConsent, recordVisit } from "@/lib/cookies";

// Logs an anonymous visit event to Convex (convex/visitors.ts) so the site
// owner can see real visitor stats. Only fires when the visitor accepted the
// cookie banner (v2e_consent = "accepted") — rejections are never tracked.
export function VisitorTracker() {
  const pathname = usePathname();
  const trackVisit = useMutation(api.visitors.trackVisit);
  const lastSentPath = useRef<string | null>(null);

  useEffect(() => {
    if (getConsent() !== "accepted") return;

    const visit = recordVisit(pathname);
    if (lastSentPath.current === pathname) return;
    lastSentPath.current = pathname;

    const referrer =
      typeof document !== "undefined" && document.referrer
        ? document.referrer.slice(0, 500)
        : undefined;
    const screen =
      typeof window !== "undefined"
        ? `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`
        : undefined;
    const lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language.slice(0, 20)
        : undefined;

    // fire-and-forget; the mutation itself validates/limits
    trackVisit({
      vid: visit.vid,
      path: pathname,
      isNewVisit: visit.isNewVisit,
      visitNumber: visit.visitNumber,
      firstVisitAt: visit.firstVisitAt,
      referrer,
      screen,
      lang,
    }).catch(() => {
      // Non-blocking: never break navigation over analytics.
    });
  }, [pathname, trackVisit]);

  return null;
}
