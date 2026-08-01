"use client";

import { useEffect, useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { PageHeader } from "@/components/ui";

export default function ExchangePage() {
  const rate = useAdminQuery(api.admin.getExchangeRate);
  const setExchangeRate = useAdminMutation(api.admin.setExchangeRate);

  const [pointsPerPipro, setPointsPerPipro] = useState<number>(1000);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (rate && rate.pointsPerPipro > 0) {
      setPointsPerPipro(rate.pointsPerPipro);
    }
  }, [rate]);

  const currentRate = rate?.pointsPerPipro ?? null;
  const samplePts = 1000;
  const samplePipro = currentRate ? (samplePts / currentRate).toFixed(4) : "—";

  const save = async () => {
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      await setExchangeRate({ pointsPerPipro });
      setSuccessMsg("Exchange rate updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title="Token Exchange Rate"
        sub="How many points equal 1 PIPRO token. This drives the wallet swap and is independent of reward settings."
        action={
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "💱 Update Rate"}
          </button>
        }
      />

      {successMsg && (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 20px",
            borderRadius: "var(--radius)",
            background: "var(--ok-weak)",
            color: "var(--ok)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "var(--shadow)",
          }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 20px",
            borderRadius: "var(--radius)",
            background: "var(--danger-weak)",
            color: "var(--danger)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "var(--shadow)",
          }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rate Overview Cards */}
      <div className="stats">
        <div className="stat-card">
          <div className="label">Current Rate</div>
          <div className="value" style={{ color: "var(--ok)", display: "flex", alignItems: "baseline", gap: 6 }}>
            {currentRate?.toLocaleString() ?? "—"}
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>PTS / PIPRO</span>
          </div>
          <div className="hint">
            {rate?.updatedAt ? `Updated ${new Date(rate.updatedAt).toLocaleString()}` : "Not set yet — defaults to 1,000"}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Rate Preview</div>
          <div className="value" style={{ color: "var(--accent)", display: "flex", alignItems: "baseline", gap: 6 }}>
            {pointsPerPipro.toLocaleString()}
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>PTS / PIPRO</span>
          </div>
          <div className="hint">Value that will be applied on save</div>
        </div>

        <div className="stat-card">
          <div className="label">Conversion Sample</div>
          <div className="value" style={{ color: "var(--text)", fontSize: 22 }}>
            {samplePts.toLocaleString()} PTS → {samplePipro} PIPRO
          </div>
          <div className="hint">
            {currentRate ? `At the current rate (1 PIPRO = ${currentRate.toLocaleString()} PTS)` : "No rate set yet"}
          </div>
        </div>
      </div>

      {/* Set Rate Card */}
      <div className="card" style={{ maxWidth: 560, padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>💱 Set Exchange Rate</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>
          A higher value means more points are required to buy 1 PIPRO token.
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
          Points per 1 PIPRO Token
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min="1"
            value={pointsPerPipro}
            onChange={(e) => setPointsPerPipro(Number(e.target.value))}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS/PIPRO</span>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--surface-2)",
            fontSize: 12.5,
            color: "var(--text-2)",
          }}>
          Users will see <strong style={{ color: "var(--text)" }}>1 PIPRO = {pointsPerPipro.toLocaleString()} PTS</strong> in the
          app wallet when swapping points.
        </div>
      </div>
    </div>
  );
}
