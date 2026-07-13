"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { Modal, Field, PageHeader, EmptyRow, confirmThen, timeAgo } from "@/components/ui";

export default function FraudPage() {
  const events = useQuery(api.admin.listFraudEvents);
  const users = useQuery(api.admin.listUsers);
  const createEvent = useMutation(api.admin.createFraudEvent);
  const deleteEvent = useMutation(api.admin.deleteFraudEvent);

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
