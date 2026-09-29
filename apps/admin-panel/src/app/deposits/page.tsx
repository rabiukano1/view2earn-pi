"use client";

import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { PageHeader, EmptyRow, timeAgo } from "@/components/ui";

const STATUS_BADGE: Record<string, string> = {
  credited: "badge-green",
  confirmed: "badge-green",
  completed: "badge-green",
  unmatched: "badge-yellow",
  pending: "badge-gray",
  failed: "badge-red",
};

// Every deposit source in one list: Stellar anchor, SIDRA, PIPRO, Pi.
// "unmatched" anchor deposits arrived with no/unknown memo — assign by username.
export default function DepositsPage() {
  const deposits = useAdminQuery(api.admin.listDeposits);
  const assign = useAdminMutation(api.admin.assignAnchorDeposit);
  const [err, setErr] = useState("");

  const onAssign = async (depositId: string) => {
    const username = window.prompt("Credit this deposit to which username?");
    if (!username) return;
    setErr("");
    try {
      await assign({ depositId: depositId as Id<"anchorDeposits">, username });
    } catch (e) {
      setErr(String((e as Error)?.message ?? e).replace("[CONVEX] ", ""));
    }
  };

  return (
    <div>
      <PageHeader title="Deposits" sub={`${deposits?.length ?? "—"} latest deposits · anchor, SIDRA, PIPRO, Pi`} />
      {err && <div className="card" style={{ color: "var(--red, #dc2626)", marginBottom: 12 }}>{err}</div>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>User</th>
              <th>Amount</th>
              <th>Credited</th>
              <th>Status</th>
              <th>Reference</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deposits?.map((d) => (
              <tr key={d._id}>
                <td><span className="badge badge-gray">{d.source}</span></td>
                <td style={{ fontWeight: 600 }}>{d.username ?? "—"}</td>
                <td className="num">{d.amount} {d.asset}</td>
                <td className="num">{d.credited}</td>
                <td><span className={`badge ${STATUS_BADGE[d.status] ?? "badge-gray"}`}>{d.status}</span></td>
                <td className="num" title={d.ref} style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.ref}</td>
                <td>{timeAgo(d.at)}</td>
                <td>
                  {d.source === "Anchor" && d.status === "unmatched" && (
                    <button className="btn btn-ok btn-sm" onClick={() => onAssign(d._id)}>Assign to user</button>
                  )}
                </td>
              </tr>
            ))}
            {(!deposits || deposits.length === 0) && <EmptyRow colSpan={8} text="No deposits yet" />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
