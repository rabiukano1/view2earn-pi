"use client";

import { useAdminMutation, useAdminQuery } from "../useAdmin";
import { api } from "@convex/api";
import { PageHeader, EmptyRow, RiskBadge, timeAgo } from "@/components/ui";

const STATUS_BADGE: Record<string, string> = {
  fulfilled: "badge-green",
  failed: "badge-red",
  refunded: "badge-yellow",
  processing: "badge-gray",
};

export default function RedemptionsPage() {
  const redemptions = useAdminQuery(api.admin.listRedemptions);
  const updateStatus = useAdminMutation(api.admin.updateRedemptionStatus);

  return (
    <div>
      <PageHeader title="Redemptions" sub={`${redemptions?.length ?? "—"} data & airtime payouts`} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Risk</th>
              <th>Amount</th>
              <th>Paid with</th>
              <th>Phone</th>
              <th>Status</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {redemptions?.map((r) => (
              <tr key={r._id}>
                <td style={{ fontWeight: 600 }}>{r.username}</td>
                <td><RiskBadge score={r.fraudScore} tier={r.fraudTier} /></td>
                <td className="num">{r.amount}</td>
                <td><span className="badge badge-gray">{r.paidWith}</span></td>
                <td className="num">{r.phoneNumber}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[r.status] ?? "badge-gray"}`}>{r.status}</span>
                </td>
                <td>{timeAgo(r._creationTime)}</td>
                <td>
                  <div className="row-actions">
                    {r.status === "processing" && (
                      <>
                        <button
                          className="btn btn-ok btn-sm"
                          onClick={() => updateStatus({ redemptionId: r._id, status: "fulfilled" })}>
                          Mark fulfilled
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => updateStatus({ redemptionId: r._id, status: "failed" })}>
                          Mark failed
                        </button>
                      </>
                    )}
                    {r.status === "failed" && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => updateStatus({ redemptionId: r._id, status: "refunded" })}>
                        Refund points
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(!redemptions || redemptions.length === 0) && (
              <EmptyRow colSpan={8} text="No redemptions yet" />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
