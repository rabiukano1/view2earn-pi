"use client";

import { useState, useEffect } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type Kind = "ADS" | "SURVEY" | "VAS";
type PlatformKind = "pi-web" | "sidra-mobile" | "both";
type ProviderForm = { kind: Kind; name: string; platform: PlatformKind; configJson: string };

const EMPTY: ProviderForm = { kind: "ADS", name: "", platform: "both", configJson: "{}" };

export default function ProvidersPage() {
  const providers = useAdminQuery(api.admin.listProviders);
  const createProvider = useAdminMutation(api.admin.createProvider);
  const updateProvider = useAdminMutation(api.admin.updateProvider);
  const toggle = useAdminMutation(api.admin.toggleProvider);
  const deleteProvider = useAdminMutation(api.admin.deleteProvider);
  const platformSettings = useAdminQuery(api.admin.getPlatformSettings);
  const setAdRewardPoints = useAdminMutation(api.admin.setAdRewardPoints);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"providers"> | null>(null);
  const [form, setForm] = useState<ProviderForm>(EMPTY);
  const [globalReward, setGlobalReward] = useState<number>(50);
  const [rewardSaving, setRewardSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (p: NonNullable<typeof providers>[number]) => {
    setEditing(p._id);
    setForm({ kind: p.kind, name: p.name, platform: p.platform, configJson: p.configJson });
    setOpen(true);
  };

  useEffect(() => {
    if (!platformSettings) return;
    const setting = platformSettings.find((s) => s.key === "adRewardPoints");
    if (setting?.value) {
      const num = Number(setting.value);
      if (!isNaN(num) && num >= 0) setGlobalReward(num);
    }
  }, [platformSettings]);

  const saveGlobalReward = async () => {
    setRewardSaving(true);
    try {
      await setAdRewardPoints({ rewardPoints: globalReward });
      alert('Reward updated successfully');
    } catch (e) {
      alert(String(e));
    } finally {
      setRewardSaving(false);
    }
  };

  const save = async () => {
    try {
      JSON.parse(form.configJson); // validate before saving
    } catch {
      alert("Config must be valid JSON");
      return;
    }
    try {
      if (editing) {
        await updateProvider({ providerId: editing, name: form.name, configJson: form.configJson });
      } else {
        await createProvider(form);
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Providers"
        sub="Ad networks, survey walls and VAS integrations"
        action={<button className="btn btn-primary" onClick={openCreate}>+ New provider</button>}
      />
      <div className="card" style={{ marginBottom: 16, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>
              GLOBAL AD REWARD
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>
              Points awarded per ad view across all providers
            </div>
          </div>
          <input
            type="number"
            min="0"
            value={globalReward}
            onChange={(e) => setGlobalReward(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <button className="btn btn-primary btn-sm" onClick={saveGlobalReward} disabled={rewardSaving}>
            {rewardSaving ? "Saving..." : "Update"}
          </button>
        </div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Platform</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {providers?.map((p) => (
              <tr key={p._id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className="badge badge-gray">{p.kind}</span></td>
                <td>{p.platform}</td>
                <td>
                  <span className={`badge ${p.enabled ? "badge-green" : "badge-gray"}`}>
                    {p.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className={`btn btn-sm ${p.enabled ? "btn-ghost" : "btn-ok"}`}
                      onClick={() => toggle({ providerId: p._id, enabled: !p.enabled })}>
                      {p.enabled ? "Disable" : "Enable"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        confirmThen(`Delete provider "${p.name}"?`, () =>
                          deleteProvider({ providerId: p._id }),
                        )
                      }>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!providers || providers.length === 0) && (
              <EmptyRow colSpan={5} text="No providers configured — add your first ad or survey network" />
            )}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? "Edit provider" : "New provider"} open={open} onClose={() => setOpen(false)}>
        {!editing && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
              QUICK PRESETS (1-CLICK TEMPLATES)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setForm({
                    kind: "ADS",
                    name: "Google AdMob",
                    platform: "both",
                    configJson: JSON.stringify(
                      {
                        network: "admob",
                        adMobAndroidUnitId: "ca-app-pub-3940256099942544/5224354917",
                        adMobIosUnitId: "ca-app-pub-3940256099942544/1712485313",
                        rewardPoints: 50,
                        isTestMode: true,
                      },
                      null,
                      2
                    ),
                  })
                }>
                ⚡ AdMob Preset
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setForm({
                    kind: "ADS",
                    name: "Unity Ads",
                    platform: "both",
                    configJson: JSON.stringify(
                      {
                        network: "unity",
                        unityGameId: "1234567",
                        unityPlacementId: "Rewarded_Android",
                        rewardPoints: 50,
                        isTestMode: true,
                      },
                      null,
                      2
                    ),
                  })
                }>
                ⚡ Unity Ads
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setForm({
                    kind: "ADS",
                    name: "ironSource",
                    platform: "both",
                    configJson: JSON.stringify(
                      {
                        network: "ironsource",
                        ironSourceAppKey: "123456789",
                        rewardPoints: 50,
                        isTestMode: true,
                      },
                      null,
                      2
                    ),
                  })
                }>
                ⚡ ironSource
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setForm({
                    kind: "ADS",
                    name: "AppLovin MAX",
                    platform: "both",
                    configJson: JSON.stringify(
                      {
                        network: "applovin",
                        appLovinSdkKey: "YOUR_SDK_KEY",
                        appLovinAdUnitId: "YOUR_AD_UNIT_ID",
                        rewardPoints: 50,
                        isTestMode: true,
                      },
                      null,
                      2
                    ),
                  })
                }>
                ⚡ AppLovin MAX
              </button>
            </div>
          </div>
        )}

        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Google AdMob"
          />
        </Field>
        <div className="form-grid">
          <Field label="Kind">
            <select
              value={form.kind}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))}>
              <option value="ADS">ADS</option>
              <option value="SURVEY">SURVEY</option>
              <option value="VAS">VAS</option>
            </select>
          </Field>
          <Field label="Platform">
            <select
              value={form.platform}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as PlatformKind }))}>
              <option value="both">both</option>
              <option value="pi-web">pi-web</option>
              <option value="sidra-mobile">sidra-mobile</option>
            </select>
          </Field>
        </div>
        {form.kind === "ADS" && (
          <Field label="Reward Points per Ad View">
            <input
              type="number"
              min="0"
              value={(() => {
                try {
                  const p = JSON.parse(form.configJson);
                  return p.rewardPoints ?? 50;
                } catch {
                  return 50;
                }
              })()}
              onChange={(e) => {
                const num = Number(e.target.value);
                let parsed = {} as Record<string, any>;
                try {
                  parsed = JSON.parse(form.configJson);
                } catch {}
                parsed.rewardPoints = num;
                setForm((f) => ({ ...f, configJson: JSON.stringify(parsed, null, 2) }));
              }}
              placeholder="50"
            />
          </Field>
        )}
        <Field label="Config (JSON)">
          <textarea
            rows={7}
            value={form.configJson}
            onChange={(e) => setForm((f) => ({ ...f, configJson: e.target.value }))}
            style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12.5 }}
          />
        </Field>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            {editing ? "Save changes" : "Create provider"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
