"use client";

import { useEffect, useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { PageHeader } from "@/components/ui";
import { NumField, TextField, FeeField } from "@/components/settingsFields";

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

  // Withdrawal / deposit / rate settings (platformSettings via rewardsConfig).
  // Only changed keys are saved, so this never overwrites the Rewards page.
  const settingsData = useAdminQuery(api.admin.getRewardSettings);
  const setRewardSettings = useAdminMutation(api.admin.setRewardSettings);
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!settingsData) return;
    const next: Record<string, string> = {};
    for (const [key, s] of Object.entries(settingsData)) next[key] = (s as { value: string }).value;
    setForm({ ...next, ...dirty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  const updateField = (k: string, val: string) => {
    setForm((f) => ({ ...f, [k]: val }));
    setDirty((d) => ({ ...d, [k]: val }));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      await setRewardSettings({ settings: dirty });
      setDirty({});
      setSuccessMsg("Withdrawal settings updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setSavingSettings(false);
    }
  };

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

      {/* Withdrawals & Claims (moved from Rewards) */}
      <div className="card" style={{ padding: 24, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🏦 Withdrawals & Claims</div>
          <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={savingSettings || !Object.keys(dirty).length}>
            {savingSettings ? "Saving..." : "Save withdrawal settings"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 18 }}>
          Each app unlocks claiming and cash-out on its own once it reaches the level below. Claimed points move into the wallet pool, which is what the wallet app withdraws from.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 18 }}>
          <NumField label="Level required to claim / withdraw" k="withdrawMinLevel" form={form} set={updateField} min={1} unit="level" />
          <NumField label="Android override" k="withdrawMinLevel@android" form={form} set={updateField} min={1} unit="level" placeholder="global" />
          <NumField label="Telegram override" k="withdrawMinLevel@telegram" form={form} set={updateField} min={1} unit="level" placeholder="global" />
          <NumField label="Pi Browser override" k="withdrawMinLevel@pi-browser" form={form} set={updateField} min={1} unit="level" placeholder="global" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 18 }}>
          <NumField label="Max points per claim (0 = no cap)" k="claimMaxPoints" form={form} set={updateField} min={0} unit="PTS" />
          <NumField label="Min SIDRA withdrawal (0 = none)" k="minWithdrawSidra" form={form} set={updateField} min={0} unit="SIDRA" />
          <NumField label="Min PIPRO withdrawal (0 = none)" k="minWithdrawPipro" form={form} set={updateField} min={0} unit="PIPRO" />
          <NumField label="Min VINTA withdrawal (0 = none)" k="minWithdrawVinta" form={form} set={updateField} min={0} unit="VINTA" />
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, margin: "6px 0 10px" }}>Fees</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 18 }}>
          <FeeField
            title="Withdrawal fee"
            hint="Taken from the payout of every withdrawal (all assets)."
            enabledKey="withdrawFeeEnabled" percentKey="withdrawFeePercent" form={form} set={updateField}
          />
          <FeeField
            title="Promote Hub fee"
            hint="Charged on top of a listing budget. Budget is refundable on cancel; the fee is not."
            enabledKey="promoteFeeEnabled" percentKey="promoteFeePercent" form={form} set={updateField}
          />
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, margin: "6px 0 10px" }}>SIDRA &amp; deposit addresses</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <NumField label="Points per 1 SIDRA (0 = SIDRA off)" k="pointsPerSidra" form={form} set={updateField} min={0} unit="PTS" />
          <TextField label="Platform Sidra Chain address (0x…)" k="platformSidraAddress" form={form} set={updateField} placeholder="0x…" />
          <TextField label="Platform Solana address (PIPRO deposits)" k="platformSolanaAddress" form={form} set={updateField} placeholder="Solana address" />
          <NumField label="Credit per 1 Pi deposited (airtime/data only)" k="piDepositPointsPerPi" form={form} set={updateField} min={0} unit="CR" />
          <TextField label="Stellar anchor domain" k="anchorDomain" form={form} set={updateField} placeholder="testanchor.stellar.org" />
          <TextField label="Anchor asset code" k="anchorAssetCode" form={form} set={updateField} placeholder="SRT" />
          <NumField label="Points per 1 anchor asset (0 = anchor off)" k="anchorPointsPerUnit" form={form} set={updateField} min={0} unit="PTS" />
          <NumField label="Data & airtime: points per ₦1 of cost (0 = off)" k="vasPointsPerNaira" form={form} set={updateField} min={0} unit="PTS" />
        </div>
      </div>
    </div>
  );
}
