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

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = {
    total: users?.length ?? 0,
    active: users?.filter(u => !u.accountStatus || u.accountStatus === "active").length ?? 0,
    suspended: users?.filter(u => u.accountStatus === "suspended").length ?? 0,
    paused: users?.filter(u => u.accountStatus === "paused").length ?? 0,
  };

  const filteredUsers = users?.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.externalUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.country.toLowerCase().includes(searchQuery.toLowerCase());
    const status = u.accountStatus || "active";
    const matchesFilter = statusFilter === "all" || status === statusFilter;
    return matchesSearch && matchesFilter;
  });

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
      <PageHeader title="Users" sub="Manage registered accounts and their status" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: 0.5 }}>TOTAL USERS</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{stats.total}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: 0.5 }}>ACTIVE</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ok)', marginTop: 4 }}>{stats.active}</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 800, letterSpacing: 0.5 }}>RESTRICTED</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--danger)', marginTop: 4 }}>{stats.paused + stats.suspended}</div>
        </div>
      </div>

      <div className="card table-wrap">
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--surface)', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 9, fontSize: 14 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search by username, ID, or country..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Ecosystem</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Fraud score</th>
              <th>Country</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers?.map((u) => (
              <tr key={u._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--accent-weak)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{u.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{u.externalUid.substring(0, 16)}…</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${u.ecosystem === "PI" ? "badge-accent" : "badge-yellow"}`}>
                    {u.ecosystem}
                  </span>
                </td>
                <td className="num">{u.tier}</td>
                <td>
                  <span className={`badge ${!u.accountStatus || u.accountStatus === "active" ? "badge-green" : u.accountStatus === "paused" ? "badge-yellow" : "badge-red"}`}>
                    {(u.accountStatus || "active").toUpperCase()}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.fraudScore >= 50 ? "badge-red" : u.fraudScore >= 20 ? "badge-yellow" : "badge-green"}`}>
                    {u.fraudScore}
                  </span>
                </td>
                <td>{u.country}</td>
                <td>{new Date(u._creationTime).toLocaleDateString()}</td>
                <td>
                  <div className="row-actions" style={{ gap: 4 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Adjust Points"
                      style={{ padding: '4px 8px' }}
                      onClick={() => setPointsModal({ userId: u._id, username: u.username })}>
                      🪙
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Download PDF Report"
                      style={{ padding: '4px 8px' }}
                      disabled={generatingPdf === u._id}
                      onClick={() => handleDownloadPdf(u._id)}>
                      {generatingPdf === u._id ? "⌛" : "📄"}
                    </button>
                    {u.accountStatus === "suspended" ? (
                      <button className="btn btn-ghost btn-sm" title="Unsuspend" style={{ padding: '4px 8px' }} onClick={() => updateUser({ userId: u._id, accountStatus: "active" })}>✅</button>
                    ) : (
                      <>
                        {u.accountStatus !== "paused" && (
                          <button className="btn btn-ghost btn-sm" title="Pause Earnings" style={{ padding: '4px 8px' }} onClick={() => updateUser({ userId: u._id, accountStatus: "paused" })}>⏸️</button>
                        )}
                        {u.accountStatus === "paused" && (
                          <button className="btn btn-ghost btn-sm" title="Unpause Earnings" style={{ padding: '4px 8px' }} onClick={() => updateUser({ userId: u._id, accountStatus: "active" })}>▶️</button>
                        )}
                        <button className="btn btn-ghost btn-sm" title="Suspend Account" style={{ padding: '4px 8px' }} onClick={() => updateUser({ userId: u._id, accountStatus: "suspended" })}>🛑</button>
                      </>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Edit Tier/Score" style={{ padding: '4px 8px' }} onClick={() => openEdit(u)}>✏️</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete User"
                      style={{ color: 'var(--danger)', padding: '4px 8px' }}
                      onClick={() =>
                        confirmThen(`Delete user "${u.username}"? This cannot be undone.`, () =>
                          deleteUser({ userId: u._id }),
                        )
                      }>
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!filteredUsers || filteredUsers.length === 0) && <EmptyRow colSpan={8} text="No users found matching filters" />}
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
