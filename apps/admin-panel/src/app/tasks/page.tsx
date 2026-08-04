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
  return "";
}

function nameFromUrl(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/^t\.me\//, "")
    .replace(/^facebook\.com\//, "")
    .replace(/^tiktok\.com\/@?/, "")
    .replace(/^instagram\.com\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");
}

const PLACEHOLDERS: Record<string, string> = {
  facebook: "pinetwork",
  tiktok: "@pinetwork",
  telegram: "pinetwork",
  instagram: "@pinetwork",
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
    <div>
      <PageHeader
        title="Tasks"
        sub={`${tasks?.length ?? "—"} tasks`}
        action={<button className="btn btn-primary" onClick={openCreate}>+ New task</button>}
      />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Platform</th>
              <th>Target</th>
              <th>Points</th>
              <th>Verifier</th>
              <th>Status</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks?.map((t) => (
              <tr key={t._id}>
                <td>
                  {t.type}
                  {t.type === "MULTI_TASK" && Array.isArray(t.steps) && (
                    <div className="task-url">{t.steps.length} steps: {t.steps.map((s) => s.action).join(" + ")}</div>
                  )}
                </td>
                <td>{t.platform}</td>
                <td className="truncate">
                  <div className="task-name">{t.name || "—"}</div>
                  {t.targetUrl && <div className="task-url">{t.targetUrl}</div>}
                </td>
                <td className="num">{t.points}</td>
                <td><span className="badge badge-gray">{t.verifier}</span></td>
                <td>
                  <span className={`badge ${t.status === "active" ? "badge-green" : "badge-gray"}`}>
                    {t.status}
                  </span>
                </td>
                <td>{new Date(t.expiresAt).toLocaleDateString()}</td>
                <td>
                  <div className="row-actions">
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
            ))}
            {(!tasks || tasks.length === 0) && <EmptyRow colSpan={8} text="No tasks yet — create the first one" />}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? "Edit task" : "New task"} open={open} onClose={() => setOpen(false)}>
        <div className="form-grid">
          <Field label="Type">
            <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="FOLLOW_PAGE">FOLLOW_PAGE</option>
              <option value="JOIN_CHANNEL">JOIN_CHANNEL</option>
              <option value="MULTI_TASK">MULTI_TASK (multiple actions)</option>
              <option value="QUIZ">QUIZ</option>
              <option value="SURVEY">SURVEY</option>
            </select>
          </Field>
          <Field label="Platform">
            <select value={form.platform} onChange={(e) => onPlatformChange(e.target.value)}>
              <option value="facebook">facebook</option>
              <option value="tiktok">tiktok</option>
              <option value="telegram">telegram</option>
              <option value="instagram">instagram</option>
              <option value="app">app</option>
            </select>
          </Field>
        </div>

        {form.type === "MULTI_TASK" ? (
          <div className="steps-editor">
            <div className="steps-head">
              <span>Action steps — user must complete every step, then upload one screenshot</span>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, { ...EMPTY_STEP }] }))}>
                + Add step
              </button>
            </div>
            {form.steps.length === 0 && (
              <p className="steps-empty">No steps yet — click "+ Add step" to build the bundle.</p>
            )}
            {form.steps.map((step, i) => (
              <div key={i} className="step-row">
                <select value={step.action} onChange={(e) => onStepActionChange(i, e.target.value)}>
                  {ACTION_LABELS.map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
                <input
                  value={step.name}
                  onChange={(e) => onStepNameChange(i, e.target.value)}
                  placeholder="Page / channel / video handle"
                />
                <input
                  value={step.targetUrl}
                  onChange={(e) => setStep(i, { targetUrl: e.target.value })}
                  placeholder="Full link (leave name empty to paste exact URL)"
                />
                <input
                  value={step.label}
                  onChange={(e) => setStep(i, { label: e.target.value })}
                  placeholder="Short instruction (shown in app)"
                />
                <button
                  className="btn btn-danger btn-sm"
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
                  }>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Field
              label={
                form.platform === "app" ? "Name" : "Page / Channel name"
              }
              hint={
                form.platform === "app"
                  ? "Shown to users and in the review queue"
                  : "Type the page or channel handle — the link is built from it automatically"
              }>
              <input
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={PLACEHOLDERS[form.platform] ?? "name"}
                autoFocus
              />
            </Field>
            {form.name.trim() && form.platform !== "app" && (
              <div className="url-preview">
                <span>Link</span>
                <code>{form.targetUrl}</code>
              </div>
            )}
            {form.platform === "facebook" && (
              <Field label="Facebook Page ID (optional — reliable deep links on FB Lite)">
                <input
                  value={form.pageId}
                  onChange={(e) => set({ pageId: e.target.value })}
                  placeholder="e.g. 100064860796750"
                />
              </Field>
            )}
          </>
        )}
        <div className="form-grid">
          <Field
            label={form.type === "MULTI_TASK" ? "Total points (all steps)" : "Points"}
            hint={form.type === "MULTI_TASK" ? "Awarded once when every step is done" : undefined}>
            <input type="number" value={form.points} onChange={(e) => set({ points: Number(e.target.value) })} />
          </Field>
          <Field label="Verifier">
            <select value={form.verifier} onChange={(e) => set({ verifier: e.target.value })}>
              <option value="screenshot-ai">screenshot-ai</option>
              <option value="telegram-bot">telegram-bot</option>
              <option value="bio-code">bio-code</option>
              <option value="quiz">quiz</option>
            </select>
          </Field>
          <Field label="Max completions">
            <input
              type="number"
              value={form.maxCompletions}
              onChange={(e) => set({ maxCompletions: Number(e.target.value) })}
            />
          </Field>
          <Field label="Expires in (days)">
            <input
              type="number"
              value={form.expiresDays}
              onChange={(e) => set({ expiresDays: Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            {editing ? "Save changes" : "Create task"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
