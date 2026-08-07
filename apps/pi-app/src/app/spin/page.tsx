"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { SPIN_PRIZES } from "@view2earn/core";
import type { Id } from "@convex/dataModel";
import { showPiRewardedAd } from "../../pi/pi";

const LEN = SPIN_PRIZES.length;
const LOOPS = 6;
const TILE_H = 60;
const TILE_MARGIN = 7;
const TILE_STEP = TILE_H + TILE_MARGIN * 2;
const REEL_H = 212;
const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;

const PALETTE = [
  ["#7c3aed", "#4c1d95"],
  ["#ec4899", "#9d174d"],
  ["#f59e0b", "#b45309"],
  ["#10b981", "#047857"],
  ["#3b82f6", "#1d4ed8"],
  ["#f43f5e", "#be123c"],
];

const STRIP = Array.from(
  { length: (LOOPS + 2) * LEN },
  (_, i) => SPIN_PRIZES[i % LEN],
);

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function indexForPts(pts: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < LEN; i++) {
    const d = Math.abs(SPIN_PRIZES[i].pts - pts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

// Web equivalent of React Native's Easing.out(cubic) for the reel settle.
const CUBIC_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";

export default function PiSpin() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const status = useQuery(api.spin.getSpinStatus, userId ? { userId } : "skip");
  const doSpin = useMutation(api.spin.spin);
  const earnBonusSpin = useMutation(api.spin.earnBonusSpin);
  const claimRewardedAd = useMutation(api.piAds.claimRewardedAd);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [reelY, setReelY] = useState(0);
  const [reelAnim, setReelAnim] = useState("none");
  const [refillMs, setRefillMs] = useState(0);
  const [adBusy, setAdBusy] = useState(false);
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (status?.nextRefillMs !== undefined) setRefillMs(status.nextRefillMs);
  }, [status?.nextRefillMs]);

  const refillActive = refillMs > 0;

  useEffect(() => {
    if (!refillActive) return;
    const interval = setInterval(
      () => setRefillMs((prev) => Math.max(0, prev - 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [refillActive]);

  if (!userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const spinsRemaining = status?.spinsRemaining ?? 0;
  const baseSpinsRemaining = status?.baseSpinsRemaining ?? 0;
  const bonusSpins = status?.bonusSpins ?? 0;
  const adBonusRemaining = status?.adBonusRemaining ?? 0;
  const adBonusLimit = status?.adBonusLimit ?? 2;
  const windowTotalMs = status?.windowTotalMs ?? DEFAULT_WINDOW_MS;
  const refillProgress = Math.min(1, Math.max(0, 1 - refillMs / windowTotalMs));

  const disabled = spinning || spinsRemaining <= 0 || result !== null;
  const adDisabled = spinning || result !== null || adBusy || adBonusRemaining <= 0;

  const startSpin = async () => {
    if (disabled) return;
    setSpinning(true);
    setResult(null);
    try {
      const { pts } = await doSpin({ userId });
      const target = indexForPts(pts);
      targetRef.current = target;
      // Start from the top of the visible window, then settle on the tile.
      const startY = (REEL_H - TILE_H) / 2;
      const destY = startY - (LOOPS * LEN + target) * TILE_STEP;
      setReelY(startY);
      // Force a reflow so the transition runs from startY.
      requestAnimationFrame(() => {
        setReelAnim(`translateY(${destY}px) ${3.6}s ${CUBIC_OUT}`);
        setReelY(destY);
      });
      window.setTimeout(() => {
        setResult(pts);
        setSpinning(false);
      }, 3650);
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
      setSpinning(false);
    }
  };

  const handleAdSuccess = async () => {
    setAdBusy(true);
    try {
      // Run the real Pi rewarded-ad flow in the Pi Browser. When the ad
      // network is unavailable (e.g. dev outside Pi Browser), fall back to a
      // direct grant so the flow stays testable.
      const ad = await showPiRewardedAd();
      if (ad.supported && ad.rewarded) {
        await claimRewardedAd({ userId, adId: ad.adId });
      } else if (ad.supported) {
        throw new Error(`Ad not completed — ${ad.reason}`);
      } else {
        await earnBonusSpin({ userId, amount: 1 });
      }
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    } finally {
      setAdBusy(false);
    }
  };

  return (
    <div className="pi-page pi-spin">
      <div className="pi-page-head pi-spin-head">
        <div>
          <h1>SPIN &amp; WIN</h1>
          <p className="pi-muted">Lucky wheel · win up to 500 PTS</p>
        </div>
        <Link className="pi-link-text" href="/home">← Back</Link>
      </div>

      {/* Status card + refill progress */}
      <div className="pi-spin-status">
        <div className="pi-stat-cell">
          <span className="pi-stat-value">{baseSpinsRemaining}</span>
          <span className="pi-stat-label">Base spins</span>
        </div>
        <div className="pi-stat-divider" />
        <div className="pi-stat-cell">
          <span className={`pi-stat-value ${bonusSpins === 0 ? "pi-stat-dim" : ""}`}>{bonusSpins}</span>
          <span className="pi-stat-label">Extra spins</span>
        </div>
        <div className="pi-stat-divider" />
        <div className="pi-stat-cell">
          <span className="pi-stat-value">{formatTimer(refillMs)}</span>
          <span className="pi-stat-label">Next refill</span>
        </div>
      </div>
      <div className="pi-refill-track">
        <div className="pi-refill-fill" style={{ width: `${refillProgress * 100}%` }} />
      </div>

      {/* Reel window */}
      <div className="pi-reel-card">
        <div className="pi-reel-window">
          <div
            className="pi-reel"
            style={{ transform: reelAnim === "none" ? `translateY(${reelY}px)` : reelAnim }}>
            {STRIP.map((p, i) => {
              const c = PALETTE[i % PALETTE.length];
              return (
                <div key={i} className="pi-reel-tile" style={{ backgroundColor: c[1], borderColor: c[0] }}>
                  <span className="pi-reel-accent" style={{ backgroundColor: c[0] }} />
                  <span className="pi-reel-pts">{p.pts}</span>
                  <span className="pi-reel-badge">PTS</span>
                </div>
              );
            })}
          </div>
          <div className="pi-reel-center" />
          <div className="pi-reel-fade pi-reel-fade-top" />
          <div className="pi-reel-fade pi-reel-fade-bottom" />
        </div>

        {/* Prize pool preview */}
        <div className="pi-prize-chips">
          {SPIN_PRIZES.map((p, i) => (
            <span
              key={p.pts}
              className="pi-prize-chip"
              style={{ borderColor: PALETTE[i % PALETTE.length][0], color: PALETTE[i % PALETTE.length][0] }}>
              {p.pts}
            </span>
          ))}
        </div>
      </div>

      {/* Result or actions */}
      {result !== null ? (
        <div className="pi-result-card">
          <span className="pi-result-trophy">🏆</span>
          <p className="pi-result-title">YOU WON</p>
          <p className="pi-result-pts">+{result} PTS</p>
          <button className="btn btn-secondary pi-result-btn" onClick={() => setResult(null)}>
            {spinsRemaining > 0 ? "SPIN AGAIN" : "DONE"}
          </button>
        </div>
      ) : (
        <div className="pi-spin-actions">
          <button className="pi-spin-btn" onClick={startSpin} disabled={disabled}>
            {spinning ? (
              <span className="pi-spinner pi-spinner-inline" />
            ) : (
              <span className="pi-spin-btn-label">
                {spinsRemaining > 0 ? `SPIN — ${spinsRemaining} LEFT` : "OUT OF SPINS"}
              </span>
            )}
          </button>
          <button
            className={`pi-ad-card ${adDisabled ? "pi-ad-card-off" : ""}`}
            onClick={handleAdSuccess}
            disabled={adDisabled}>
            {adBonusRemaining > 0
              ? `Watch ad for +1 spin (${adBonusRemaining}/${adBonusLimit})`
              : "Bonus spin limit reached"}
          </button>
        </div>
      )}
    </div>
  );
}
