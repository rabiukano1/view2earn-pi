"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  processing: "Processing…",
  completed: "Completed ✓",
  failed: "Failed",
};

// Pi wallet: points + Pi balances, linked wallet, withdrawal + history.
// Modernized with a gradient hero and compact glass cards (no inline styles).
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
    <div className="pi-page pi-wallet">
      {/* Hero */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">My Wallet 💜</p>
        <p className="pi-balance-label">Points Balance</p>
        <p className="pi-balance-value">{myWallet?.pointsBalance ?? "…"}</p>
        <div className="pi-hero-actions">
          <Link className="pi-chip" href="/tasks">Earn more →</Link>
          <span className="pi-hero-date">ON-CHAIN · {myWallet?.network?.toUpperCase() ?? "…"}</span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Pi on-chain balance */}
        <section className="pi-card pi-card-glass">
          <div className="pi-row">
            <span className="pi-wallet-icon" style={{ background: "rgba(98,126,234,0.14)" }}>π</span>
            <div className="pi-grow">
              <p className="pi-card-title">Pi on-chain</p>
              <p className="pi-muted">Live balance from the Pi blockchain</p>
            </div>
            <span className="pi-badge pi-badge-accent">{myWallet?.network?.toUpperCase()}</span>
          </div>
          <p className="pi-wallet-pi-balance">
            {piBalance !== null ? `${piBalance} π` : "…"}
          </p>
          {balError ? <p className="pi-error">{balError}</p> : null}
        </section>

        {/* Withdraw */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Withdraw to Pi</h2>
            <span className="pi-badge pi-badge-live">1 Pi = {pointsPerPi} pts</span>
          </div>

          {address ? (
            <form onSubmit={handleWithdraw}>
              <p className="pi-muted">
                Recipient wallet: <strong className="pi-wallet-addr" title={address}>{short(address)}</strong>
              </p>

              {withdrawMsg ? (
                <div className={`pi-msg ${withdrawMsg.ok ? "pi-msg-ok" : "pi-msg-err"}`}>
                  {withdrawMsg.text}
                </div>
              ) : null}

              <div className="pi-withdraw-row">
                <input
                  className="pi-input pi-withdraw-input"
                  type="number"
                  min={withdrawalRate?.minPoints ?? 100}
                  step="1"
                  placeholder={`Points to redeem (min ${withdrawalRate?.minPoints ?? 100})`}
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={withdrawBusy || !pointsNum || pointsNum <= 0}>
                  {withdrawBusy ? "Processing…" : `Withdraw ${calculatedPi} π`}
                </button>
              </div>
              {pointsNum > 0 ? (
                <p className="pi-hint">
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

        {/* Linked wallet */}
        <section className="pi-card pi-card-glass">
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

        {/* History */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Withdrawal history</h2>
            {withdrawals && withdrawals.length > 0 ? (
              <span className="pi-badge pi-badge-accent">{withdrawals.length}</span>
            ) : null}
          </div>
          {withdrawals === undefined ? (
            <div className="pi-spinner" />
          ) : withdrawals.length === 0 ? (
            <p className="pi-muted">No Pi withdrawals requested yet.</p>
          ) : (
            <div className="pi-activity">
              {withdrawals.map((w) => (
                <div key={w._id} className="pi-activity-row">
                  <span className="pi-withdraw-status-icon">π</span>
                  <div className="pi-grow">
                    <div className="pi-withdraw-line">
                      <span className="pi-withdraw-pi">+{w.piAmount} π</span>
                      <span className={`pi-status ${w.status}`}>
                        {STATUS_LABEL[w.status] ?? w.status}
                      </span>
                    </div>
                    <p className="pi-muted">
                      {new Date(w._creationTime).toLocaleDateString()} · -{w.pointsSpent} pts
                      {w.txid ? ` · Tx ${short(w.txid)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
