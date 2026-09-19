"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { Modal, Field, PageHeader, EmptyRow, RiskBadge, confirmThen, timeAgo } from "@/components/ui";

export default function FraudPage() {
  const events = useAdminQuery(api.admin.listFraudEvents);
  const users = useAdminQuery(api.admin.listUsers);
  const createEvent = useAdminMutation(api.admin.createFraudEvent);
  const deleteEvent = useAdminMutation(api.admin.deleteFraudEvent);

  const accounts = useAdminQuery(api.admin.listFraudAccounts);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useAdminQuery(api.admin.getFraudAccount, selected ? { userId: selected as never } : "skip");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", type: "MANUAL_FLAG", details: "" });

  const save = async () => {
    if (!form.userId) {
      alert("Pick a user");
      return;
    }
    try {
      await createEvent({
        userId: form.userId as never,
        type: form.type,
        detailsJson: JSON.stringify({ note: form.details }),
      });
      setOpen(false);
      setForm({ userId: "", type: "MANUAL_FLAG", details: "" });
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Fraud events"
        sub={`${events?.length ?? "—"} recorded signals`}
        action={<button className="btn btn-primary" onClick={() => setOpen(true)}>+ Flag user</button>}
      />
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Fraud account</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Signals</th>
              <th>Latest</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {accounts?.map((a) => (
              <tr key={a.userId} onClick={() => setSelected(a.userId)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{a.username}<div className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{a.email ?? a.userId}</div></td>
                <td><span className={`badge ${a.accountStatus === "active" ? "badge-green" : "badge-red"}`}>{a.accountStatus}</span></td>
                <td><RiskBadge score={a.fraudScore} tier={a.fraudTier} /></td>
                <td>{a.count}</td>
                <td><span className="badge badge-red">{a.lastType}</span></td>
                <td>{timeAgo(a.lastAt)}</td>
              </tr>
            ))}
            {(!accounts || accounts.length === 0) && <EmptyRow colSpan={6} text="No flagged accounts" />}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Details</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events?.map((e) => (
              <tr key={e._id}>
                <td style={{ fontWeight: 600 }}>{e.username}</td>
                <td><span className="badge badge-red">{e.type}</span></td>
                <td className="truncate mono">{e.detailsJson}</td>
                <td>{timeAgo(e._creationTime)}</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      confirmThen("Delete this fraud event?", () => deleteEvent({ eventId: e._id }))
                    }>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {(!events || events.length === 0) && <EmptyRow colSpan={5} text="No fraud events — all quiet" />}
          </tbody>
        </table>
      </div>

      <Modal title={detail?.account ? `Fraud account · ${detail.account.username}` : "Fraud account"} open={!!selected} onClose={() => setSelected(null)}>
        {!detail ? (
          <p>Loading…</p>
        ) : !detail.account ? (
          <p>Account not found.</p>
        ) : (
          <div style={{ display: "grid", gap: 14, maxHeight: "70vh", overflow: "auto" }}>
            <AccountCard title="Flagged account" a={detail.account} />

            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Fraud events ({detail.events.length})</div>
              {detail.events.map((e) => (
                <div key={e._id} className="mono" style={{ fontSize: 12, padding: "6px 0", borderTop: "1px solid #eee" }}>
                  <span className="badge badge-red" style={{ marginRight: 8 }}>{e.type}</span>
                  {timeAgo(e._creationTime)} · {e.detailsJson}
                </div>
              ))}
            </div>

            {detail.linkedWith.map((l) => (
              <div key={l.identity} style={{ borderTop: "2px solid #eee", paddingTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Tried to link <span className="mono">{l.identity}</span>
                </div>
                {l.owner ? <AccountCard title="Owned by" a={l.owner} /> : <p style={{ fontSize: 12 }}>Owner account no longer exists.</p>}
                {l.otherAttempts.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, margin: "8px 0 4px" }}>Other accounts that also tried this identity</div>
                    {l.otherAttempts.map((a) => <AccountCard key={a.userId} title="Also attempted" a={a} />)}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal title="Flag user" open={open} onClose={() => setOpen(false)}>
        <Field label="User">
          <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
            <option value="">Select a user…</option>
            {users?.map((u) => (
              <option key={u._id} value={u._id}>{u.username}</option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="MANUAL_FLAG">MANUAL_FLAG</option>
            <option value="MULTI_ACCOUNT">MULTI_ACCOUNT</option>
            <option value="FAKE_SCREENSHOT">FAKE_SCREENSHOT</option>
            <option value="UNFOLLOW_DETECTED">UNFOLLOW_DETECTED</option>
          </select>
        </Field>
        <Field label="Note">
          <textarea
            rows={3}
            value={form.details}
            onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
            placeholder="Why is this user being flagged?"
          />
        </Field>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={save}>Flag user</button>
        </div>
      </Modal>
    </div>
  );
}

type AccountSummary = {
  userId: string; username: string; email: string | null; country: string; accountStatus: string;
  fraudScore: number; fraudTier: string; externalUid: string; telegramUserId: string | null;
  piUsername: string | null; signupIp: string; deviceFingerprint: string; createdAt: number; logins: string[];
};

function AccountCard({ title, a }: { title: string; a: AccountSummary }) {
  return (
    <div style={{ background: "#f7f7fa", borderRadius: 10, padding: 10, fontSize: 12, marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>{title}: {a.username}</span>
        <RiskBadge score={a.fraudScore} tier={a.fraudTier} />
      </div>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
        <span>id: {a.userId}</span>
        <span>status: {a.accountStatus}</span>
        <span>email: {a.email ?? "—"}</span>
        <span>country: {a.country}</span>
        <span>identity: {a.externalUid}</span>
        <span>telegram: {a.telegramUserId ?? "—"}</span>
        <span>pi: {a.piUsername ? `@${a.piUsername}` : "—"}</span>
        <span>logins: {a.logins.join(", ") || "—"}</span>
        <span>ip: {a.signupIp}</span>
        <span>device: {a.deviceFingerprint}</span>
        <span>joined: {timeAgo(a.createdAt)}</span>
      </div>
    </div>
  );
}
