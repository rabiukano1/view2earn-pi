"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/cookies";

/**
 * GDPR-style cookie consent banner. Shows once until the visitor accepts or
 * rejects; their choice is persisted in the `v2e_consent` cookie. Only an
 * "accepted" choice lets the VisitorTracker log analytics to Convex.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === "") {
      setVisible(true);
    }
  }, []);

  const decide = (choice: "accepted" | "rejected") => {
    setConsent(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className="cookie-banner-inner">
        <div className="cookie-banner-text">
          <strong>We use cookies</strong>
          <span>
            We use essential cookies to run the site, and — if you accept — simple
            analytics cookies to understand how visitors use it. See our{" "}
            <Link href="/cookies">Cookie Policy</Link> for details.
          </span>
        </div>
        <div className="cookie-banner-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide("rejected")}>
            Reject
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => decide("accepted")}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
