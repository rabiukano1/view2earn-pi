"use client";

import { useState } from "react";
import { useAdminQuery, useAdminMutation } from "../useAdmin";
import { api } from "../../../../../convex/_generated/api";

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
];

export default function FeaturesPage() {
  const platformSettings = useAdminQuery(api.admin.getPlatformSettings);
  const setPlatformSetting = useAdminMutation(api.admin.setPlatformSetting);

  const [saving, setSaving] = useState<string | null>(null);

  if (!platformSettings) {
    return <div className="card">Loading...</div>;
  }

  const handleToggle = async (key: string, currentValue: string | undefined) => {
    setSaving(key);
    try {
      // If undefined, assume it's true by default, so we toggle it to false
      const nextValue = currentValue === "false" ? "true" : "false";
      await setPlatformSetting({ key, value: nextValue });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <header>
        <h1>Feature Toggles</h1>
        <p>Instantly hide or show core modules in the mobile app without an OTA update.</p>
      </header>

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
              const isActive = setting?.value !== "false"; // Default true
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
                      onClick={() => handleToggle(key, setting?.value)}
                    >
                      {saving === key ? "Saving..." : isActive ? "Disable Feature" : "Enable Feature"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
