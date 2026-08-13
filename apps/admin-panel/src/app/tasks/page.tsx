"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type StepForm = {
  action: string;
  label: string;
  name: string;
  targetUrl: string;
};

type TaskForm = {
  type: string;
  platform: string;
  name: string;
  targetUrl: string;
  pageId: string;
  points: number;
  verifier: string;
  maxCompletions: number;
  expiresDays: number;
  steps: StepForm[];
};

const EMPTY_STEP: StepForm = { action: "FOLLOW", label: "", name: "", targetUrl: "" };

const EMPTY: TaskForm = {
  type: "FOLLOW_PAGE",
  platform: "facebook",
  name: "",
  targetUrl: "",
  pageId: "",
  points: 50,
  verifier: "screenshot-ai",
  maxCompletions: 1000,
  expiresDays: 30,
  steps: [],
};

const PLATFORM_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  facebook: { label: "Facebook", icon: "📘", color: "#1877F2" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#010101" },
  telegram: { label: "Telegram", icon: "✈️", color: "#229ED9" },
  youtube: { label: "YouTube", icon: "▶️", color: "#FF0000" },
  instagram: { label: "Instagram", icon: "📸", color: "#E4405F" },
  x: { label: "X (Twitter)", icon: "𝕏", color: "#000000" },
  app: { label: "In-App Quiz/Survey", icon: "⚡", color: "#7C3AED" },
};

const ACTION_LABELS: [string, string][] = [
  ["FOLLOW", "Follow"],
  ["JOIN", "Join"],
  ["SUBSCRIBE", "Subscribe"],
  ["LIKE", "Like"],
  ["COMMENT", "Comment"],
];

function buildTargetUrl(platform: string, name: string): string {
  const n = name.trim().replace(/^@/, "");
  if (!n) return "";
  if (platform === "facebook") return `https://facebook.com/${n}`;
  if (platform === "tiktok") return `https://tiktok.com/@${n}`;
  if (platform === "telegram") return `https://t.me/${n}`;
  if (platform === "instagram") return `https://instagram.com/${n}`;
  if (platform === "x") return `https://x.com/${n}`;
  return "";
}

function nameFromUrl(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/^t\.me\//, "")
    .replace(/^facebook\.com\//, "")
    .replace(/^tiktok\.com\/@?/, "")
    .replace(/^instagram\.com\//, "")
    .replace(/^x\.com\//, "")
    .replace(/^twitter\.com\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");
}

const PLACEHOLDERS: Record<string, string> = {
  facebook: "pinetwork",
  tiktok: "@pinetwork",
  telegram: "pinetwork",
  instagram: "@pinetwork",
  x: "@pinetwork",
  app: "Quiz / campaign name",
};

export default function TasksPage() {
  const tasks = useAdminQuery(api.admin.listActiveTasks);
  const createTask = useAdminMutation(api.admin.createTask);
  const updateTask = useAdminMutation(api.admin.updateTask);
  const deleteTask = useAdminMutation(api.admin.deleteTask);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"tasks"> | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY);
  const set = (patch: Partial<TaskForm>) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (t: NonNullable<typeof tasks>[number]) => {
    setEditing(t._id);
    setForm({
      type: t.type,
      platform: t.platform,
      name: t.name ?? (t.targetUrl ? nameFromUrl(t.targetUrl) : ""),
      targetUrl: t.targetUrl,
      pageId: t.pageId ?? "",
      points: t.points,
      verifier: t.verifier,
      maxCompletions: t.maxCompletions,
      expiresDays: Math.max(1, Math.round((t.expiresAt - Date.now()) / 86400000)),
      steps: (t.steps ?? []).map((s) => ({
        action: s.action,
        label: s.label ?? "",
        name: s.name ?? "",
        targetUrl: s.targetUrl,
      })),
    });
    setOpen(true);
  };

  const onNameChange = (value: string) => {
    set({ name: value, targetUrl: buildTargetUrl(form.platform, value) });
  };

  const onPlatformChange = (value: string) => {
    set({ platform: value, targetUrl: buildTargetUrl(value, form.name) });
  };

  const setStep = (index: number, patch: Partial<StepForm>) => {
    setForm((f) => {
      const steps = f.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...f, steps };
    });
  };

  const onStepNameChange = (index: number, value: string) => {
    const step = form.steps[index];
    const targetUrl = buildTargetUrl(form.platform, value);
    let label = step.label;
    if (!label && value) {
      const actionLabel = ACTION_LABELS.find(([a]) => a === step.action)?.[1] ?? "Complete";
      label = `${actionLabel} ${form.platform}`;
    }
    setStep(index, { name: value, label, targetUrl });
  };

  const onStepActionChange = (index: number, action: string) => {
    const step = form.steps[index];
    const actionLabel = ACTION_LABELS.find(([a]) => a === action)?.[1] ?? "Complete";
    setStep(index, {
      action,
      label: step.label ? `${actionLabel} ${form.platform}` : "",
    });
  };

  const save = async () => {
    const { expiresDays, pageId, name, targetUrl, steps, ...rest } = form;
    const trimmedName = name.trim();
    const expiresAt = Date.now() + expiresDays * 86400000;
    const cleanSteps = steps
      .filter((s) => s.targetUrl.trim() || s.name.trim())
      .map((s) => ({
        action: s.action,
        label: s.label.trim() || undefined,
        name: s.name.trim() || undefined,
        targetUrl: s.targetUrl.trim() || buildTargetUrl(form.platform, s.name),
      }))
      .filter((s) => s.targetUrl);
    const fields = {
      ...rest,
      name: trimmedName || undefined,
      targetUrl: trimmedName ? buildTargetUrl(form.platform, trimmedName) : targetUrl,
      pageId: pageId.trim() || undefined,
      steps: form.type === "MULTI_TASK" ? cleanSteps : undefined,
    };
    try {
      if (editing) {
        await updateTask({ taskId: editing, ...fields, expiresAt });
      } else {
        await createTask({ ...fields, expiresAt });
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & Campaign Management"
        sub={`${tasks?.length ?? "—"} total active tasks across all platforms`}
        action={
          <button className="btn btn-primary shadow-lg shadow-purple-500/20" onClick={openCreate}>
            + Create New Task
          </button>
        }
      />

      {/* Task Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center space-x-3 bg-gradient-to-br from-purple-900/30 to-slate-900/40 border border-purple-500/20">
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 text-xl">🎯</div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</div>
            <div className="text-2xl font-bold text-white">{tasks?.length ?? 0}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center space-x-3 bg-gradient-to-br from-blue-900/30 to-slate-900/40 border border-blue-500/20">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 text-xl">⚡</div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Campaigns</div>
            <div className="text-2xl font-bold text-white">{tasks?.filter(t => t.status === "active").length ?? 0}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center space-x-3 bg-gradient-to-br from-emerald-900/30 to-slate-900/40 border border-emerald-500/20">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 text-xl">🎁</div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Reward</div>
            <div className="text-2xl font-bold text-white">
              {tasks && tasks.length > 0 ? Math.round(tasks.reduce((a, b) => a + b.points, 0) / tasks.length) : 0} PTS
            </div>
          </div>
        </div>
        <div className="card p-4 flex items-center space-x-3 bg-gradient-to-br from-amber-900/30 to-slate-900/40 border border-amber-500/20">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 text-xl">🤖</div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Verifier</div>
            <div className="text-2xl font-bold text-white">
              {tasks?.filter(t => t.verifier === "screenshot-ai").length ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Task Table */}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Platform</th>
              <th>Target Handle</th>
              <th>Points</th>
              <th>Verifier</th>
              <th>Status</th>
              <th>Expires</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks?.map((t) => {
              const pConf = PLATFORM_CONFIG[t.platform] ?? { label: t.platform, icon: "🌐", color: "#64748B" };
              return (
                <tr key={t._id}>
                  <td>
                    <span className="font-semibold text-white">{t.type}</span>
                    {t.type === "MULTI_TASK" && Array.isArray(t.steps) && (
                      <div className="text-xs text-purple-400 font-mono mt-1">
                        {t.steps.length} steps: {t.steps.map((s) => s.action).join(" + ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center space-x-2">
                      <span>{pConf.icon}</span>
                      <span className="font-medium text-slate-200 capitalize">{pConf.label}</span>
                    </div>
                  </td>
                  <td className="truncate max-w-xs">
                    <div className="font-semibold text-white">{t.name || "—"}</div>
                    {t.targetUrl && <div className="text-xs font-mono text-slate-400 truncate">{t.targetUrl}</div>}
                  </td>
                  <td className="num font-bold text-emerald-400">+{t.points} PTS</td>
                  <td>
                    <span className="badge badge-gray font-mono text-xs">{t.verifier}</span>
                  </td>
                  <td>
                    <span className={`badge ${t.status === "active" ? "badge-green" : "badge-gray"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="text-slate-400 text-xs">{new Date(t.expiresAt).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions justify-end">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          updateTask({ taskId: t._id, status: t.status === "active" ? "paused" : "active" })
                        }>
                        {t.status === "active" ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          confirmThen("Delete this task? Verifications keep their history.", () =>
                            deleteTask({ taskId: t._id }),
                          )
                        }>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!tasks || tasks.length === 0) && <EmptyRow colSpan={8} text="No tasks yet — create the first one" />}
          </tbody>
        </table>
      </div>

      {/* Modern Add / Edit Task Modal */}
      <Modal title={editing ? "✏️ Edit Task Campaign" : "✨ Create New Task Campaign"} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-5">
          {/* Platform Selector Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Select Platform</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => {
                const active = form.platform === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`p-2.5 rounded-xl border flex items-center space-x-2 text-left transition-all ${
                      active
                        ? "bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-500/10"
                        : "bg-slate-800/50 border-slate-700/60 text-slate-400 hover:border-slate-600"
                    }`}
                    onClick={() => onPlatformChange(key)}>
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="text-xs font-bold truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-grid">
            <Field label="Task Type">
              <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="FOLLOW_PAGE">FOLLOW_PAGE</option>
                <option value="JOIN_CHANNEL">JOIN_CHANNEL</option>
                <option value="MULTI_TASK">MULTI_TASK (multiple bundle steps)</option>
                <option value="QUIZ">QUIZ</option>
                <option value="SURVEY">SURVEY</option>
              </select>
            </Field>
            <Field label="Verification Provider">
              <select value={form.verifier} onChange={(e) => set({ verifier: e.target.value })}>
                <option value="screenshot-ai">screenshot-ai (AI Vision Auto-Review)</option>
                <option value="telegram-bot">telegram-bot (Direct API)</option>
                <option value="bio-code">bio-code (Bio Verification)</option>
                <option value="quiz">quiz (Instant Verification)</option>
              </select>
            </Field>
          </div>

          {form.type === "MULTI_TASK" ? (
            <div className="p-4 bg-slate-900/60 rounded-xl border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  Bundle Steps — User completes every step & uploads 1 screenshot
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, { ...EMPTY_STEP }] }))}>
                  + Add Step
                </button>
              </div>
              {form.steps.length === 0 && (
                <p className="text-xs text-slate-400 py-2">No steps yet — click "+ Add Step" to build the multi-task bundle.</p>
              )}
              {form.steps.map((step, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
                  <div className="col-span-2">
                    <select value={step.action} onChange={(e) => onStepActionChange(i, e.target.value)}>
                      {ACTION_LABELS.map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      value={step.name}
                      onChange={(e) => onStepNameChange(i, e.target.value)}
                      placeholder="Handle / Username"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      value={step.targetUrl}
                      onChange={(e) => setStep(i, { targetUrl: e.target.value })}
                      placeholder="Full Target Link"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      value={step.label}
                      onChange={(e) => setStep(i, { label: e.target.value })}
                      placeholder="Instruction"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      className="btn btn-danger btn-sm p-1.5 text-xs"
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
                      }>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Field
                label={form.platform === "app" ? "Campaign / Quiz Name" : "Page / Channel / Account Handle"}
                hint={
                  form.platform === "app"
                    ? "Shown to users in app task feed"
                    : "Type handle or username — target link is generated automatically"
                }>
                <input
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={PLACEHOLDERS[form.platform] ?? "handle"}
                  autoFocus
                />
              </Field>
              {form.name.trim() && form.platform !== "app" && (
                <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Generated Link:</span>
                  <code className="text-purple-300 font-mono font-semibold">{form.targetUrl}</code>
                </div>
              )}
              {form.platform === "facebook" && (
                <Field label="Facebook Page ID (Optional — Deep-link helper for FB Lite)">
                  <input
                    value={form.pageId}
                    onChange={(e) => set({ pageId: e.target.value })}
                    placeholder="e.g. 100064860796750"
                  />
                </Field>
              )}
            </div>
          )}

          {/* Live Mobile Card Preview Box */}
          <div className="p-3 bg-purple-950/30 rounded-xl border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-lg">
                {PLATFORM_CONFIG[form.platform]?.icon ?? "🌐"}
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {form.name ? `Follow ${form.name}` : `Follow ${PLATFORM_CONFIG[form.platform]?.label} Page`}
                </div>
                <div className="text-[11px] text-purple-300 font-mono">
                  {form.targetUrl || "https://..."}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="badge badge-green font-bold">+{form.points} PTS</span>
            </div>
          </div>

          <div className="form-grid">
            <Field
              label={form.type === "MULTI_TASK" ? "Total Points Reward" : "Points Reward"}
              hint="Awarded to user upon verified completion">
              <input type="number" value={form.points} onChange={(e) => set({ points: Number(e.target.value) })} />
            </Field>
            <Field label="Max User Completions">
              <input
                type="number"
                value={form.maxCompletions}
                onChange={(e) => set({ maxCompletions: Number(e.target.value) })}
              />
            </Field>
            <Field label="Campaign Duration (Days)">
              <input
                type="number"
                value={form.expiresDays}
                onChange={(e) => set({ expiresDays: Number(e.target.value) })}
              />
            </Field>
          </div>

          <div className="modal-actions border-t border-slate-800 pt-4">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary shadow-lg shadow-purple-500/20" onClick={save}>
              {editing ? "Save Task Changes" : "Publish Task Campaign"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
