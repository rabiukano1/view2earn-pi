"use client";

import { useState, useEffect } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { PageHeader } from "@/components/ui";

type Category = "all" | "ads" | "spins" | "streaks" | "quiz" | "referrals";

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "all", label: "All Settings", icon: "⚙️" },
  { key: "ads", label: "Ads", icon: "📺" },
  { key: "spins", label: "Spins & Mystery Box", icon: "🎰" },
  { key: "streaks", label: "Streaks & Combos", icon: "🔥" },
  { key: "quiz", label: "Quiz & Academy", icon: "🧠" },
  { key: "referrals", label: "Referral Program", icon: "👥" },
];

export default function RewardsPage() {
  const settingsData = useAdminQuery(api.admin.getRewardSettings);
  const setRewardSettings = useAdminMutation(api.admin.setRewardSettings);

  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [jsonMode, setJsonMode] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settingsData) {
      const initial: Record<string, string> = {};
      for (const [key, s] of Object.entries(settingsData)) {
        initial[key] = formatValue(key, s.value);
      }
      setForm(initial);
    }
  }, [settingsData]);

  function formatValue(key: string, val: string): string {
    if (key === "streakSchedule" || key === "mysteryBoxPrizes" || key === "spinPrizes") {
      try {
        return JSON.stringify(JSON.parse(val), null, 2);
      } catch {
        return val;
      }
    }
    return val;
  }

  function updateField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function resetToDefault(key: string) {
    if (!settingsData?.[key]) return;
    const def = settingsData[key].defaultValue;
    setForm((f) => ({ ...f, [key]: formatValue(key, def) }));
  }

  async function saveAll() {
    setSaving(true);
    setSuccessMsg("");
    try {
      const payload: Record<string, string> = {};
      for (const key of Object.keys(form)) {
        payload[key] = form[key];
      }
      await setRewardSettings({ settings: payload });
      setSuccessMsg("Reward economy settings updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  }

  // Parse helpers
  const streakList: number[] = (() => {
    try {
      const parsed = JSON.parse(form.streakSchedule || "[]");
      return Array.isArray(parsed) ? parsed : [10, 20, 30, 50, 75, 100, 200];
    } catch {
      return [10, 20, 30, 50, 75, 100, 200];
    }
  })();

  function updateStreakDay(dayIdx: number, value: number) {
    const next = [...streakList];
    next[dayIdx] = value;
    updateField("streakSchedule", JSON.stringify(next));
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <PageHeader
        title="Reward & Economy Settings"
        sub="Configure point yields, streak multipliers, mystery box odds, spin wheel rates, and referral bonuses"
        action={
          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "⚡ Save All Settings"}
          </button>
        }
      />

      {/* Success Notification Banner */}
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

      {/* Economy Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Ad Watch Yield
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--accent)", marginTop: 4 }}>
            +{form.adRewardPoints || "50"} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>PTS</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Per rewarded video view</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Day 7 Streak Reward
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706", marginTop: 4 }}>
            +{streakList[6] ?? 200} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>PTS</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Max weekly check-in bonus</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Referrer Bonus
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#2563eb", marginTop: 4 }}>
            +{form.referralQualifiedBonus || "100"} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>PTS</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Per qualified referral</div>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`btn btn-sm ${activeCategory === cat.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveCategory(cat.key)}
            style={{ borderRadius: 20, paddingLeft: 16, paddingRight: 16 }}>
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* SECTION 1: Ads */}
      {(activeCategory === "all" || activeCategory === "ads") && (
        <div className="card" style={{ marginBottom: 20, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>📺 Ad Watching</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Configure points awarded per ad view</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetToDefault("adRewardPoints"); }}>
              Reset Section
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Points Awarded Per Ad View
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={form.adRewardPoints ?? "50"}
                  onChange={(e) => updateField("adRewardPoints", e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Daily Check-in Streak & Combos */}
      {(activeCategory === "all" || activeCategory === "streaks") && (
        <div className="card" style={{ marginBottom: 20, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🔥 Streaks & Daily Combos</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>7-day check-in reward progression and combo bonus points</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetToDefault("streakSchedule"); resetToDefault("comboBonus"); }}>
              Reset Section
            </button>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>
                7-Day Streak Rewards Progression (Day 1 → Day 7)
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setJsonMode((m) => ({ ...m, streakSchedule: !m.streakSchedule }))}>
                {jsonMode.streakSchedule ? "Visual Editor" : "JSON Code"}
              </button>
            </div>

            {jsonMode.streakSchedule ? (
              <textarea
                rows={3}
                value={form.streakSchedule ?? ""}
                onChange={(e) => updateField("streakSchedule", e.target.value)}
                style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum, idx) => (
                  <div key={dayNum} style={{ background: "var(--surface-2)", padding: 10, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-3)", marginBottom: 4 }}>DAY {dayNum}</div>
                    <input
                      type="number"
                      min="0"
                      value={streakList[idx] ?? 0}
                      onChange={(e) => updateStreakDay(idx, Number(e.target.value))}
                      style={{ width: "100%", textAlign: "center", fontWeight: 800, fontSize: 14, padding: "6px 2px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>PTS</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
              Daily Combo Completion Bonus
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 280 }}>
              <input
                type="number"
                min="0"
                value={form.comboBonus ?? "50"}
                onChange={(e) => updateField("comboBonus", e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Spins & Mystery Box */}
      {(activeCategory === "all" || activeCategory === "spins") && (
        <div className="card" style={{ marginBottom: 20, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🎰 Spin Wheel & Mystery Box</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Configure spin cooldowns, daily box requirements, and prize pools</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetToDefault("spinPrizes"); resetToDefault("mysteryBoxPrizes"); resetToDefault("baseSpinsPerWindow"); resetToDefault("spinWindowHours"); resetToDefault("adBonusSpinsPerWindow"); resetToDefault("mysteryBoxTasksNeeded"); }}>
              Reset Section
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Base Spins per Window
              </label>
              <input
                type="number"
                min="1"
                value={form.baseSpinsPerWindow ?? "3"}
                onChange={(e) => updateField("baseSpinsPerWindow", e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Spin Refill Window (Hours)
              </label>
              <input
                type="number"
                min="1"
                value={form.spinWindowHours ?? "3"}
                onChange={(e) => updateField("spinWindowHours", e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Bonus Ad Spins per Window
              </label>
              <input
                type="number"
                min="0"
                value={form.adBonusSpinsPerWindow ?? "2"}
                onChange={(e) => updateField("adBonusSpinsPerWindow", e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Tasks Needed for Daily Mystery Box
              </label>
              <input
                type="number"
                min="1"
                value={form.mysteryBoxTasksNeeded ?? "3"}
                onChange={(e) => updateField("mysteryBoxTasksNeeded", e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Spin Wheel Prize Pool (JSON)
              </label>
              <textarea
                rows={5}
                value={form.spinPrizes ?? ""}
                onChange={(e) => updateField("spinPrizes", e.target.value)}
                style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Mystery Box Prize Pool (JSON)
              </label>
              <textarea
                rows={5}
                value={form.mysteryBoxPrizes ?? ""}
                onChange={(e) => updateField("mysteryBoxPrizes", e.target.value)}
                style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Quiz & Academy */}
      {(activeCategory === "all" || activeCategory === "quiz") && (
        <div className="card" style={{ marginBottom: 20, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🧠 Quiz & Academy Rewards</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Points awarded for correct quiz answers and passing academy levels</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetToDefault("quizCorrectPoints"); resetToDefault("academyLevelPoints"); }}>
              Reset Section
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Points per Correct Quiz Answer
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={form.quizCorrectPoints ?? "10"}
                  onChange={(e) => updateField("quizCorrectPoints", e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Points per Academy Level Passed
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={form.academyLevelPoints ?? "100"}
                  onChange={(e) => updateField("academyLevelPoints", e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Referral Program */}
      {(activeCategory === "all" || activeCategory === "referrals") && (
        <div className="card" style={{ marginBottom: 20, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>👥 Referral Program Settings</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>Rewards for referrers and referees, plus task qualification threshold</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetToDefault("referralQualifiedBonus"); resetToDefault("referralRefereeBonus"); resetToDefault("referralQualificationTasks"); }}>
              Reset Section
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Referrer Reward (Qualified)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={form.referralQualifiedBonus ?? "100"}
                  onChange={(e) => updateField("referralQualifiedBonus", e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Referee Welcome Bonus
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={form.referralRefereeBonus ?? "50"}
                  onChange={(e) => updateField("referralRefereeBonus", e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>PTS</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                Tasks Required for Referee to Qualify
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="1"
                  value={form.referralQualificationTasks ?? "5"}
                  onChange={(e) => updateField("referralQualificationTasks", e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontWeight: 700 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>tasks</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
