"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type TaskForm = {
  type: string;
  platform: string;
  targetUrl: string;
  points: number;
  verifier: string;
  maxCompletions: number;
  expiresDays: number;
};

const EMPTY: TaskForm = {
  type: "FOLLOW_PAGE",
  platform: "facebook",
  targetUrl: "",
  points: 50,
  verifier: "screenshot-ai",
  maxCompletions: 1000,
  expiresDays: 30,
};

export default function TasksPage() {
  const tasks = useQuery(api.admin.listActiveTasks);
  const createTask = useMutation(api.admin.createTask);
  const updateTask = useMutation(api.admin.updateTask);
  const deleteTask = useMutation(api.admin.deleteTask);

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
      targetUrl: t.targetUrl,
      points: t.points,
      verifier: t.verifier,
      maxCompletions: t.maxCompletions,
      expiresDays: Math.max(1, Math.round((t.expiresAt - Date.now()) / 86400000)),
    });
    setOpen(true);
  };

  const save = async () => {
    const { expiresDays, ...fields } = form;
    const expiresAt = Date.now() + expiresDays * 86400000;
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
                <td>{t.type}</td>
                <td>{t.platform}</td>
                <td className="truncate">{t.targetUrl || "—"}</td>
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
              <option value="QUIZ">QUIZ</option>
              <option value="SURVEY">SURVEY</option>
            </select>
          </Field>
          <Field label="Platform">
            <select value={form.platform} onChange={(e) => set({ platform: e.target.value })}>
              <option value="facebook">facebook</option>
              <option value="tiktok">tiktok</option>
              <option value="telegram">telegram</option>
              <option value="app">app</option>
            </select>
          </Field>
        </div>
        <Field label="Target URL">
          <input
            value={form.targetUrl}
            onChange={(e) => set({ targetUrl: e.target.value })}
            placeholder="https://facebook.com/yourpage"
          />
        </Field>
        <div className="form-grid">
          <Field label="Points">
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
