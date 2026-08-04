"use client";

import { useState } from "react";
import { api } from "@convex/api";
import { useAdminAction, useAdminMutation, useAdminQuery } from "../useAdmin";
import type { Id } from "@convex/dataModel";
import { Modal, Field, PageHeader, EmptyRow, confirmThen } from "@/components/ui";

type UserForm = { tier: number; fraudScore: number; country: string };

export default function UsersPage() {
  const users = useAdminQuery(api.admin.listUsers);
  const updateUser = useAdminMutation(api.admin.updateUser);
  const deleteUser = useAdminMutation(api.admin.deleteUser);

  const adjustPoints = useAdminMutation(api.admin.adjustPoints);
  const generatePdf = useAdminAction(api.reports.generatePdf);
  const [generatingPdf, setGeneratingPdf] = useState<Id<"users"> | null>(null);

  const [editing, setEditing] = useState<Id<"users"> | null>(null);
  const [form, setForm] = useState<UserForm>({ tier: 0, fraudScore: 0, country: "" });
  const [pointsModal, setPointsModal] = useState<{ userId: Id<"users">; username: string } | null>(null);
  const [pointsDelta, setPointsDelta] = useState<number>(100);
  const [pointsReason, setPointsReason] = useState<string>("ADMIN_BONUS");

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

  const savePoints = async () => {
    if (!pointsModal) return;
    try {
      await adjustPoints({
        userId: pointsModal.userId,
        delta: pointsDelta,
        reason: pointsReason,
      });
      alert(`Successfully adjusted ${pointsDelta} points for ${pointsModal.username}`);
      setPointsModal(null);
    } catch (e) {
      alert(String(e));
    }
  };

  const handleDownloadPdf = async (userId: Id<"users">) => {
    setGeneratingPdf(userId);
    try {
      const result = await generatePdf({ userId });
      if (result?.url) {
        window.open(result.url, "_blank");
      }
    } catch (e) {
      alert("Failed to generate PDF: " + String(e));
    } finally {
      setGeneratingPdf(null);
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
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => setPointsModal({ userId: u._id, username: u.username })}>
                      + Points
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={generatingPdf === u._id}
                      onClick={() => handleDownloadPdf(u._id)}>
                      {generatingPdf === u._id ? "Generating…" : "PDF"}
                    </button>
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

      <Modal
        title={`Adjust Points: ${pointsModal?.username ?? ""}`}
        open={pointsModal !== null}
        onClose={() => setPointsModal(null)}>
        <div className="form-grid">
          <Field label="Points Delta (e.g. 500 to add, -100 to deduct)">
            <input
              type="number"
              value={pointsDelta}
              onChange={(e) => setPointsDelta(Number(e.target.value))}
            />
          </Field>
          <Field label="Reason / Reference">
            <input
              value={pointsReason}
              onChange={(e) => setPointsReason(e.target.value)}
              placeholder="e.g. ADMIN_BONUS, CONTEST_WINNER"
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setPointsModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={savePoints}>Credit / Deduct Points</button>
        </div>
      </Modal>
    </div>
  );
}
