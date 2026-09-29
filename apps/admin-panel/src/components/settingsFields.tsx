import React from "react";

// Admin settings inputs bound to a platformSettings form (key → string).

export const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 };
export const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 };

export function NumField({ label, k, form, set, min, unit, placeholder }: {
  label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void;
  min?: number; unit?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="number" min={min} value={form[k] ?? ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} style={inputStyle} />
        {unit ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>{unit}</span> : null}
      </div>
    </div>
  );
}

export function TextField({ label, k, form, set, placeholder }: {
  label: string; k: string; form: Record<string, string>; set: (k: string, v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="text" value={form[k] ?? ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value.trim())} style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 500 }} />
    </div>
  );
}

export function FeeField({ title, hint, enabledKey, percentKey, form, set }: {
  title: string; hint: string; enabledKey: string; percentKey: string;
  form: Record<string, string>; set: (k: string, v: string) => void;
}) {
  const on = form[enabledKey] === "1";
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: on ? "var(--ok-weak)" : "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 800 }}>{title}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <input type="checkbox" checked={on} onChange={(e) => set(enabledKey, e.target.checked ? "1" : "0")} />
          {on ? "ON" : "OFF"}
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="number" min={0} max={100} step="0.1" value={form[percentKey] ?? ""} onChange={(e) => set(percentKey, e.target.value)} style={inputStyle} disabled={!on} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>%</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-3)", margin: "6px 0 0" }}>{hint}</p>
    </div>
  );
}
