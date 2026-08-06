"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const STATUS_LABEL: Record<string, string> = {
  processing: "Processing…",
  completed: "Completed ✓",
  failed: "Failed",
};

export default function PiWallet() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const myWallet = useQuery(api.piWallet.getMyWallet, userId ? { userId } : "skip");
  const withdrawalRate = useQuery(api.piWithdrawals.getWithdrawalRate, userId ? { userId } : "skip");
  const withdrawals = useQuery(api.piWithdrawals.listMyWithdrawals, userId ? { userId } : "skip");
  
  const getPiBalance = useAction(api.piWallet.getPiBalance);
  const requestWithdrawal = useMutation(api.piWithdrawals.requestPiWithdrawal);

  const [piBalance, setPiBalance] = useState<number | null>(null);
  const [balError, setBalError] = useState<string>("");

  // Withdrawal form state
  const [pointsInput, setPointsInput] = useState<string>("");
  const [withdrawBusy, setWithdrawBusy] = useState<boolean>(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const address = myWallet?.piWalletAddress ?? null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setBalError("");
    getPiBalance({ walletAddress: address })
      .then((r) => {
        if (!cancelled) setPiBalance(r.piBalance);
      })
      .catch((e) => {
        if (!cancelled) {
          setBalError(String((e as Error)?.message ?? e).replace("[CONVEX] ", ""));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, getPiBalance]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;

  const pointsNum = parseInt(pointsInput || "0", 10);
  const pointsPerPi = withdrawalRate?.pointsPerPi ?? 1000;
  const calculatedPi = Number.isFinite(pointsNum) && pointsNum > 0
    ? (pointsNum / pointsPerPi).toFixed(4)
    : "0.0000";

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);

    if (!pointsNum || pointsNum <= 0) {
      setWithdrawMsg({ ok: false, text: "Enter a valid points amount." });
      return;
    }

    if (withdrawalRate && pointsNum < withdrawalRate.minPoints) {
      setWithdrawMsg({ ok: false, text: `Minimum withdrawal is ${withdrawalRate.minPoints} points.` });
      return;
    }

    if (myWallet && pointsNum > myWallet.pointsBalance) {
      setWithdrawMsg({ ok: false, text: "Insufficient points balance." });
      return;
    }

    setWithdrawBusy(true);
    try {
      const res = await requestWithdrawal({ userId, pointsToRedeem: pointsNum });
      setWithdrawMsg({
        ok: true,
        text: `Withdrawal request submitted! ${res.piAmount} Pi is being transferred to your wallet.`,
      });
      setPointsInput("");
    } catch (err) {
      setWithdrawMsg({
        ok: false,
        text: String((err as Error)?.message ?? err).replace("[CONVEX] ", ""),
      });
    } finally {
      setWithdrawBusy(false);
    }
  };

  return (
    <div className="pi-page">
      <div className="pi-page-head">
        <h1>Wallet & Withdrawals</h1>
        <p className="pi-muted">Your points and Pi balances — redeem earned points directly to your Pi blockchain wallet.</p>
      </div>

      <div className="pi-grid">
        <section className="pi-card">
          <div className="pi-card-head">
            <h2>Points</h2>
            <span className="pi-badge pi-badge-accent">APP BALANCE</span>
          </div>
          <div className="pi-balance-value">{myWallet?.pointsBalance ?? "…"}</div>
          <p className="pi-muted">Earn more points on the Tasks page.</p>
        </section>

        <section className="pi-card">
          <div className="pi-card-head">
            <h2>Pi (π)</h2>
            <span className="pi-badge pi-badge-accent">ON-CHAIN · {myWallet?.network?.toUpperCase()}</span>
          </div>
          <div className="pi-balance-value">{piBalance !== null ? `${piBalance} π` : "…"}</div>
          {balError ? <p className="pi-error">{balError}</p> : null}
          <p className="pi-muted">Live balance from the Pi blockchain.</p>
        </section>
      </div>

      <section className="pi-card">
        <div className="pi-card-head">
          <h2>Withdraw points to Pi wallet</h2>
          <span className="pi-badge pi-badge-live">
            1 Pi = {pointsPerPi} pts
          </span>
        </div>

        {address ? (
          <form onSubmit={handleWithdraw} style={{ marginTop: "1rem" }}>
            <p className="pi-muted" style={{ marginBottom: "1rem" }}>
              Recipient Wallet: <strong className="pi-wallet-addr" title={address}>{short(address)}</strong>
            </p>

            {withdrawMsg ? (
              <div className={`pi-msg ${withdrawMsg.ok ? "pi-msg-ok" : "pi-msg-err"}`} style={{ marginBottom: "1rem" }}>
                {withdrawMsg.text}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="pi-input"
                type="number"
                min={withdrawalRate?.minPoints ?? 100}
                step="1"
                placeholder={`Points to redeem (min ${withdrawalRate?.minPoints ?? 100})`}
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                style={{ flex: 1, minWidth: "200px" }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={withdrawBusy || !pointsNum || pointsNum <= 0}>
                {withdrawBusy ? "Processing…" : `Withdraw ${calculatedPi} π`}
              </button>
            </div>
            {pointsNum > 0 ? (
              <p className="pi-hint" style={{ marginTop: "0.5rem" }}>
                You will receive <strong>{calculatedPi} π</strong> directly in your linked Pi wallet.
              </p>
            ) : null}
          </form>
        ) : (
          <p className="pi-muted">
            Your Pi wallet is linked automatically when you sign in with Pi inside the Pi Browser.
          </p>
        )}
      </section>

      <section className="pi-card">
        <div className="pi-card-head">
          <h2>Linked Pi wallet</h2>
          {address ? <span className="pi-badge pi-badge-live">LINKED</span> : null}
        </div>
        {address ? (
          <p className="pi-wallet-addr" title={address}>{address}</p>
        ) : (
          <p className="pi-muted">
            Your Pi wallet is linked automatically when you sign in with Pi.
          </p>
        )}
      </section>

      <section className="pi-card pi-history">
        <div className="pi-card-head">
          <h2>Pi withdrawal history</h2>
        </div>
        {withdrawals === undefined ? (
          <div className="pi-spinner" />
        ) : withdrawals.length === 0 ? (
          <p className="pi-muted">No Pi withdrawals requested yet.</p>
        ) : (
          <table className="pi-table">
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.7 }}>
                <th style={{ paddingBottom: "0.5rem" }}>Date</th>
                <th style={{ paddingBottom: "0.5rem" }}>Points</th>
                <th style={{ paddingBottom: "0.5rem" }}>Pi Amount</th>
                <th style={{ paddingBottom: "0.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w._id}>
                  <td className="pi-muted">{new Date(w._creationTime).toLocaleDateString()}</td>
                  <td className="pi-num">-{w.pointsSpent} pts</td>
                  <td style={{ fontWeight: 600 }}>+{w.piAmount} π</td>
                  <td>
                    <span className={`pi-status ${w.status}`}>
                      {STATUS_LABEL[w.status] ?? w.status}
                    </span>
                    {w.txid ? (
                      <span className="pi-muted" style={{ display: "block", fontSize: "0.75rem" }}>
                        Tx: {short(w.txid)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
