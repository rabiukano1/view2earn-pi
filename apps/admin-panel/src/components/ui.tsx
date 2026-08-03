"use client";

import { ReactNode, useEffect } from "react";

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-row">
        {text}
      </td>
    </tr>
  );
}

export function confirmThen(message: string, action: () => void) {
  if (window.confirm(message)) {
    action();
  }
}

// Fraud score + tier badge. Tier string is computed server-side (from core's
// fraudTier) so thresholds stay in one place.
const RISK_BADGE: Record<string, string> = {
  normal: "badge-green",
  watch: "badge-yellow",
  restricted: "badge-red",
  banned: "badge-red",
};

export function RiskBadge({ score, tier }: { score: number; tier: string }) {
  return (
    <span className={`badge ${RISK_BADGE[tier] ?? "badge-gray"}`} title={`fraud score ${score}`}>
      {score} · {tier}
    </span>
  );
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
