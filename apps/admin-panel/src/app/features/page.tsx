"use client";

import { useState } from "react";
import { useAdminQuery, useAdminMutation } from "../useAdmin";
import { api } from "../../../../../convex/_generated/api";

const FEATURE_KEYS = [
  { key: "feature:tasks", label: "Tasks (Tab & Home)" },
  { key: "feature:quiz", label: "Daily Quiz" },
  { key: "feature:spin", label: "Spin & Win" },
  { key: "feature:surveys", label: "Surveys" },
  { key: "feature:wallet", label: "Wallet Tab" },
  { key: "feature:rewards", label: "Rewards (Tab & Home)" },
  { key: "feature:promote", label: "Promote Hub" },
  { key: "feature:academy", label: "Academy (Learn)" },
  { key: "feature:donate", label: "Donate Pi" },
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
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_KEYS.map(({ key, label }) => {
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
