"use client";

import { useState } from "react";
import { useAdminQuery, useAdminMutation } from "../useAdmin";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "@convex/dataModel";

const FEATURE_KEYS = [
  { key: "feature:tasks", label: "Tasks", app: "Mobile App", place: "Tab Bar & Home Screen" },
  { key: "feature:quiz", label: "Daily Quiz", app: "Mobile App", place: "Home Screen & Tasks" },
  { key: "feature:spin", label: "Spin & Win", app: "Mobile App", place: "Home Screen" },
  { key: "feature:surveys", label: "Surveys", app: "Mobile App", place: "Tasks Tab" },
  { key: "feature:wallet", label: "Wallet Tab", app: "Mobile App", place: "Tab Bar" },
  { key: "feature:rewards", label: "Rewards", app: "Mobile App", place: "Tab Bar & Home Screen" },
  { key: "feature:promote", label: "Promote Hub", app: "Mobile App", place: "Home Screen (Top Action)" },
  { key: "feature:academy", label: "Academy (Learn)", app: "Mobile App", place: "Home Screen" },
  { key: "feature:donate", label: "Donate Pi", app: "Mobile App", place: "Wallet Tab / Balances" },
  { key: "feature:videoUpload", label: "Video Uploads", app: "Mobile App", place: "Community Videos (upload button)" },
];

export default function FeaturesPage() {
  const platformSettings = useAdminQuery(api.admin.getPlatformSettings);
  const setPlatformSetting = useAdminMutation(api.admin.setPlatformSetting);
  const allUsers = useAdminQuery(api.admin.listUsers);
  const allLevels = useAdminQuery(api.levels.getAdminLevels);
  const featureToggles = useAdminQuery(api.features.getFeatureToggles);
  const setFeatureToggle = useAdminMutation(api.features.setFeatureToggle);

  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "users" | "levels">("global");
  const [selectedUser, setSelectedUser] = useState<Id<"users"> | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  if (!platformSettings || !allUsers || !allLevels) {
    return <div className="card">Loading...</div>;
  }

  // Get effective flags for selected user
  const selectedUserObj = allUsers.find((u) => u._id === selectedUser);

  const handleGlobalToggle = async (key: string, currentValue: string | undefined) => {
    setSaving(key);
    try {
      const nextValue = currentValue === "false" ? "true" : "false";
      await setPlatformSetting({ key, value: nextValue });
    } finally {
      setSaving(null);
    }
  };

  const handlePerUserToggle = async (featureKey: string, currentEnabled?: boolean) => {
    if (!selectedUser) return;
    setSaving(`${selectedUser}-${featureKey}`);
    try {
      const nextValue = currentEnabled !== true ? true : undefined; // undefined = remove override
      await setFeatureToggle({ userId: selectedUser, featureKey, enabled: nextValue });
    } finally {
      setSaving(null);
    }
  };

  const handlePerLevelToggle = async (featureKey: string, currentEnabled?: boolean) => {
    if (selectedLevel === null) return;
    setSaving(`${selectedLevel}-${featureKey}`);
    try {
      const nextValue = currentEnabled !== true ? true : undefined; // undefined = remove override
      await setFeatureToggle({ level: selectedLevel, featureKey, enabled: nextValue });
    } finally {
      setSaving(null);
    }
  };

  const isUserOverride = (featureKey: string): boolean | undefined => {
    if (!selectedUser || !featureToggles) return undefined;
    const ov = featureToggles.find(
      (t) => t.userId === selectedUser && t.featureKey === featureKey
    );
    return ov?.enabled;
  };

  const isLevelOverride = (featureKey: string): boolean | undefined => {
    if (selectedLevel === null || !featureToggles) return undefined;
    const ov = featureToggles.find(
      (t) => t.level === selectedLevel && t.featureKey === featureKey
    );
    return ov?.enabled;
  };

  return (
    <>
      <header>
        <h1>Feature Toggles</h1>
        <p>Instantly hide or show core modules in the mobile app without an OTA update. Control per-user and per-level overrides.</p>
      </header>

      <div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { key: "global" as const, label: "Global Toggles" },
          { key: "users" as const, label: `Per-User (${allUsers.length})` },
          { key: "levels" as const, label: `Per-Level (${allLevels.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`btn ${activeTab === key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "global" && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>App & Place</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_KEYS.map(({ key, label, app, place }) => {
                const setting = platformSettings.find((s) => s.key === key);
                const isActive = setting?.value !== "false";
                return (
                  <tr key={key}>
                    <td>
                      <strong>{label}</strong>
                      <br />
                      <small style={{ color: "#64748B" }}>Key: {key}</small>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{app}</span>
                      <br />
                      <small style={{ color: "#64748B" }}>{place}</small>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                          fontWeight: "bold",
                          backgroundColor: isActive ? "#DEF7EC" : "#FDE8E8",
                          color: isActive ? "#03543F" : "#9B1C1C",
                        }}
                      >
                        {isActive ? "ENABLED" : "DISABLED"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{
                          backgroundColor: isActive ? "#EF4444" : "#10B981",
                          borderColor: isActive ? "#EF4444" : "#10B981",
                          color: "white"
                        }}
                        disabled={saving === key}
                        onClick={() => handleGlobalToggle(key, setting?.value)}
                      >
                        {saving === key ? "Saving..." : isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "users" && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <select
              value={selectedUser ?? ""}
              onChange={(e) => setSelectedUser(e.target.value ? (e.target.value as Id<"users">) : null)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <option value="">Select a user...</option>
              {allUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.username} (Tier {u.tier}) — {u.accountStatus ?? "active"}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--surface)", borderRadius: 8 }}>
                <strong>{selectedUserObj?.username}</strong> — Tier {selectedUserObj?.tier} | Fraud: {selectedUserObj?.fraudScore} | {selectedUserObj?.accountStatus ?? "active"}
                {isUserOverride("feature:tasks") !== undefined && (
                  <span style={{ marginLeft: 12, color: "var(--primary)" }}>
                    ⚡ Has custom feature overrides
                  </span>
                )}
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Global</th>
                    <th>Override</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_KEYS.map(({ key, label }) => {
                    const globalVal = platformSettings.find((s) => s.key === key)?.value !== "false";
                    const overrideVal = isUserOverride(key);
                    return (
                      <tr key={key}>
                        <td><strong>{label}</strong></td>
                        <td>{globalVal ? "ON" : "OFF"}</td>
                        <td>
                          {overrideVal === undefined ? (
                            <span style={{ color: "var(--text-3)" }}>inherited</span>
                          ) : overrideVal ? (
                            <span style={{ color: "#10B981" }}>ON (override)</span>
                          ) : (
                            <span style={{ color: "#EF4444" }}>OFF (override)</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm"
                            style={{
                              backgroundColor: overrideVal === true ? "#EF4444" : "#10B981",
                              borderColor: overrideVal === true ? "#EF4444" : "#10B981",
                              color: "white",
                              padding: "4px 10px",
                            }}
                            disabled={saving === `${selectedUser}-${key}`}
                            onClick={() => handlePerUserToggle(key, overrideVal)}
                          >
                            {saving === `${selectedUser}-${key}` ? "..." : overrideVal === true ? "Turn OFF" : "Turn ON"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeTab === "levels" && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <select
              value={selectedLevel ?? ""}
              onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <option value="">Select a level...</option>
              {allLevels.map((l) => (
                <option key={l.level} value={l.level}>
                  Level {l.level}: {l.name} ({l.enabled ? "Enabled" : "Disabled"})
                </option>
              ))}
            </select>
          </div>

          {selectedLevel && (
            <>
              <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--surface)", borderRadius: 8 }}>
                <strong>Level {selectedLevel} overrides</strong> — all users at this tier will get these feature overrides.
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Global</th>
                    <th>Override</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_KEYS.map(({ key, label }) => {
                    const globalVal = platformSettings.find((s) => s.key === key)?.value !== "false";
                    const overrideVal = isLevelOverride(key);
                    return (
                      <tr key={key}>
                        <td><strong>{label}</strong></td>
                        <td>{globalVal ? "ON" : "OFF"}</td>
                        <td>
                          {overrideVal === undefined ? (
                            <span style={{ color: "var(--text-3)" }}>inherited</span>
                          ) : overrideVal ? (
                            <span style={{ color: "#10B981" }}>ON (override)</span>
                          ) : (
                            <span style={{ color: "#EF4444" }}>OFF (override)</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm"
                            style={{
                              backgroundColor: overrideVal === true ? "#EF4444" : "#10B981",
                              borderColor: overrideVal === true ? "#EF4444" : "#10B981",
                              color: "white",
                              padding: "4px 10px",
                            }}
                            disabled={saving === `${selectedLevel}-${key}`}
                            onClick={() => handlePerLevelToggle(key, overrideVal)}
                          >
                            {saving === `${selectedLevel}-${key}` ? "..." : overrideVal === true ? "Turn OFF" : "Turn ON"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}
