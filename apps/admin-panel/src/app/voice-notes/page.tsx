"use client";

import { useMemo, useState } from "react";
import { api } from "@convex/api";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { Modal, Field, PageHeader, EmptyRow, confirmThen, timeAgo } from "@/components/ui";
import { AudioLines, Edit2, Trash2, FolderInput } from "lucide-react";
import type { Id } from "@convex/dataModel";

const TYPES = [
  { value: "episode", label: "Episode" },
  { value: "update", label: "Update" },
  { value: "announcement", label: "Announcement" },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type EditForm = {
  id: Id<"voiceNotes">;
  title: string;
  mentor: string;
  type: string;
  series: string;
  episodeNumber: string;
  note: string;
};

export default function VoiceNotesAdminPage() {
  const notes = useAdminQuery(api.voiceNotes.listNotesAdmin);
  const seriesList = useAdminQuery(api.voiceNotes.seriesList) ?? [];
  const mentors = useAdminQuery(api.voiceNotes.listMentorsAdmin) ?? [];
  const updateNote = useAdminMutation(api.voiceNotes.updateNote);
  const bulkUpdate = useAdminMutation(api.voiceNotes.bulkUpdateNotes);
  const remove = useAdminMutation(api.voiceNotes.remove);

  const [editing, setEditing] = useState<EditForm | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [grouping, setGrouping] = useState(false);
  const [group, setGroup] = useState({ series: "", mentor: "", type: "", renumber: true });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes?.filter((n) =>
      [n.title, n.mentor, n.series, n.note].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [notes, filter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allShown = (rows ?? []).map((r) => r._id as string);
  const allSelected = allShown.length > 0 && allShown.every((id) => selected.has(id));

  const openEdit = (n: any) =>
    setEditing({
      id: n._id,
      title: n.title,
      mentor: n.mentor ?? "",
      type: n.type ?? "",
      series: n.series ?? "",
      episodeNumber: n.episodeNumber != null ? String(n.episodeNumber) : "",
      note: n.note ?? "",
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      alert("Title cannot be empty");
      return;
    }
    setBusy(true);
    try {
      await updateNote({
        id: editing.id,
        title: editing.title,
        mentor: editing.mentor,
        type: (editing.type || undefined) as any,
        series: editing.series,
        episodeNumber: editing.episodeNumber ? Number(editing.episodeNumber) : undefined,
        note: editing.note,
      });
      setEditing(null);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  const applyGroup = async () => {
    setBusy(true);
    try {
      const res = await bulkUpdate({
        ids: [...selected] as any,
        series: group.series || undefined,
        mentor: group.mentor || undefined,
        type: (group.type || undefined) as any,
        renumber: group.renumber,
      });
      alert(`Updated ${res.done} voice note${res.done === 1 ? "" : "s"}.`);
      setGrouping(false);
      setSelected(new Set());
      setGroup({ series: "", mentor: "", type: "", renumber: true });
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Voice notes"
        sub="Rename notes, fix mentors, and group them into episode series. Audio stays in the Telegram channel."
        icon={<AudioLines size={24} color="var(--primary)" />}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8 }}
            />
            <button className="btn btn-primary" disabled={selected.size === 0} onClick={() => setGrouping(true)}>
              <FolderInput size={16} /> Move {selected.size || ""} to group
            </button>
          </div>
        }
      />

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(allShown))}
                />
              </th>
              <th>Title</th>
              <th>Mentor</th>
              <th>Type</th>
              <th>Series</th>
              <th>Length</th>
              <th>Posted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && <EmptyRow colSpan={8} text="No voice notes yet" />}
            {rows?.map((n) => (
              <tr key={n._id}>
                <td>
                  <input type="checkbox" checked={selected.has(n._id)} onChange={() => toggle(n._id)} />
                </td>
                <td>
                  <div style={{ fontWeight: 700, maxWidth: 320 }}>{n.title}</div>
                  {n.note ? <div style={{ fontSize: 12, color: "var(--text-3)" }}>{n.note}</div> : null}
                </td>
                <td>{n.mentor ?? <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                <td>
                  {n.type ? (
                    <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      {TYPES.find((t) => t.value === n.type)?.label ?? n.type}
                    </span>
                  ) : (
                    <span className="badge badge-gray">unset</span>
                  )}
                </td>
                <td>
                  {n.series ? (
                    <>
                      {n.series}
                      {n.episodeNumber != null ? <span style={{ color: "var(--text-3)" }}> · Ep {n.episodeNumber}</span> : null}
                    </>
                  ) : (
                    <span style={{ color: "var(--text-3)" }}>—</span>
                  )}
                </td>
                <td>{fmt(n.duration)}</td>
                <td style={{ fontSize: 12, color: "var(--text-3)" }}>{timeAgo(n.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(n)}>
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete"
                      onClick={() => confirmThen(`Remove "${n.title}" from the app?`, () => remove({ id: n._id }))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rename / edit one note */}
      <Modal title="Edit voice note" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <Field label="Title">
              <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Mentor">
                <select value={editing.mentor} onChange={(e) => setEditing({ ...editing, mentor: e.target.value })}>
                  <option value="">— none —</option>
                  {mentors.map((m) => (
                    <option key={m._id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  <option value="">— unset —</option>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Series / group" hint="Leave empty to remove it from its group.">
                <input
                  type="text"
                  list="series-options"
                  value={editing.series}
                  onChange={(e) => setEditing({ ...editing, series: e.target.value })}
                />
                <datalist id="series-options">
                  {seriesList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="Episode number">
                <input
                  type="number"
                  min={1}
                  value={editing.episodeNumber}
                  onChange={(e) => setEditing({ ...editing, episodeNumber: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Short note">
              <textarea rows={2} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Bulk: move selected notes into a group */}
      <Modal title={`Move ${selected.size} voice notes to a group`} open={grouping} onClose={() => setGrouping(false)}>
        <Field label="Series / group name" hint="Pick an existing group or type a new one.">
          <input
            type="text"
            list="series-options-bulk"
            value={group.series}
            placeholder="e.g. Pi Basics"
            onChange={(e) => setGroup({ ...group, series: e.target.value })}
          />
          <datalist id="series-options-bulk">
            {seriesList.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <div className="form-grid">
          <Field label="Also set mentor" hint="Optional — leave blank to keep each note's mentor.">
            <select value={group.mentor} onChange={(e) => setGroup({ ...group, mentor: e.target.value })}>
              <option value="">— keep as is —</option>
              {mentors.map((m) => (
                <option key={m._id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Also set type">
            <select value={group.type} onChange={(e) => setGroup({ ...group, type: e.target.value })}>
              <option value="">— keep as is —</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 8 }}>
          <input type="checkbox" checked={group.renumber} onChange={(e) => setGroup({ ...group, renumber: e.target.checked })} />
          Number them Episode 1, 2, 3… (oldest first)
        </label>
        <div className="modal-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={() => setGrouping(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={applyGroup} disabled={busy}>
            {busy ? "Applying…" : `Apply to ${selected.size}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
