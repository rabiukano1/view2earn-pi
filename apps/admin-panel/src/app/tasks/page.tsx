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

// Real brand icons (Simple Icons path data) for each platform.
const ICON_PATHS: Record<string, string> = {
  facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  telegram:
    "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  instagram:
    "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
};

function PlatformIcon({ platform, color, className }: { platform: string; color?: string; className?: string }) {
  const path = ICON_PATHS[platform];
  if (!path) return <span className={className}>🌐</span>;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877F2" },
  tiktok: { label: "TikTok", color: "#25F4EE" },
  telegram: { label: "Telegram", color: "#229ED9" },
  youtube: { label: "YouTube", color: "#FF0000" },
  instagram: { label: "Instagram", color: "#E4405F" },
  x: { label: "X (Twitter)", color: "#FFFFFF" },
  app: { label: "In-App Quiz/Survey", color: "#7C3AED" },
};

const DEFAULT_ACTIONS: [string, string][] = [
  ["FOLLOW", "Follow"],
  ["JOIN", "Join"],
  ["SUBSCRIBE", "Subscribe"],
  ["LIKE", "Like"],
  ["COMMENT", "Comment"],
];

// Platform-specific multi-task actions. TikTok has no channels/groups, so its
// bundle steps are Follow / Like / Comment / Watch only — no "Join Channel".
const PLATFORM_ACTIONS: Record<string, [string, string][]> = {
  facebook: [
    ["FOLLOW", "Follow"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["JOIN", "Join Group"],
  ],
  tiktok: [
    ["FOLLOW", "Follow"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["WATCH", "Watch Video"],
  ],
  telegram: [
    ["JOIN", "Join Channel"],
    ["COMMENT", "Comment"],
  ],
  youtube: [
    ["SUBSCRIBE", "Subscribe"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["WATCH", "Watch Video"],
  ],
  instagram: [
    ["FOLLOW", "Follow"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["SHARE", "Share"],
  ],
  x: [
    ["FOLLOW", "Follow"],
    ["LIKE", "Like"],
    ["REPOST", "Repost"],
    ["COMMENT", "Comment"],
  ],
};

function actionsFor(platform: string): [string, string][] {
  const list = PLATFORM_ACTIONS[platform];
  return list && list.length > 0 ? list : DEFAULT_ACTIONS;
}

// JOIN_CHANNEL only exists where channels/groups are a real concept — Telegram,
// Facebook groups, YouTube. TikTok/Instagram/X have no channels.
const CHANNEL_PLATFORMS = new Set(["telegram", "facebook", "youtube"]);

function taskTypesFor(platform: string): [string, string][] {
  const base: [string, string][] = [
    ["FOLLOW_PAGE", "Follow / Like Page"],
    ["JOIN_CHANNEL", "Join Channel"],
    ["MULTI_TASK", "Multi-task (bundle steps)"],
    ["QUIZ", "Quiz"],
    ["SURVEY", "Survey"],
  ];
  if (platform === "app") return base.filter(([v]) => v === "QUIZ" || v === "SURVEY");
  if (!CHANNEL_PLATFORMS.has(platform)) return base.filter(([v]) => v !== "JOIN_CHANNEL");
  return base;
}

function previewLabel(form: TaskForm): string {
  const label = PLATFORM_CONFIG[form.platform]?.label ?? form.platform;
  if (form.type === "QUIZ") return `Complete ${form.name || "Quiz"}`;
  if (form.type === "SURVEY") return `Complete ${form.name || "Survey"}`;
  if (form.type === "MULTI_TASK") {
    if (form.steps.length === 0) return `Multi-task on ${label}`;
    const acts = form.steps
      .map((s) => actionsFor(form.platform).find(([a]) => a === s.action)?.[1] ?? s.action)
      .join(" + ");
    return `Bundle: ${acts}`;
  }
  const verb = form.type === "JOIN_CHANNEL" ? "Join" : "Follow";
  return `${verb} ${form.name || `${label} ${form.type === "JOIN_CHANNEL" ? "Channel" : "Page"}`}`;
}

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
    // Auto-fill the target URL from the handle, but only until the admin edits
    // the URL box manually — afterwards keep the custom URL.
    const autoUrl = buildTargetUrl(form.platform, value);
    const isAuto = !form.targetUrl || form.targetUrl === buildTargetUrl(form.platform, form.name);
    set({ name: value, targetUrl: isAuto ? autoUrl : form.targetUrl });
  };

  const onPlatformChange = (value: string) => {
    const allowedTypes = taskTypesFor(value).map(([v]) => v);
    const type = allowedTypes.includes(form.type) ? form.type : allowedTypes[0];
    const actions = actionsFor(value);
    const steps = form.steps.map((s) =>
      actions.some(([a]) => a === s.action) ? s : { ...s, action: actions[0][0], label: "" },
    );
    set({ platform: value, type, steps, targetUrl: buildTargetUrl(value, form.name) });
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
      const actionLabel = actionsFor(form.platform).find(([a]) => a === step.action)?.[1] ?? "Complete";
      label = `${actionLabel} ${form.platform}`;
    }
    setStep(index, { name: value, label, targetUrl });
  };

  const onStepActionChange = (index: number, action: string) => {
    const step = form.steps[index];
    const actionLabel = actionsFor(form.platform).find(([a]) => a === action)?.[1] ?? "Complete";
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
      targetUrl: targetUrl.trim() || buildTargetUrl(form.platform, trimmedName),
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
              const pConf = PLATFORM_CONFIG[t.platform] ?? { label: t.platform, color: "#64748B" };
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
                      <PlatformIcon platform={t.platform} color={pConf.color} className="w-4 h-4 shrink-0" />
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
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: active ? `${cfg.color}33` : "rgba(148,163,184,0.12)" }}>
                      <PlatformIcon platform={key} color={cfg.color} className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-grid">
            <Field label="Task Type">
              <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {taskTypesFor(form.platform).map(([value, text]) => (
                  <option key={value} value={value}>
                    {value} — {text}
                  </option>
                ))}
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
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      steps: [...f.steps, { ...EMPTY_STEP, action: actionsFor(f.platform)[0][0] }],
                    }))
                  }>
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
                      {actionsFor(form.platform).map(([value, text]) => (
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
                label={form.platform === "app" ? "Campaign / Quiz Name" : "Page Name (shown in verification screen)"}
                hint={
                  form.platform === "app"
                    ? "Shown to users in app task feed"
                    : "Type handle or username — URL below is auto-filled from it"
                }>
                <input
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={PLACEHOLDERS[form.platform] ?? "Page name"}
                  autoFocus
                />
              </Field>
              <Field
                label="Target URL"
                hint="Opened when the user taps the task — auto-filled from the page name, edit to override">
                <input
                  value={form.targetUrl}
                  onChange={(e) => set({ targetUrl: e.target.value })}
                  placeholder="https://..."
                />
              </Field>
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
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${PLATFORM_CONFIG[form.platform]?.color ?? "#7C3AED"}26`,
                }}>
                <PlatformIcon
                  platform={form.platform}
                  color={PLATFORM_CONFIG[form.platform]?.color ?? "#7C3AED"}
                  className="w-4 h-4"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-white">{previewLabel(form)}</div>
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
