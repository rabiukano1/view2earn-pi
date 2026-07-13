"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type UserForm = { tier: number; fraudScore: number; country: string };

export default function UsersPage() {
  const users = useQuery(api.admin.listUsers);
  const updateUser = useMutation(api.admin.updateUser);
  const deleteUser = useMutation(api.admin.deleteUser);

  const [editing, setEditing] = useState<Id<"users"> | null>(null);
  const [form, setForm] = useState<UserForm>({ tier: 0, fraudScore: 0, country: "" });

  const openEdit = (u: NonNullable<typeof users>[number]) => {
    setEditing(u._id);
    setForm({ tier: u.tier, fraudScore: u.fraudScore, country: u.country });
  };

  const save = async () => {
    if (!editing) {
      return;
    }
    try {
      await updateUser({ userId: editing, ...form });
      setEditing(null);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader title="Users" sub={`${users?.length ?? "—"} registered users`} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Ecosystem</th>
              <th>Tier</th>
              <th>Fraud score</th>
              <th>Country</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u._id}>
                <td style={{ fontWeight: 600 }}>{u.username}</td>
                <td>
                  <span className={`badge ${u.ecosystem === "PI" ? "badge-accent" : "badge-yellow"}`}>
                    {u.ecosystem}
                  </span>
                </td>
                <td className="num">{u.tier}</td>
                <td>
                  <span className={`badge ${u.fraudScore >= 50 ? "badge-red" : u.fraudScore >= 20 ? "badge-yellow" : "badge-green"}`}>
                    {u.fraudScore}
                  </span>
                </td>
                <td>{u.country}</td>
                <td>{new Date(u._creationTime).toLocaleDateString()}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        confirmThen(`Delete user "${u.username}"? This cannot be undone.`, () =>
                          deleteUser({ userId: u._id }),
                        )
                      }>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!users || users.length === 0) && <EmptyRow colSpan={7} text="No users yet" />}
          </tbody>
        </table>
      </div>

      <Modal title="Edit user" open={editing !== null} onClose={() => setEditing(null)}>
        <div className="form-grid">
          <Field label="Tier (0 basic · 1 email · 2 phone)">
            <input
              type="number"
              min={0}
              max={2}
              value={form.tier}
              onChange={(e) => setForm((f) => ({ ...f, tier: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Fraud score">
            <input
              type="number"
              min={0}
              value={form.fraudScore}
              onChange={(e) => setForm((f) => ({ ...f, fraudScore: Number(e.target.value) }))}
            />
          </Field>
        </div>
        <Field label="Country">
          <input
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          />
        </Field>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save changes</button>
        </div>
      </Modal>
    </div>
  );
}
