"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { startPiPayment } from "@/pi/pi";
import type { Id } from "@convex/dataModel";

type Method = "POINTS" | "PI";

const STATUS_LABEL: Record<string, string> = {
  processing: "Processing…",
  fulfilled: "Fulfilled ✓",
  failed: "Failed",
  refunded: "Refunded",
};

// Airtime & data redemption (plan §7.8 / §7.8b) with exactly two payment
// methods: points (earned) or Pi coin (real Pi via Pi SDK payment). Every
// order is fulfilled through the VAS pipeline; Pi payments are verified +
// approved + completed server-side only after fulfillment succeeds.
export default function PiRedeem() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const catalog = useQuery(api.rewards.listCatalog, userId ? { userId } : "skip");
  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const mine = useQuery(api.rewards.listMyRedemptions, userId ? { userId } : "skip");

  const redeem = useMutation(api.rewards.redeem);
  const startPi = useMutation(api.piPayments.startPiRedemption);
  const completePi = useMutation(api.piPayments.completePiRedemption);

  const [sel, setSel] = useState<{ id: Id<"catalog">; name: string; method: Method } | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId || !me) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const piUid = me.externalUid?.startsWith("pi:") ? me.externalUid.slice(3) : undefined;

  const confirm = async () => {
    if (!sel || !phone.trim()) {
      setMsg({ ok: false, text: "Pick a bundle and enter your phone number." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (sel.method === "POINTS") {
        await redeem({ userId, catalogId: sel.id, phoneNumber: phone });
        setMsg({ ok: true, text: "Redemption submitted. Your top-up is on the way." });
      } else {
        const item = catalog?.find((c) => c._id === sel.id);
        if (!item?.coinPrice) throw new Error("This bundle isn't available for Pi purchase");
        // Real Pi SDK: opens the payment dialog and drives the 3-phase flow.
        // Phase I approves server-side, Phase III completes + tops up only after
        // the Pi blockchain transaction is confirmed (plan §7.8).
        await startPiPayment(
          {
            amount: item.coinPrice,
            memo: `View2Earn: ${item.name}`,
            metadata: { catalogId: sel.id },
            uid: piUid,
          },
          {
            onReadyForServerApproval: async (paymentId) => {
              await startPi({ userId, catalogId: sel.id, phoneNumber: phone, paymentId });
            },
            onReadyForServerCompletion: async (paymentId, txid) => {
              await completePi({ userId, paymentId, txid });
            },
            onCancel: () => setMsg({ ok: false, text: "Pi payment cancelled." }),
            onError: (e) => setMsg({ ok: false, text: e?.message ?? "Pi payment error." }),
          },
        );
        // Resolve any earlier abandoned-but-signed payment, then clear the form.
        setMsg({ ok: true, text: "Pi payment submitted. Approve it in your Pi app to top up." });
      }
      setPhone("");
      setSel(null);
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error)?.message ?? e).replace("[CONVEX] ", "") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-page">
      <div className="pi-page-head">
        <h1>Redeem rewards</h1>
        <p className="pi-muted">
          Balance: <strong>{balance ?? "…"} pts</strong> · Pay with points or Pi coin (π)
        </p>
      </div>

      {msg && (
        <div className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}>{msg.text}</div>
      )}

      <div className="pi-catalog">
        {catalog === undefined ? (
          <div className="pi-centered"><div className="pi-spinner" /></div>
        ) : catalog.length === 0 ? (
          <section className="pi-card pi-empty"><p>No rewards available yet.</p></section>
        ) : (
          catalog.map((item) => {
            const affordable = balance !== undefined && (item.pointsPrice ?? 0) <= balance;
            const isSel = sel?.id === item._id;
            return (
              <section key={item._id} className={`pi-card pi-cat ${isSel ? "pi-cat-selected" : ""}`}>
                <div className="pi-cat-head">
                  <div>
                    <h3>{item.name}</h3>
                    <p className="pi-muted">{item.itemType === "DATA" ? "Data bundle" : "Airtime top-up"}</p>
                  </div>
                  <span className="pi-badge pi-badge-accent">{item.itemType}</span>
                </div>
                <div className="pi-cat-actions">
                  {item.pointsPrice !== undefined && (
                    <button
                      className={`btn ${affordable ? "btn-primary" : "btn-secondary"} btn-sm`}
                      disabled={!affordable}
                      onClick={() => setSel({ id: item._id, name: item.name, method: "POINTS" })}>
                      {item.pointsPrice} pts
                    </button>
                  )}
                  {item.coinPrice !== undefined && (
                    <button
                      className="btn btn-secondary btn-sm pi-coin-btn"
                      disabled={!piUid}
                      onClick={() => setSel({ id: item._id, name: item.name, method: "PI" })}>
                      π {item.coinPrice}
                    </button>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>

      {sel && (
        <section className="pi-card pi-checkout">
          <div className="pi-card-head">
            <h2>Checkout · {sel.name}</h2>
            <span className="pi-badge pi-badge-accent">
              {sel.method === "POINTS" ? "Pay with points" : "Pay with Pi"}
            </span>
          </div>
          <input
            className="pi-input"
            type="tel"
            placeholder="Phone number to receive top-up (e.g. 08012345678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          {sel.method === "PI" && !piUid ? (
            <p className="pi-hint">Sign in with Pi to pay with Pi coin.</p>
          ) : null}
          <div className="pi-checkout-actions">
            <button className="btn btn-ghost" onClick={() => setSel(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirm} disabled={busy || (sel.method === "PI" && !piUid)}>
              {busy ? "Processing…" : sel.method === "POINTS" ? "Redeem" : `Pay π & top up`}
            </button>
          </div>
        </section>
      )}

      <section className="pi-card pi-history">
        <div className="pi-card-head"><h2>My redemptions</h2></div>
        {mine === undefined ? (
          <div className="pi-spinner" />
        ) : mine.length === 0 ? (
          <p className="pi-muted">No redemptions yet.</p>
        ) : (
          <table className="pi-table">
            <tbody>
              {mine.map((r) => (
                <tr key={r._id}>
                  <td>{r.name}</td>
                  <td className="pi-num">{r.phoneNumber}</td>
                  <td><span className={`pi-status ${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                  <td className="pi-muted">{new Date(r.at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
