"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type Form = {
  key: string;
  metric: string;
  target: number;
  icon: string;
  tint: string;
  title: string;
  desc: string;
  enabled: boolean;
  sortOrder: number;
};

const METRIC_OPTIONS: [string, string][] = [
  ["tasks", "Tasks completed"],
  ["earned", "Lifetime points earned"],
  ["streak", "Longest streak (days)"],
  ["referrals", "Friends invited"],
  ["rank", "Top-N leaderboard rank"],
];

const METRIC_HINT: Record<string, string> = {
  tasks: "Progress = tasks the user has completed",
  earned: "Progress = lifetime points earned (XP)",
  streak: "Progress = the user's longest daily streak",
  referrals: "Progress = number of friends invited",
  rank: "Unlocks when the user's leaderboard rank is <= target",
};

const EMPTY: Form = {
  key: "",
  metric: "tasks",
  target: 1,
  icon: "trophy",
  tint: "#7C3AED",
  title: "",
  desc: "",
  enabled: true,
  sortOrder: 1,
};

const TINTS = ["#7C3AED", "#3B82F6", "#F59E0B", "#EF4444", "#10B981", "#06B6D4"];

export default function AchievementsPage() {
  const list = useAdminQuery(api.achievements.listAll);
  const upsert = useAdminMutation(api.achievements.upsert);
  const remove = useAdminMutation(api.achievements.remove);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saveMsg, setSaveMsg] = useState("");
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    const maxOrder = list?.length ? Math.max(...list.map((a) => a.sortOrder)) : 0;
    setForm({ ...EMPTY, sortOrder: maxOrder + 1 });
    setOpen(true);
  };

  const openEdit = (a: NonNullable<typeof list>[number]) => {
    setForm({
      key: a.key,
      metric: a.metric,
      target: a.target,
      icon: a.icon,
      tint: a.tint,
      title: a.title,
      desc: a.desc,
      enabled: a.enabled,
      sortOrder: a.sortOrder,
    });
    setOpen(true);
  };

  const save = async () => {
    setSaveMsg("");
    try {
      const key = form.key.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!key) throw new Error("Key is required (e.g. first-task)");
      await upsert({ ...form, key });
      setOpen(false);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Achievements"
        sub={`${list?.length ?? "—"} badges · shown on the smart profile`}
        action={<button className="btn btn-primary" onClick={openCreate}>+ New achievement</button>}
      />

      {saveMsg && <div className="activity-item">{saveMsg}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Badge</th>
              <th>Title</th>
              <th>Metric</th>
              <th>Target</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list?.map((a) => (
              <tr key={a.key}>
                <td className="num">{a.sortOrder}</td>
                <td>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: `${a.tint}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: a.tint,
                      fontWeight: 800,
                    }}
                    title={a.icon}>
                    {a.icon.slice(0, 2).toUpperCase()}
                  </div>
                </td>
                <td className="truncate">
                  <div className="task-name">{a.title}</div>
                  <div className="task-url">{a.desc}</div>
                </td>
                <td>
                  <span className="badge badge-gray">{a.metric}</span>
                </td>
                <td className="num">{a.metric === "rank" ? `top ${a.target}` : a.target}</td>
                <td>
                  <span className={`badge ${a.enabled ? "badge-green" : "badge-gray"}`}>
                    {a.enabled ? "enabled" : "disabled"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        confirmThen(
                          a.key in DEFAULTS_BY_KEY
                            ? "Reset this achievement to its default?"
                            : "Delete this achievement?",
                          () => remove({ key: a.key }),
                        )
                      }>
                      {a.key in DEFAULTS_BY_KEY ? "Reset" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!list || list.length === 0) && <EmptyRow colSpan={7} text="No achievements yet" />}
          </tbody>
        </table>
      </div>

      <Modal title={form.key && DEFAULTS_BY_KEY[form.key] ? `Edit: ${form.title}` : "New achievement"} open={open} onClose={() => setOpen(false)}>
        <div className="form-grid">
          <Field
            label="Key (id)"
            hint="Lowercase id — set once, used to merge with defaults">
            <input
              value={form.key}
              onChange={(e) => set({ key: e.target.value })}
              placeholder="e.g. first-task"
              disabled={!!form.key && DEFAULTS_BY_KEY[form.key]}
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="form-grid">
          <Field label="Title">
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. First Task" autoFocus />
          </Field>
          <Field label="Description">
            <input value={form.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="e.g. Complete your first task" />
          </Field>
        </div>

        <Field label="Metric" hint={METRIC_HINT[form.metric]}>
          <select value={form.metric} onChange={(e) => set({ metric: e.target.value })}>
            {METRIC_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>

        <Field
          label={form.metric === "rank" ? "Rank threshold (reach top N)" : "Target value"}
          hint={form.metric === "rank" ? "Unlocks at rank <= this number" : undefined}>
          <input
            type="number"
            min={1}
            value={form.target}
            onChange={(e) => set({ target: Number(e.target.value) })}
          />
        </Field>

        <div className="form-grid">
          <Field label="Icon (FontAwesome6 name)">
            <input value={form.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="e.g. trophy" />
          </Field>
          <Field label="Accent color">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {TINTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set({ tint: t })}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: t,
                    border: form.tint === t ? "2px solid var(--text)" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                />
              ))}
              <input
                type="color"
                value={form.tint}
                onChange={(e) => set({ tint: e.target.value })}
                style={{ width: 34, height: 30, border: "1px solid var(--border)", background: "transparent" }}
              />
            </div>
          </Field>
        </div>

        <Field label="Status">
          <select value={form.enabled ? "enabled" : "disabled"} onChange={(e) => set({ enabled: e.target.value === "enabled" })}>
            <option value="enabled">Enabled (shown to users)</option>
            <option value="disabled">Disabled (hidden)</option>
          </select>
        </Field>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            {form.key && DEFAULTS_BY_KEY[form.key] ? "Save changes" : "Create achievement"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Mirror of convex/achievements.ts default keys, so the page can tell a custom
// achievement (fully deletable) from a default one (resettable).
const DEFAULTS_BY_KEY: Record<string, true> = {
  "first-task": true,
  "task-ten": true,
  "task-fifty": true,
  "points-100": true,
  "points-1000": true,
  "points-5000": true,
  "streak-3": true,
  "streak-7": true,
  "streak-30": true,
  "refer-1": true,
  "refer-5": true,
  "rank-top": true,
};
