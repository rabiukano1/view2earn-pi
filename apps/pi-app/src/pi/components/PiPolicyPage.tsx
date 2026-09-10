"use client";

import Link from "next/link";
import { useState } from "react";
import type { PolicyKey } from "@view2earn/core";
import { getPolicyDoc, type PolicyBlock } from "@view2earn/core";

function Block({ block }: { block: PolicyBlock }) {
  switch (block.t) {
    case "h":
      return <h2 className="pi-policy-h">{block.x}</h2>;
    case "s":
      return <h3 className="pi-policy-s">{block.x}</h3>;
    case "p":
      return <p className="pi-policy-p">{block.x}</p>;
    case "l":
      return (
        <ul className="pi-policy-list">
          {block.x.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

const POLICY_NAV = [
  { key: "privacy", label: "Privacy Policy", emoji: "🛡️", href: "/privacy" },
  { key: "cookies", label: "Cookie Policy", emoji: "🍪", href: "/cookies" },
  { key: "anti-fraud", label: "Anti-Fraud Policy", emoji: "🚨", href: "/anti-fraud" },
  { key: "terms", label: "Terms of Service", emoji: "📜", href: "/terms" },
  { key: "rewards-redemption", label: "Rewards Policy", emoji: "🎁", href: "/rewards-redemption" },
];

export function PiPolicyPage({ policy }: { policy: PolicyKey }) {
  const doc = getPolicyDoc(policy);
  const [copiedMail, setCopiedMail] = useState<string | null>(null);

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedMail(email);
      setTimeout(() => setCopiedMail(null), 2000);
    } catch {
      console.log(`Email contact: ${email}`);
    }
  };

  return (
    <div className="pi-policy">
      {/* Hero Header */}
      <div className="pi-hero" style={{ marginBottom: 20 }}>
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Legal &amp; Compliance Center ⚖️</p>
        <h1 className="pi-policy-hero-title">{doc.title}</h1>
        <p className="pi-muted" style={{ color: "#EDE9FE", fontSize: 13, marginTop: 4 }}>
          {doc.badge} · Last Updated: {doc.lastUpdated}
        </p>

        <div className="pi-hero-actions" style={{ marginTop: 16 }}>
          <Link className="pi-chip" href="/profile">
            ← Account Settings
          </Link>
          <span className="pi-hero-date">OFFICIAL DOC</span>
        </div>
      </div>

      {/* Policy Switching Nav Chips */}
      <div className="pi-policy-nav-chips">
        {POLICY_NAV.map((p) => {
          const isActive = p.key === policy;
          return (
            <Link
              key={p.key}
              href={p.href}
              className={`pi-policy-chip ${isActive ? "pi-policy-chip-active" : ""}`}
            >
              <span>{p.emoji}</span>
              <span>{p.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Policy Document Body */}
      <div className="pi-policy-body" style={{ marginTop: 20 }}>
        <section className="pi-card pi-card-glass pi-policy-card">
          {doc.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>

        {/* Support & Legal Contact */}
        <section className="pi-card pi-card-glass pi-policy-card">
          <h2 className="pi-policy-h" style={{ marginTop: 0 }}>
            📬 Legal Contact &amp; Inquiries
          </h2>
          <p className="pi-policy-p">
            For questions, legal notices, or data protection inquiries regarding this policy, please reach out to our team:
          </p>

          <div className="pi-policy-contact">
            <div className="pi-policy-contact-card">
              <span className="pi-policy-contact-label">General Support</span>
              <a href="mailto:support@view2earn.org" className="pi-policy-contact-mail">
                support@view2earn.org
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyEmail("support@view2earn.org")}
                style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
              >
                {copiedMail === "support@view2earn.org" ? "Copied! ✓" : "Copy Email"}
              </button>
            </div>

            <div className="pi-policy-contact-card">
              <span className="pi-policy-contact-label">Legal Notices</span>
              <a href="mailto:legal@view2earn.org" className="pi-policy-contact-mail">
                legal@view2earn.org
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyEmail("legal@view2earn.org")}
                style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
              >
                {copiedMail === "legal@view2earn.org" ? "Copied! ✓" : "Copy Email"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
