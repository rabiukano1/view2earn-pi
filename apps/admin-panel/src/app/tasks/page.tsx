"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { platformEmoji, openWebTaskLink } from "@view2earn/core";
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
  platform: "x",
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
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  whatsapp:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z",
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
  app: { label: "App View2Earn", color: "#10B981" },
  x: { label: "X (Twitter)", color: "#1DA1F2" },
  youtube: { label: "YouTube", color: "#FF0000" },
  tiktok: { label: "TikTok", color: "#000000" },
  instagram: { label: "Instagram", color: "#E1306C" },
  facebook: { label: "Facebook", color: "#1877F2" },
  telegram: { label: "Telegram", color: "#0088CC" },
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
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
    ["COMMENT", "Comment"],
    ["REPOST", "Repost"],
    ["LIKE", "Like"],
    ["BOOKMARK", "Bookmark"],
    ["FOLLOW", "Follow"],
  ],
};

function actionsFor(platform: string): [string, string][] {
  const list = PLATFORM_ACTIONS[platform];
  return list && list.length > 0 ? list : DEFAULT_ACTIONS;
}

function taskTypesFor(platform: string): [string, string][] {
  if (platform === "app") return [
    ["QUIZ", "Quiz"],
    ["SURVEY", "Survey"]
  ];
  if (platform === "x") return [
    ["FOLLOW", "Follow"],
    ["MULTI_TASK", "Multi-task (bundle steps)"]
  ];
  if (platform === "facebook") return [
    ["FOLLOW_PAGE", "Follow Page"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["JOIN_GROUP", "Join Group"],
    ["MULTI_TASK", "Multi-task (Coming Soon)"]
  ];
  if (platform === "youtube") return [
    ["SUBSCRIBE", "Subscribe"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["WATCH", "Watch Video"],
    ["MULTI_TASK", "Multi-task (Coming Soon)"]
  ];
  if (platform === "tiktok") return [
    ["FOLLOW", "Follow"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["WATCH", "Watch Video"],
    ["MULTI_TASK", "Multi-task (Coming Soon)"]
  ];
  if (platform === "instagram") return [
    ["FOLLOW", "Follow"],
    ["LIKE", "Like"],
    ["COMMENT", "Comment"],
    ["SHARE", "Share"],
    ["MULTI_TASK", "Multi-task (Coming Soon)"]
  ];
  if (platform === "telegram") return [
    ["JOIN_CHANNEL", "Join Channel"],
    ["COMMENT", "Comment"],
    ["MULTI_TASK", "Multi-task (Coming Soon)"]
  ];
  
  // For any other platforms (LinkedIn, WhatsApp, etc.), return empty array to indicate they are hidden
  return [];
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
  if (platform === "linkedin") return `https://linkedin.com/in/${n}`;
  if (platform === "whatsapp") return `https://wa.me/${n}`;
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
    .replace(/^youtube\.com\/(@|channel\/|c\/)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");
}

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
        <div className="space-y-8 pb-4">
          
          {/* Section 1: Platform Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-px bg-slate-700"></span>
              Select Platform
              <span className="flex-1 h-px bg-slate-700/50"></span>
            </h3>
            <div className="p-5 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/50">
              <Field label="Platform" hint="Choose the platform for this campaign">
                <select 
                  value={form.platform} 
                  onChange={(e) => onPlatformChange(e.target.value)}
                  className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50 transition-shadow w-full p-2.5 rounded-lg"
                >
                  {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {taskTypesFor(form.platform).length === 0 ? (
            <div className="p-8 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 text-center space-y-4 shadow-xl">
              <div className="text-4xl animate-bounce">🚧</div>
              <h3 className="text-xl font-bold text-slate-100">Task Creation Coming Soon</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                We are currently building the custom task flows and API integrations for {PLATFORM_CONFIG[form.platform]?.label.replace(" (Coming Soon)", "")}. Please check back later!
              </p>
            </div>
          ) : (
            <>
              {/* Section 2: Campaign Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-px bg-slate-700"></span>
                  Campaign Details
                  <span className="flex-1 h-px bg-slate-700/50"></span>
                </h3>
                <div className="p-5 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 form-grid">
                  <Field label="Task Type" hint="What should the user do?">
                    <select 
                      value={form.type} 
                      onChange={(e) => set({ type: e.target.value })}
                      className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                    >
                      {taskTypesFor(form.platform).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Verification Provider" hint="How is the proof checked?">
                    <select 
                      value={form.verifier} 
                      onChange={(e) => set({ verifier: e.target.value })}
                      className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                    >
                      <option value="screenshot-ai">screenshot-ai (AI Vision Auto-Review)</option>
                      <option value="telegram-bot">telegram-bot (Direct API)</option>
                      <option value="bio-code">bio-code (Bio Verification)</option>
                      <option value="quiz">quiz (Instant Verification)</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* Section 3: Action Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-px bg-slate-700"></span>
                  Action Configuration
                  <span className="flex-1 h-px bg-slate-700/50"></span>
                </h3>

                {form.type === "MULTI_TASK" ? (
                  <div className="p-5 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-purple-500/20 space-y-4 shadow-lg">
                    {form.platform === "x" && (
                      <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <Field label="Quick Select Actions" hint="Click to toggle steps. Campaign title auto-generates!">
                          <div className="flex flex-wrap gap-2 mt-2">
                            {actionsFor("x").map(([action, label]) => {
                              const isSelected = form.steps.some((s) => s.action === action);
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all duration-300 ${
                                    isSelected
                                      ? "bg-purple-600 border-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] transform -translate-y-0.5"
                                      : "bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-700 hover:-translate-y-0.5"
                                  }`}
                                  onClick={() => {
                                    let newSteps;
                                    if (isSelected) {
                                      newSteps = form.steps.filter((s) => s.action !== action);
                                    } else {
                                      newSteps = [...form.steps, { action, label: "", name: "", targetUrl: form.targetUrl }];
                                    }
                                    const newName = newSteps
                                      .map((s) => actionsFor("x").find(([a]) => a === s.action)?.[1] ?? s.action)
                                      .join(" + ");
                                    setForm((f) => ({ ...f, steps: newSteps, name: newName }));
                                  }}>
                                  {isSelected ? "✓ " : "+ "}{label}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                        {form.name && (
                          <div className="px-4 py-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center gap-3">
                            <span className="text-emerald-400 text-lg">✨</span>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-500/80">Auto-Generated Title</div>
                              <div className="text-sm font-semibold text-emerald-300">{form.name}</div>
                            </div>
                          </div>
                        )}
                        <Field label="Master Post URL" hint="Auto-fills the URL for all Comment, Repost, Like, and Bookmark steps below">
                          <div className="flex gap-2">
                            <input
                              className="flex-1 bg-slate-900 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                              value={form.targetUrl}
                              onChange={(e) => {
                                 const val = e.target.value;
                                 setForm(f => ({
                                   ...f,
                                   targetUrl: val,
                                   steps: f.steps.map(s => (s.action !== "FOLLOW" ? { ...s, targetUrl: val } : s))
                                 }));
                              }}
                              placeholder="https://x.com/username/status/123456789"
                            />
                            <button
                              className="btn btn-secondary shrink-0 transition-transform hover:scale-105"
                              type="button"
                              disabled={!form.targetUrl}
                              onClick={() => openWebTaskLink(form.platform, form.targetUrl)}
                              title={`Test link: ${form.targetUrl || "none"}`}>
                              {form.targetUrl ? platformEmoji(form.targetUrl) : "🌐"} Test
                            </button>
                          </div>
                        </Field>
                      </div>
                    )}
                    
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                          Bundle Steps Overview
                        </span>
                        <button
                          className="btn btn-primary btn-sm shadow-[0_0_10px_rgba(168,85,247,0.3)]"
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
                      
                      <div className="space-y-2">
                        {form.steps.length === 0 && (
                          <div className="text-center py-6 border border-dashed border-slate-700 rounded-xl bg-slate-900/30">
                            <p className="text-sm text-slate-500">No steps yet — click "+ Add Step" or use Quick Select to build the bundle.</p>
                          </div>
                        )}
                        {form.steps.map((step, i) => (
                          <div key={i} className="flex flex-col md:flex-row gap-3 items-center p-3 bg-slate-900/80 rounded-xl border border-slate-700/50 hover:border-purple-500/30 transition-colors group">
                            <div className="w-full md:w-40 shrink-0">
                              <select 
                                value={step.action} 
                                onChange={(e) => onStepActionChange(i, e.target.value)}
                                className="w-full bg-slate-950 border-slate-700 text-sm"
                              >
                                {actionsFor(form.platform).map(([value, text]) => (
                                  <option key={value} value={value}>{text}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-full md:flex-1 relative">
                              <input
                                className="w-full bg-slate-950 border-slate-700 text-sm pr-8"
                                value={step.name}
                                onChange={(e) => onStepNameChange(i, e.target.value)}
                                placeholder={form.platform === "x" && step.action !== "FOLLOW" ? "Not needed" : "Handle / Username"}
                              />
                            </div>
                            <button
                              className="w-full md:w-10 h-10 flex items-center justify-center bg-slate-800 text-slate-500 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                              onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))}>
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : form.platform !== "app" ? (
                  <div className="p-5 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 space-y-4">
                    <Field label={`${PLATFORM_CONFIG[form.platform]?.label.replace(" (Coming Soon)", "")} Name`} hint="Display name (e.g. Elon Musk or View2Earn)">
                      <input
                        className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                        value={form.name}
                        onChange={(e) => set({ name: e.target.value })}
                        placeholder="Page or Channel Name"
                        autoFocus
                      />
                    </Field>
                    <Field label="Username / Handle or Link" hint={`Automatically builds the URL. You can paste just the username or the full link.`}>
                      <div className="flex gap-2">
                        <span className="w-12 bg-slate-900 text-slate-400 rounded-lg border border-slate-700 flex items-center justify-center font-bold">@</span>
                        <input
                          className="flex-1 bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                          value={nameFromUrl(form.targetUrl)}
                          onChange={(e) => set({ targetUrl: buildTargetUrl(form.platform, e.target.value) })}
                          placeholder="username"
                        />
                        <button
                          className="btn btn-secondary shrink-0 transition-transform hover:scale-105"
                          type="button"
                          disabled={!form.targetUrl}
                          onClick={() => openWebTaskLink(form.platform, form.targetUrl)}
                          title={`Test link: ${form.targetUrl || "none"}`}>
                          {form.targetUrl ? platformEmoji(form.targetUrl) : "🌐"} Test
                        </button>
                      </div>
                    </Field>
                    {form.targetUrl && (
                      <p className="text-[11px] text-slate-400 pl-14">
                        Target URL: <span className="text-purple-300 font-mono">{form.targetUrl}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-5 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 space-y-4">
                    <Field
                      label="Campaign / Quiz Name"
                      hint="Shown to users in app task feed">
                      <input
                        className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                        value={form.name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="Quiz name"
                        autoFocus
                      />
                    </Field>
                    <Field
                      label="Target URL (Optional)"
                      hint="Opened when the user taps the task">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                          value={form.targetUrl}
                          onChange={(e) => set({ targetUrl: e.target.value })}
                          placeholder="https://..."
                        />
                        <button
                          className="btn btn-secondary shrink-0 transition-transform hover:scale-105"
                          type="button"
                          disabled={!form.targetUrl}
                          onClick={() => openWebTaskLink(form.platform, form.targetUrl)}
                          title={`Test link: ${form.targetUrl || "none"}`}>
                          {form.targetUrl ? platformEmoji(form.targetUrl) : "🌐"} Test
                        </button>
                      </div>
                    </Field>
                  </div>
                )}
              </div>

              {/* Live Preview Bar */}
              <div className="p-4 bg-gradient-to-r from-purple-900/40 to-slate-900/40 rounded-xl border border-purple-500/30 flex items-center justify-between shadow-[0_4px_20px_-5px_rgba(168,85,247,0.15)] relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center space-x-4 z-10">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
                    style={{
                      backgroundColor: `${PLATFORM_CONFIG[form.platform]?.color ?? "#7C3AED"}20`,
                      border: `1px solid ${PLATFORM_CONFIG[form.platform]?.color ?? "#7C3AED"}40`,
                    }}>
                    <PlatformIcon
                      platform={form.platform}
                      color={PLATFORM_CONFIG[form.platform]?.color ?? "#7C3AED"}
                      className="w-6 h-6 drop-shadow-md"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 tracking-wider">Mobile App Preview</div>
                    <div className="text-sm font-bold text-white leading-tight">{previewLabel(form)}</div>
                    <div className="text-[11px] text-purple-300 font-mono mt-0.5 max-w-[200px] truncate">
                      {form.targetUrl || "https://..."}
                    </div>
                  </div>
                </div>
                <div className="text-right z-10 flex flex-col items-end">
                  <div className="text-[10px] uppercase font-bold text-emerald-500 mb-0.5 tracking-wider">Reward</div>
                  <span className="badge badge-green font-bold text-sm px-3 py-1 shadow-[0_0_10px_rgba(16,185,129,0.2)]">+{form.points} PTS</span>
                </div>
              </div>

              {/* Section 4: Reward & Delivery */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-px bg-slate-700"></span>
                  Reward & Delivery
                  <span className="flex-1 h-px bg-slate-700/50"></span>
                </h3>
                <div className="p-5 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 form-grid">
                  <Field
                    label={form.type === "MULTI_TASK" ? "Total Points Reward" : "Points Reward"}
                    hint="Awarded to user upon verified completion">
                    <input 
                      type="number" 
                      className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50 text-emerald-400 font-bold"
                      value={form.points} 
                      onChange={(e) => set({ points: Number(e.target.value) })} 
                    />
                  </Field>
                  <Field label="Max User Completions" hint="Stop campaign after this many users">
                    <input
                      type="number"
                      className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                      value={form.maxCompletions}
                      onChange={(e) => set({ maxCompletions: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Campaign Duration (Days)" hint="Automatically expires after X days">
                    <input
                      type="number"
                      className="bg-slate-950 border-slate-700 focus:ring-2 focus:ring-purple-500/50"
                      value={form.expiresDays}
                      onChange={(e) => set({ expiresDays: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          <div className="modal-actions pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0f1115] pb-2 z-20">
            <button className="btn btn-ghost hover:bg-slate-800" onClick={() => setOpen(false)}>Cancel</button>
            <button 
              className="btn btn-primary px-8 py-2.5 shadow-[0_4px_20px_rgba(168,85,247,0.4)] hover:shadow-[0_4px_25px_rgba(168,85,247,0.6)] transform transition-all hover:-translate-y-0.5 font-bold text-[15px]" 
              onClick={save}
              disabled={taskTypesFor(form.platform).length === 0}
            >
              {editing ? "Save Changes" : "🚀 Publish Campaign"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
