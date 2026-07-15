"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type Kind = "ADS" | "SURVEY" | "VAS";
type PlatformKind = "pi-web" | "sidra-mobile" | "both";
type ProviderForm = { kind: Kind; name: string; platform: PlatformKind; configJson: string };

const EMPTY: ProviderForm = { kind: "ADS", name: "", platform: "both", configJson: "{}" };

export default function ProvidersPage() {
  const providers = useAdminQuery(api.admin.listProviders);
  const createProvider = useAdminMutation(api.admin.createProvider);
  const updateProvider = useAdminMutation(api.admin.updateProvider);
  const toggle = useAdminMutation(api.admin.toggleProvider);
  const deleteProvider = useAdminMutation(api.admin.deleteProvider);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"providers"> | null>(null);
  const [form, setForm] = useState<ProviderForm>(EMPTY);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (p: NonNullable<typeof providers>[number]) => {
    setEditing(p._id);
    setForm({ kind: p.kind, name: p.name, platform: p.platform, configJson: p.configJson });
    setOpen(true);
  };

  const save = async () => {
    try {
      JSON.parse(form.configJson); // validate before saving
    } catch {
      alert("Config must be valid JSON");
      return;
    }
    try {
      if (editing) {
        await updateProvider({ providerId: editing, name: form.name, configJson: form.configJson });
      } else {
        await createProvider(form);
      }
      setOpen(false);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Providers"
        sub="Ad networks, survey walls and VAS integrations"
        action={<button className="btn btn-primary" onClick={openCreate}>+ New provider</button>}
      />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Platform</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {providers?.map((p) => (
              <tr key={p._id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className="badge badge-gray">{p.kind}</span></td>
                <td>{p.platform}</td>
                <td>
                  <span className={`badge ${p.enabled ? "badge-green" : "badge-gray"}`}>
                    {p.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className={`btn btn-sm ${p.enabled ? "btn-ghost" : "btn-ok"}`}
                      onClick={() => toggle({ providerId: p._id, enabled: !p.enabled })}>
                      {p.enabled ? "Disable" : "Enable"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        confirmThen(`Delete provider "${p.name}"?`, () =>
                          deleteProvider({ providerId: p._id }),
                        )
                      }>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!providers || providers.length === 0) && (
              <EmptyRow colSpan={5} text="No providers configured — add your first ad or survey network" />
            )}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? "Edit provider" : "New provider"} open={open} onClose={() => setOpen(false)}>
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="CPX Research"
          />
        </Field>
        <div className="form-grid">
          <Field label="Kind">
            <select
              value={form.kind}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))}>
              <option value="ADS">ADS</option>
              <option value="SURVEY">SURVEY</option>
              <option value="VAS">VAS</option>
            </select>
          </Field>
          <Field label="Platform">
            <select
              value={form.platform}
              disabled={editing !== null}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as PlatformKind }))}>
              <option value="both">both</option>
              <option value="pi-web">pi-web</option>
              <option value="sidra-mobile">sidra-mobile</option>
            </select>
          </Field>
        </div>
        <Field label="Config (JSON)">
          <textarea
            rows={5}
            value={form.configJson}
            onChange={(e) => setForm((f) => ({ ...f, configJson: e.target.value }))}
            style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12.5 }}
          />
        </Field>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            {editing ? "Save changes" : "Create provider"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
