"use client";

import { useState } from "react";
import { api } from "@convex/api";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { Modal, Field, PageHeader, EmptyRow, confirmThen, timeAgo } from "@/components/ui";
import { Mic, Plus, Edit2, Trash2 } from "lucide-react";
import type { Id } from "@convex/dataModel";

const TYPES = [
  { value: "episode", label: "Episodes" },
  { value: "update", label: "Updates" },
  { value: "announcement", label: "Announcements" },
];

type Form = {
  id?: Id<"mentors">;
  name: string;
  role: string;
  bio: string;
  telegram: string;
  photoUrl: string;
  types: string[];
};

const emptyForm: Form = { name: "", role: "", bio: "", telegram: "", photoUrl: "", types: TYPES.map((t) => t.value) };

export default function MentorsPage() {
  const mentors = useAdminQuery(api.voiceNotes.listMentorsAdmin);
  const create = useAdminMutation(api.voiceNotes.createMentor);
  const update = useAdminMutation(api.voiceNotes.updateMentor);
  const remove = useAdminMutation(api.voiceNotes.removeMentor);

  const [editing, setEditing] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const openNew = () => setEditing({ ...emptyForm });
  const openEdit = (m: any) =>
    setEditing({
      id: m._id,
      name: m.name,
      role: m.role ?? "",
      bio: m.bio ?? "",
      telegram: m.telegram ?? "",
      photoUrl: m.photoUrl ?? "",
      types: m.types ?? TYPES.map((t) => t.value),
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert("Name is required");
      return;
    }
    setBusy(true);
    try {
      const { id, ...payload } = editing;
      if (id) await update({ id, ...payload });
      else await create(payload);
      setEditing(null);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleType = (t: string) =>
    editing &&
    setEditing({
      ...editing,
      types: editing.types.includes(t) ? editing.types.filter((x) => x !== t) : [...editing.types, t],
    });

  return (
    <div>
      <PageHeader
        title="Mentors"
        sub="Mentor profiles shown in the app's Mentors section. Voice notes are posted via the Telegram bot."
        icon={<Mic size={24} color="var(--primary)" />}
        action={
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Add Mentor
          </button>
        }
      />

      <div className="card table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Mentor</th>
              <th>Role</th>
              <th>Types</th>
              <th>Telegram</th>
              <th>Voice notes</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mentors?.length === 0 && <EmptyRow colSpan={7} text="No mentors yet — add your first mentor." />}
            {mentors?.map((m) => (
              <tr key={m._id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt="" width={36} height={36} style={{ borderRadius: 18, objectFit: "cover", background: "#222" }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>
                        {m.name.split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join("")}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 800 }}>{m.name}</div>
                      {m.bio ? (
                        <div style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.bio}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>{m.role ?? <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(m.types ?? TYPES.map((t) => t.value)).map((t: string) => (
                      <span key={t} className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        {TYPES.find((x) => x.value === t)?.label ?? t}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{m.telegram ? <a href={`https://t.me/${m.telegram}`} target="_blank" rel="noreferrer">@{m.telegram}</a> : <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                <td>{m.noteCount}</td>
                <td style={{ fontSize: 12, color: "var(--text-3)" }}>{timeAgo(m.createdAt)}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(m)}>
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete"
                      onClick={() => confirmThen(`Remove "${m.name}"? Their voice notes stay in the app.`, () => remove({ id: m._id }))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing?.id ? "Edit Mentor" : "Add Mentor"} open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <div className="form-grid">
              <Field label="Full name">
                <input type="text" value={editing.name} placeholder="e.g. Aisha Bello" onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Role / title">
                <input type="text" value={editing.role} placeholder="e.g. Pi Network Ambassador" onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
              </Field>
            </div>
            <Field label="Bio" hint="2–3 sentences shown on the mentor's screen.">
              <textarea rows={3} value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Telegram username" hint="Without the @">
                <input type="text" value={editing.telegram} placeholder="aisha_b" onChange={(e) => setEditing({ ...editing, telegram: e.target.value })} />
              </Field>
              <Field label="Photo URL" hint="Optional. A photo sent to the bot is used when this is empty.">
                <input type="text" value={editing.photoUrl} placeholder="https://…/photo.jpg" onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value })} />
              </Field>
            </div>
            <Field label="Publishes" hint="Which types appear in the bot when posting for this mentor.">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {TYPES.map((t) => (
                  <label key={t.value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={editing.types.includes(t.value)} onChange={() => toggleType(t.value)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </Field>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : editing.id ? "Save Changes" : "Add Mentor"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
