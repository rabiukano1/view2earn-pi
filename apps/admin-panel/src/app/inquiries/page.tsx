"use client";

import { Fragment, useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { PageHeader, EmptyRow, confirmThen, timeAgo } from "@/components/ui";

type Status = "new" | "seen" | "done" | "archived";
type Kind = "contact" | "partner";

const STATUS_BADGE: Record<Status, string> = {
  new: "badge-yellow",
  seen: "badge-accent",
  done: "badge-green",
  archived: "badge-gray",
};

const KIND_LABEL: Record<Kind, string> = {
  contact: "Contact",
  partner: "Partner",
};

const STATUS_OPTIONS: Status[] = ["new", "seen", "done", "archived"];

export default function InquiriesPage() {
  const [kind, setKind] = useState<Kind | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [expanded, setExpanded] = useState<Id<"inquiries"> | null>(null);

  const inquiries = useAdminQuery(api.inquiries.listInquiries, { kind: kind || undefined, status: status || undefined });
  const setInquiryStatus = useAdminMutation(api.inquiries.updateInquiryStatus);
  const deleteInquiry = useAdminMutation(api.inquiries.deleteInquiry);

  return (
    <div>
      <PageHeader
        title="Inquiries"
        sub="Messages and partner requests from the public website"
      />

      <div className="card" style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind | "")} style={{ width: 160 }}>
          <option value="">All kinds</option>
          <option value="contact">Contact</option>
          <option value="partner">Partner</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | "")} style={{ width: 160 }}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>From</th>
              <th>Status</th>
              <th>Received</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inquiries?.map((q) => (
              <Fragment key={q._id}>
                <tr onClick={() => setExpanded(expanded === q._id ? null : q._id)} style={{ cursor: "pointer" }}>
                  <td><span className="badge badge-gray">{KIND_LABEL[q.kind]}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{q.name}</div>
                    <div className="sub" style={{ color: "var(--text-3)", fontSize: 12.5 }}>{q.email}</div>
                  </td>
                  <td>
                    <select
                      className={`badge ${STATUS_BADGE[q.status]}`}
                      value={q.status}
                      style={{ border: "none", background: "transparent", font: "inherit" }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setInquiryStatus({ inquiryId: q._id, status: e.target.value as Status })}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num" style={{ color: "var(--text-3)", whiteSpace: "nowrap" }}>{timeAgo(q._creationTime)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setExpanded(expanded === q._id ? null : q._id); }}>
                        {expanded === q._id ? "Hide" : "View"}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmThen(`Delete inquiry from ${q.name}?`, () => deleteInquiry({ inquiryId: q._id }));
                        }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === q._id && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--surface-2)" }}>
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10, fontSize: 13 }}>
                          {q.company && <span><strong>Company:</strong> {q.company}</span>}
                          {q.platform && <span><strong>Interested in:</strong> {q.platform}</span>}
                          {q.ip && <span><strong>IP:</strong> {q.ip}</span>}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text-2)" }}>{q.message}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {(!inquiries || inquiries.length === 0) && (
              <EmptyRow colSpan={5} text="No inquiries match the current filters" />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
