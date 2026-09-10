"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { authenticatePiWallet } from "@/pi/pi";
import { QRCodeSVG } from "qrcode.react";
import type { Id } from "@convex/dataModel";

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: string }> = {
  pending: { label: "Queued", class: "pi-status-pending", icon: "⏳" },
  processing: { label: "Processing…", class: "pi-status-processing", icon: "🔄" },
  completed: { label: "Completed ✓", class: "pi-status-completed", icon: "✅" },
  failed: { label: "Failed", class: "pi-status-failed", icon: "❌" },
};

// Friendly label for the append-only pointsLedger reasons.
const REASON_LABEL: Record<string, string> = {
  TASK_COMPLETED: "Task completed",
  DAILY_CHECKIN: "Daily check-in",
  MYSTERY_BOX: "Mystery box",
  SPIN_WHEEL: "Spin wheel",
  QUIZ_CORRECT: "Quiz correct",
  SURVEY_COMPLETED: "Survey completed",
  ACADEMY_LEVEL: "Academy level",
  COMBO_BONUS: "Combo bonus",
  REFERRAL: "Referral bonus",
  REDEEM: "Redeemed rewards",
  MARKETPLACE_LISTING: "Marketplace sale",
  MARKETPLACE_REFUND: "Marketplace refund",
  PI_DONATION_BONUS: "Donation bonus",
  SWAP_PIPRO_TO_POINTS: "Swapped PIPRO → points",
  SWAP_POINTS_TO_PIPRO: "Swapped points → PIPRO",
  WITHDRAWAL: "Withdrawal",
};

function reasonLabel(reason: string): string {
  if (reason.startsWith("PI_WITHDRAWAL")) return "Pi wallet payout";
  if (reason.startsWith("AD_REWARD")) return "Rewarded ad";
  if (reason.startsWith("REFUND")) return "Refund";
  const base = reason.split(":")[0].trim();
  return REASON_LABEL[base] ?? base.replace(/_/g, " ").toLowerCase();
}

type HistoryTab = "activity" | "payouts";

export default function PiWallet() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const myWallet = useQuery(api.piWallet.getMyWallet, userId ? { userId } : "skip");
  const summary = useQuery(api.points.summary, userId ? { userId } : "skip");
  const history = useQuery(api.points.history, userId ? { userId } : "skip");
  const withdrawalRate = useQuery(api.piWithdrawals.getWithdrawalRate, userId ? { userId } : "skip");
  const withdrawals = useQuery(api.piWithdrawals.listMyWithdrawals, userId ? { userId } : "skip");

  const getPiBalance = useAction(api.piWallet.getPiBalance);
  const requestWithdrawal = useMutation(api.piWithdrawals.requestPiWithdrawal);

  const [piBalance, setPiBalance] = useState<number | null>(null);
  const [balLoading, setBalLoading] = useState<boolean>(false);
  const [balError, setBalError] = useState<string>("");

  const [pointsInput, setPointsInput] = useState<string>("");
  const [withdrawBusy, setWithdrawBusy] = useState<boolean>(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Withdrawal confirmation modal
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<HistoryTab>("activity");
  const [showFullAddr, setShowFullAddr] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  const address = myWallet?.piWalletAddress ?? null;
  const network = myWallet?.network ?? "testnet";

  const fetchBalance = useCallback(
    async (addr: string) => {
      setBalLoading(true);
      setBalError("");
      try {
        const res = await getPiBalance({ walletAddress: addr });
        setPiBalance(res.piBalance);
      } catch (e) {
        setBalError(String((e as Error)?.message ?? e).replace("[CONVEX] ", ""));
      } finally {
        setBalLoading(false);
      }
    },
    [getPiBalance]
  );

  useEffect(() => {
    if (address) {
      fetchBalance(address);
    }
  }, [address, fetchBalance]);

  // Auto-refresh the on-chain balance every 45s while the page is open.
  useEffect(() => {
    if (!address) return;
    const t = setInterval(() => fetchBalance(address), 45_000);
    return () => clearInterval(t);
  }, [address, fetchBalance]);

  const explorerBase = useMemo(
    () =>
      network === "mainnet"
        ? "https://blockexplorer.minepi.com/tx/"
        : "https://blockexplorer.minepi.com/testnet/tx/",
    [network]
  );

  if (!userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;
  const pointsNum = parseInt(pointsInput || "0", 10);
  const pointsPerPi = withdrawalRate?.pointsPerPi ?? 1000;
  const userBalance = myWallet?.pointsBalance ?? 0;

  const calculatedPi =
    Number.isFinite(pointsNum) && pointsNum > 0
      ? (pointsNum / pointsPerPi).toFixed(4)
      : "0.0000";

  const canSubmit =
    pointsNum > 0 &&
    (!withdrawalRate || pointsNum >= withdrawalRate.minPoints) &&
    pointsNum <= userBalance;

  const openConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);

    if (!pointsNum || pointsNum <= 0) {
      setWithdrawMsg({ ok: false, text: "Enter a valid points amount." });
      return;
    }
    if (withdrawalRate && pointsNum < withdrawalRate.minPoints) {
      setWithdrawMsg({
        ok: false,
        text: `Minimum withdrawal is ${withdrawalRate.minPoints} points.`,
      });
      return;
    }
    if (pointsNum > userBalance) {
      setWithdrawMsg({ ok: false, text: "Insufficient points balance." });
      return;
    }
    setConfirmOpen(true);
  };

  const handleWithdraw = async () => {
    setWithdrawBusy(true);
    setConfirmOpen(false);
    setWithdrawMsg(null);
    try {
      const res = await requestWithdrawal({ userId, pointsToRedeem: pointsNum });
      setWithdrawMsg({
        ok: true,
        text: `Direct payout initiated! ${res.piAmount} Pi is being sent to your Pi wallet on-chain.`,
      });
      setPointsInput("");
      if (address) fetchBalance(address);
    } catch (err) {
      setWithdrawMsg({
        ok: false,
        text: String((err as Error)?.message ?? err).replace("[CONVEX] ", ""),
      });
    } finally {
      setWithdrawBusy(false);
    }
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePreset = (pts: number) => {
    setPointsInput(String(pts));
  };

  const handleMax = () => {
    if (userBalance > 0) {
      setPointsInput(String(userBalance));
    }
  };

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const activityRows = history ?? [];

  return (
    <div className="pi-page pi-wallet">
      {/* Modern Gradient Hero */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Pi Wallet Hub 💜</p>
        <p className="pi-balance-label">Available Points Balance</p>
        <p className="pi-balance-value">{userBalance.toLocaleString()}</p>
        <p className="pi-muted" style={{ color: "#EDE9FE", fontSize: 13, marginTop: -4 }}>
          ≈ {(userBalance / pointsPerPi).toFixed(4)} π Value
        </p>
        <div className="pi-hero-actions" style={{ marginTop: 14 }}>
          <Link className="pi-chip" href="/tasks">
            Earn more points →
          </Link>
          <span className="pi-hero-date">
            ON-CHAIN · {network.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Points summary stats */}
        {summary && (
          <section className="pi-stats">
            <div className="pi-stat">
              <span className="pi-stat-label">Total earned</span>
              <span className="pi-stat-value pi-stat-plus">+{summary.totalEarned.toLocaleString()}</span>
            </div>
            <div className="pi-stat">
              <span className="pi-stat-label">Total spent</span>
              <span className="pi-stat-value pi-stat-minus">−{summary.totalSpent.toLocaleString()}</span>
            </div>
            <div className="pi-stat">
              <span className="pi-stat-label">Earned · 7d</span>
              <span className="pi-stat-value pi-stat-plus">+{summary.weekEarned.toLocaleString()}</span>
            </div>
            <div className="pi-stat">
              <span className="pi-stat-label">Spent · 7d</span>
              <span className="pi-stat-value pi-stat-minus">−{summary.weekSpent.toLocaleString()}</span>
            </div>
          </section>
        )}

        {/* On-Chain Pi Balance Card */}
        <section className="pi-card pi-card-glass">
          <div className="pi-row">
            <span className="pi-wallet-icon">π</span>
            <div className="pi-grow">
              <p className="pi-card-title">Pi On-Chain Wallet</p>
              <p className="pi-muted">Live Pi balance on Stellar/Pi Blockchain</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {address && (
                <button
                  className="pi-btn-mini"
                  onClick={() => fetchBalance(address)}
                  disabled={balLoading}
                  title="Refresh balance"
                >
                  {balLoading ? "…" : "🔄"}
                </button>
              )}
              <span className="pi-badge pi-badge-accent">{network.toUpperCase()}</span>
            </div>
          </div>
          <p className="pi-wallet-pi-balance">
            {balLoading ? "Loading…" : piBalance !== null ? `${piBalance} π` : "0.0000 π"}
          </p>
          {balError ? <p className="pi-error">{balError}</p> : null}
        </section>

        {/* Direct Payout to Pi Wallet */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Direct Payout to Pi Wallet</h2>
            <span className="pi-badge pi-badge-live">1 Pi = {pointsPerPi} pts</span>
          </div>

          {address ? (
            <form onSubmit={openConfirm}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  padding: "10px 14px",
                  borderRadius: 12,
                  marginBottom: 14,
                }}
              >
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p className="pi-muted" style={{ fontSize: 11, marginBottom: 2 }}>
                    RECIPIENT PI WALLET:
                  </p>
                  <p className="pi-wallet-addr" style={{ fontSize: 13, fontWeight: 700 }} title={address}>
                    {short(address)}
                  </p>
                </div>
                <button
                  type="button"
                  className="pi-btn-mini"
                  onClick={() => handleCopy(address)}
                  style={{ fontSize: 12 }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>

              {withdrawMsg && (
                <div
                  className={`pi-msg ${withdrawMsg.ok ? "pi-msg-ok" : "pi-msg-err"}`}
                  style={{ marginBottom: 14 }}
                >
                  {withdrawMsg.text}
                </div>
              )}

              {/* Quick Presets */}
              <div className="pi-preset-row">
                <button
                  type="button"
                  className="pi-preset-chip"
                  onClick={() => handlePreset(100)}
                >
                  100 pts (0.1 π)
                </button>
                <button
                  type="button"
                  className="pi-preset-chip"
                  onClick={() => handlePreset(500)}
                >
                  500 pts (0.5 π)
                </button>
                <button
                  type="button"
                  className="pi-preset-chip"
                  onClick={() => handlePreset(1000)}
                >
                  1,000 pts (1.0 π)
                </button>
                <button
                  type="button"
                  className="pi-preset-chip pi-preset-max"
                  onClick={handleMax}
                >
                  MAX
                </button>
              </div>

              {/* Amount Input */}
              <div className="pi-withdraw-row" style={{ marginTop: 12 }}>
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
                  style={{ minWidth: 160 }}
                  disabled={withdrawBusy || !canSubmit}
                >
                  {withdrawBusy ? "Processing Payout…" : `Withdraw ${calculatedPi} π`}
                </button>
              </div>

              {pointsNum > 0 && (
                <div className="pi-payout-preview">
                  <p className="pi-hint" style={{ marginTop: 10 }}>
                    You will receive <strong>{calculatedPi} π</strong> directly in your linked Pi wallet via direct on-chain transfer.
                  </p>
                </div>
              )}
            </form>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p className="pi-muted" style={{ marginBottom: 14 }}>
                Your Pi wallet address is linked automatically when you sign in with Pi inside the Pi Browser.
              </p>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await authenticatePiWallet();
                    window.location.reload();
                  } catch (e) {
                    alert(String(e));
                  }
                }}
              >
                Link Pi Wallet Now
              </button>
            </div>
          )}
        </section>

        {/* Linked Wallet Details + QR */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Linked Pi Wallet</h2>
            {address ? <span className="pi-badge pi-badge-live">LINKED</span> : null}
          </div>
          {address ? (
            <div className="pi-wallet-link">
              <div className="pi-qr">
                <QRCodeSVG
                  value={address}
                  size={132}
                  fgColor="#16151b"
                  bgColor="#ffffff"
                  level="M"
                  marginSize={2}
                />
                <p className="pi-muted pi-qr-hint">Scan to send Pi to this wallet</p>
              </div>
              <div className="pi-wallet-link-body">
                <p className="pi-wallet-addr" title={address} style={{ wordBreak: "break-all", fontSize: 13 }}>
                  {showFullAddr ? address : short(address)}
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="pi-btn-mini"
                    onClick={() => handleCopy(address)}
                  >
                    {copied ? "✓ Copied" : "Copy Address"}
                  </button>
                  <button
                    type="button"
                    className="pi-btn-mini"
                    onClick={() => setShowFullAddr((v) => !v)}
                  >
                    {showFullAddr ? "Hide" : "Show full"}
                  </button>
                  <a
                    className="pi-btn-mini"
                    href={`${explorerBase.replace("/tx/", "/")}#/accounts/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on explorer ↗
                  </a>
                </div>
                <p className="pi-muted" style={{ marginTop: 10, fontSize: 12 }}>
                  {network === "mainnet" ? "Pi Mainnet" : "Pi Testnet"} · public address only, we never store your keys.
                </p>
              </div>
            </div>
          ) : (
            <p className="pi-muted">
              Your Pi wallet is linked automatically when you sign in with Pi inside the Pi Browser.
            </p>
          )}
        </section>

        {/* History: points activity + payouts */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>History</h2>
            <div className="pi-seg">
              <button
                className={`pi-seg-btn ${tab === "activity" ? "pi-seg-on" : ""}`}
                onClick={() => setTab("activity")}
              >
                Points
              </button>
              <button
                className={`pi-seg-btn ${tab === "payouts" ? "pi-seg-on" : ""}`}
                onClick={() => setTab("payouts")}
              >
                Payouts
              </button>
            </div>
          </div>

          {tab === "activity" ? (
            activityRows.length === 0 ? (
              <p className="pi-muted">No points activity yet — complete your first task to start earning.</p>
            ) : (
              <div className="pi-activity">
                {activityRows.map((h) => (
                  <div key={h._id} className="pi-activity-row">
                    <span className={`pi-delta ${h.delta > 0 ? "pi-delta-plus" : "pi-delta-minus"}`}>
                      {h.delta > 0 ? `+${h.delta}` : h.delta}
                    </span>
                    <div className="pi-grow">
                      <p className="pi-activity-reason">{reasonLabel(h.reason)}</p>
                      <p className="pi-muted">{fmtDate(h._creationTime)}</p>
                    </div>
                    <span className="pi-num">Bal {h.balanceAfter}</span>
                  </div>
                ))}
              </div>
            )
          ) : withdrawals === undefined ? (
            <div className="pi-spinner" />
          ) : withdrawals.length === 0 ? (
            <p className="pi-muted">No Pi payouts requested yet.</p>
          ) : (
            <div className="pi-activity">
              {withdrawals.map((w) => {
                const conf = STATUS_CONFIG[w.status] ?? {
                  label: w.status,
                  class: "pi-status-pending",
                  icon: "❓",
                };
                return (
                  <div key={w._id} className="pi-activity-row">
                    <span className="pi-withdraw-status-icon">π</span>
                    <div className="pi-grow">
                      <div className="pi-withdraw-line">
                        <span className="pi-withdraw-pi">+{w.piAmount} π</span>
                        <span className={`pi-status ${conf.class}`}>
                          {conf.icon} {conf.label}
                        </span>
                      </div>
                      <p className="pi-muted">
                        {fmtDate(w._creationTime)} · -{w.pointsSpent} pts
                        {w.txid ? (
                          <>
                            {" · "}
                            <a
                              className="pi-explorer-link"
                              href={`${explorerBase}${w.txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={w.txid}
                            >
                              Tx {short(w.txid)} ↗
                            </a>
                          </>
                        ) : null}
                      </p>
                      {w.failureReason ? (
                        <p className="pi-muted pi-fail-reason">{w.failureReason}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Withdrawal confirmation modal */}
      {confirmOpen && (
        <div className="pi-modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="pi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pi-modal-head">
              <h3>Confirm payout</h3>
              <button className="pi-modal-x" onClick={() => setConfirmOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="pi-modal-body">
              <div className="pi-confirm-row">
                <span className="pi-confirm-label">You send</span>
                <span className="pi-confirm-val">{pointsNum.toLocaleString()} pts</span>
              </div>
              <div className="pi-confirm-row">
                <span className="pi-confirm-label">You receive</span>
                <span className="pi-confirm-val pi-confirm-pi">+{calculatedPi} π</span>
              </div>
              <div className="pi-confirm-row">
                <span className="pi-confirm-label">To wallet</span>
                <span className="pi-confirm-val">{address ? short(address) : "—"}</span>
              </div>
              <p className="pi-muted" style={{ marginTop: 14, fontSize: 12 }}>
                Points are deducted immediately. The Pi is sent from our treasury on-chain to your wallet — usually within a few minutes.
              </p>
            </div>
            <div className="pi-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleWithdraw} disabled={withdrawBusy}>
                {withdrawBusy ? "Sending…" : `Confirm ${calculatedPi} π`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
