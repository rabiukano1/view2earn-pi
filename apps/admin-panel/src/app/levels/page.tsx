"use client";

import { useState } from "react";
import { api } from "@convex/api";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { Modal, Field, PageHeader } from "@/components/ui";
import { Sparkles, Edit2, CheckCircle2, XCircle } from "lucide-react";

type LevelForm = {
  level: number;
  name: string;
  xpRequired: number;
  desc: string;
  enabled: boolean;
};

export default function LevelsPage() {
  const levels = useAdminQuery(api.levels.getAdminLevels);
  const upsertLevel = useAdminMutation(api.levels.upsertLevel);

  const [editing, setEditing] = useState<LevelForm | null>(null);

  const openEdit = (l: any) => {
    setEditing({
      level: l.level,
      name: l.name,
      xpRequired: l.xpRequired,
      desc: l.desc,
      enabled: l.enabled,
    });
  };

  const save = async () => {
    if (!editing) return;
    try {
      await upsertLevel({
        level: editing.level,
        name: editing.name,
        xpRequired: editing.xpRequired,
        desc: editing.desc,
        enabled: editing.enabled,
      });
      setEditing(null);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader 
        title="Progression Levels" 
        sub="Configure the 12-Level XP progression system" 
        icon={<Sparkles size={24} color="var(--primary)" />} 
      />

      <div className="card table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Level</th>
              <th>Name</th>
              <th>XP Required</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {levels?.map((l) => (
              <tr key={l.level}>
                <td style={{ fontWeight: 800 }}>{l.level}</td>
                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{l.name}</td>
                <td className="num">{l.xpRequired.toLocaleString()} XP</td>
                <td style={{ color: 'var(--text-3)', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.desc}
                </td>
                <td>
                  {l.enabled ? (
                    <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                      <CheckCircle2 size={12} /> Enabled
                    </span>
                  ) : (
                    <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                      <XCircle size={12} /> Disabled
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Edit Level"
                    onClick={() => openEdit(l)}>
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={`Edit Level ${editing?.level}`} open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <div className="form-grid">
              <Field label="Level Name">
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="XP Required">
                <input
                  type="number"
                  min={0}
                  value={editing.xpRequired}
                  onChange={(e) => setEditing({ ...editing, xpRequired: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={editing.desc}
                rows={3}
                onChange={(e) => setEditing({ ...editing, desc: e.target.value })}
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              <span style={{ fontWeight: 600 }}>Enable this level</span>
            </label>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save Changes</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
