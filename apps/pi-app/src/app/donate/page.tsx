"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { startPiPayment } from "@/pi/pi";
import type { Id } from "@convex/dataModel";

type Tier = {
  id: string;
  name: string;
  amount: number;
  bonusPts: number;
  badge: string;
  icon: string;
  color: string;
};

const TIERS: Tier[] = [
  {
    id: "supporter",
    name: "Supporter",
    amount: 0.1,
    bonusPts: 50,
    badge: "SUPPORTER",
    icon: "⭐",
    color: "#3B82F6",
  },
  {
    id: "champion",
    name: "Champion",
    amount: 1,
    bonusPts: 500,
    badge: "CHAMPION",
    icon: "🚀",
    color: "#8B5CF6",
  },
  {
    id: "legend",
    name: "Legend",
    amount: 5,
    bonusPts: 2500,
    badge: "LEGEND",
    icon: "👑",
    color: "#EC4899",
  },
];

export default function DonatePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const startDonation = useMutation(api.piDonations.startDonation);
  const completeDonation = useMutation(api.piDonations.completeDonation);
  const topDonors = useQuery(api.piDonations.listTopDonors);
  const myDonations = useQuery(
    api.piDonations.listMyDonations,
    userId ? { userId } : "skip"
  );

  const [selectedTier, setSelectedTier] = useState<string>("champion");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (me && !displayName) {
      setDisplayName(me.username || me.name || "");
    }
  }, [me, displayName]);

  if (!me || !userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const piUid = me.externalUid?.startsWith("pi:")
    ? me.externalUid.slice(3)
    : undefined;

  const activeTier = TIERS.find((t) => t.id === selectedTier);
  const finalAmount =
    selectedTier === "custom"
      ? parseFloat(customAmount) || 0
      : activeTier?.amount || 0;
  const estimatedBonus = Math.round(finalAmount * 500);

  const handleDonate = async () => {
    if (!piUid) {
      setMsg({
        ok: false,
        text: "Please sign in with Pi inside the Pi Browser to make a donation.",
      });
      return;
    }
    if (finalAmount <= 0) {
      setMsg({ ok: false, text: "Please enter a valid donation amount." });
      return;
    }

    setBusy(true);
    setMsg(null);

    const memoName = activeTier ? activeTier.name : "Custom Donation";

    try {
      await startPiPayment(
        {
          amount: finalAmount,
          memo: `View2Earn Donation: ${memoName}`,
          metadata: { type: "donation", tier: selectedTier },
          uid: piUid,
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            await startDonation({
              userId,
              amount: finalAmount,
              memo: `View2Earn Donation: ${memoName}`,
              paymentId,
              displayName: displayName.trim() || undefined,
            });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            await completeDonation({
              userId,
              paymentId,
              txid,
            });
            setMsg({
              ok: true,
              text: `Thank you for your ${finalAmount} π donation! Bonus +${estimatedBonus} pts awarded to your wallet.`,
            });
            setBusy(false);
          },
          onCancel: () => {
            setMsg({ ok: false, text: "Donation cancelled." });
            setBusy(false);
          },
          onError: (error) => {
            setMsg({
              ok: false,
              text: error?.message || "Pi payment failed. Please try again.",
            });
            setBusy(false);
          },
        }
      );
    } catch (e) {
      setMsg({
        ok: false,
        text: String((e as { message?: string })?.message ?? e).replace(
          "[CONVEX] ",
          ""
        ),
      });
      setBusy(false);
    }
  };

  return (
    <div className="pi-page pi-donate">
      {/* Hero Header */}
      <div className="pi-hero">
        <span className="pi-hero-blob pi-hero-blob-a" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-b" aria-hidden />
        <span className="pi-hero-blob pi-hero-blob-c" aria-hidden />
        <p className="pi-hero-hi">Support View2Earn 💜</p>
        <p className="pi-balance-label">Test Pi Browser U2A Payments</p>
        <p className="pi-balance-value">Donate π</p>
        <div className="pi-hero-actions">
          <Link className="pi-chip" href="/home">
            ← Back to Home
          </Link>
          <span className="pi-hero-date">ON-CHAIN · PI TESTNET/MAINNET</span>
        </div>
      </div>

      <div className="pi-home-body">
        {/* Tier Cards */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>Select Donation Tier</h2>
            <span className="pi-badge pi-badge-live">Earn Bonus Pts</span>
          </div>

          <div className="pi-donate-tiers">
            {TIERS.map((t) => {
              const isSelected = selectedTier === t.id;
              return (
                <div
                  key={t.id}
                  className={`pi-tier-card ${
                    isSelected ? "pi-tier-selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedTier(t.id);
                    setCustomAmount("");
                  }}
                  style={{
                    borderColor: isSelected ? t.color : "transparent",
                  }}
                >
                  <div className="pi-tier-head">
                    <span className="pi-tier-icon">{t.icon}</span>
                    <div>
                      <h3 className="pi-tier-title">{t.name}</h3>
                      <p className="pi-tier-pts">+{t.bonusPts} pts bonus</p>
                    </div>
                  </div>
                  <div className="pi-tier-amount">{t.amount} π</div>
                </div>
              );
            })}

            {/* Custom Option */}
            <div
              className={`pi-tier-card ${
                selectedTier === "custom" ? "pi-tier-selected" : ""
              }`}
              onClick={() => setSelectedTier("custom")}
            >
              <div className="pi-tier-head">
                <span className="pi-tier-icon">✏️</span>
                <div>
                  <h3 className="pi-tier-title">Custom Amount</h3>
                  <p className="pi-tier-pts">+500 pts per 1 π</p>
                </div>
              </div>
              {selectedTier === "custom" ? (
                <input
                  type="number"
                  className="pi-input pi-custom-input"
                  placeholder="e.g. 0.5"
                  step="0.01"
                  min="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  autoFocus
                />
              ) : (
                <div className="pi-tier-amount">Custom</div>
              )}
            </div>
          </div>

          {/* Optional Display Name */}
          <div className="pi-mt">
            <label className="pi-muted" style={{ display: "block", marginBottom: 6 }}>
              Display Name for Leaderboard (optional):
            </label>
            <input
              type="text"
              className="pi-input"
              placeholder="e.g. @pioneer123 or Anonymous"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Feedback Message */}
          {msg && (
            <div
              className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}
              style={{ marginTop: 14 }}
            >
              {msg.text}
            </div>
          )}

          {/* Action Button */}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: 16 }}
            disabled={busy || finalAmount <= 0}
            onClick={handleDonate}
          >
            {busy ? (
              "Processing Pi Payment…"
            ) : (
              <>
                Donate {finalAmount > 0 ? `${finalAmount} π` : "Pi"} & Receive +
                {estimatedBonus} pts
              </>
            )}
          </button>
        </section>

        {/* Top Donors Leaderboard */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>🏆 Top Donors Leaderboard</h2>
            <span className="pi-badge pi-badge-accent">Hall of Fame</span>
          </div>

          {topDonors === undefined ? (
            <div className="pi-spinner" />
          ) : topDonors.length === 0 ? (
            <p className="pi-muted">
              No donations yet! Be the first Pioneer to support the platform.
            </p>
          ) : (
            <div className="pi-activity">
              {topDonors.map((d, index) => (
                <div key={d.userId} className="pi-activity-row">
                  <span
                    className="pi-rank-badge"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "#F59E0B"
                          : index === 1
                          ? "#94A3B8"
                          : index === 2
                          ? "#D97706"
                          : "rgba(255,255,255,0.1)",
                      color: index < 3 ? "#FFF" : "var(--pi-muted)",
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    #{index + 1}
                  </span>
                  <div className="pi-grow">
                    <p className="pi-card-title-sm">{d.displayName}</p>
                    <p className="pi-muted">
                      {d.count} donation{d.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="pi-num" style={{ color: "#10B981", fontWeight: 800 }}>
                    {d.totalPi} π
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Donations History */}
        <section className="pi-card pi-card-glass">
          <div className="pi-card-head">
            <h2>My Donations</h2>
          </div>

          {myDonations === undefined ? (
            <div className="pi-spinner" />
          ) : myDonations.length === 0 ? (
            <p className="pi-muted">You haven't made any donations yet.</p>
          ) : (
            <div className="pi-activity">
              {myDonations.map((item) => (
                <div key={item._id} className="pi-activity-row">
                  <span
                    className={`pi-delta ${
                      item.status === "completed"
                        ? "pi-delta-plus"
                        : "pi-delta-minus"
                    }`}
                  >
                    {item.amount} π
                  </span>
                  <div className="pi-grow">
                    <p className="pi-activity-reason">{item.memo}</p>
                    <p className="pi-muted">
                      {new Date(item._creationTime).toLocaleDateString()} ·{" "}
                      <span className={`pi-status ${item.status}`}>
                        {item.status}
                      </span>
                    </p>
                  </div>
                  {item.txid && (
                    <span className="pi-muted" title={item.txid}>
                      {item.txid.slice(0, 4)}…{item.txid.slice(-4)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
