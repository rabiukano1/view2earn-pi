"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { showPiRewardedAd } from "@/pi/pi";
import { PiSvgSpinWheel, TEN_WHEEL_PRIZES } from "@/pi/components/PiSvgSpinWheel";

const NUM_SECTORS = TEN_WHEEL_PRIZES.length;
const SECTOR_ANGLE = 360 / NUM_SECTORS; // 36°
const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;

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
  for (let i = 0; i < NUM_SECTORS; i++) {
    const d = Math.abs(TEN_WHEEL_PRIZES[i].pts - pts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

export default function PiSpin() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const status = useQuery(api.spin.getSpinStatus, userId ? { userId } : "skip");
  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const doSpin = useMutation(api.spin.spin);
  const earnBonusSpin = useMutation(api.spin.earnBonusSpin);
  const claimRewardedAd = useMutation(api.piAds.claimRewardedAd);
  const rewardForAd = useMutation(api.ads.rewardForAd);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const currentRotationRef = useRef(0);
  const [refillMs, setRefillMs] = useState(0);
  const [adBusy, setAdBusy] = useState(false);
  const [doubleAdBusy, setDoubleAdBusy] = useState(false);
  const [doubleClaimed, setDoubleClaimed] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
      1000
    );
    return () => clearInterval(interval);
  }, [refillActive]);

  if (!userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  const spinsRemaining = status?.spinsRemaining ?? 0;
  const adBonusRemaining = status?.adBonusRemaining ?? 0;
  const adBonusLimit = status?.adBonusLimit ?? 2;

  const disabled = spinning || spinsRemaining <= 0 || result !== null;
  const adDisabled = spinning || result !== null || adBusy || adBonusRemaining <= 0;

  const startSpin = async () => {
    if (spinning || result !== null) return;

    // If out of spins, trigger Pi Ad for extra spin directly
    if (spinsRemaining <= 0) {
      if (adBonusRemaining > 0) {
        handleWatchAdForSpin();
      } else {
        setMsg({ ok: false, text: "No spins remaining! Wait for daily refill." });
      }
      return;
    }

    setSpinning(true);
    setResult(null);
    setDoubleClaimed(false);
    setMsg(null);

    try {
      const { pts } = await doSpin({ userId });
      const targetIndex = indexForPts(pts);

      // Mathematically calculate exact rotation to align target 36° sector with top 12 o'clock pointer
      const targetSectorCenterAngle = targetIndex * SECTOR_ANGLE + SECTOR_ANGLE / 2;
      const targetAlignmentAngle = (360 - targetSectorCenterAngle) % 360;

      const fullRotations = 6 * 360;
      const currentMod = currentRotationRef.current % 360;
      const deltaAngle = (targetAlignmentAngle - currentMod + 360) % 360;
      const finalRotation = currentRotationRef.current + fullRotations + deltaAngle;

      currentRotationRef.current = finalRotation;
      setRotationDeg(finalRotation);

      window.setTimeout(() => {
        setResult(pts);
        setSpinning(false);
      }, 4050);
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error)?.message ?? e).replace("[CONVEX] ", "") });
      setSpinning(false);
    }
  };

  const handleWatchAdForSpin = async () => {
    if (adDisabled) return;
    setAdBusy(true);
    setMsg(null);
    try {
      const ad = await showPiRewardedAd();
      const isRewarded = ad.rewarded || ad.reason === "AD_REWARDED" || ad.reason === "REWARDED";

      if (isRewarded) {
        await claimRewardedAd({ userId, adId: ad.adId });
        setMsg({ ok: true, text: "🎉 Bonus spin earned! Tap SPIN on the wheel to play." });
      } else if (ad.supported) {
        const isClosed = ad.reason.includes("CLOSED") || ad.reason.includes("cancel");
        setMsg({
          ok: false,
          text: isClosed
            ? "Video closed early. Watch the full ad to earn your free spin."
            : `Ad not completed: ${ad.reason}`,
        });
      } else {
        await earnBonusSpin({ userId, amount: 1 });
        setMsg({ ok: true, text: "🎉 Bonus spin added to your balance!" });
      }
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error)?.message ?? e).replace("[CONVEX] ", "") });
    } finally {
      setAdBusy(false);
    }
  };

  const handleDoubleRewardAd = async () => {
    if (doubleAdBusy || doubleClaimed || result === null || result <= 0) return;
    setDoubleAdBusy(true);
    setMsg(null);
    try {
      const ad = await showPiRewardedAd();
      const isRewarded = ad.rewarded || ad.reason === "AD_REWARDED" || ad.reason === "REWARDED";

      if (isRewarded) {
        await rewardForAd({
          userId,
          provider: ad.adId,
          adType: "spin_double_bonus",
          rewardAmount: result,
        });
        setDoubleClaimed(true);
        setMsg({ ok: true, text: `🎉 Double Bonus! +${result} extra PTS added to your balance!` });
      } else if (ad.supported) {
        const isClosed = ad.reason.includes("CLOSED") || ad.reason.includes("cancel");
        setMsg({
          ok: false,
          text: isClosed
            ? "Video closed early. Watch the full ad to double your reward."
            : `Ad not completed: ${ad.reason}`,
        });
      } else {
        await rewardForAd({
          userId,
          provider: "pi_spin_double_simulated",
          adType: "spin_double_bonus",
          rewardAmount: result,
        });
        setDoubleClaimed(true);
        setMsg({ ok: true, text: `🎉 Double Bonus! +${result} extra PTS added to your balance!` });
      }
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error)?.message ?? e).replace("[CONVEX] ", "") });
    } finally {
      setDoubleAdBusy(false);
    }
  };

  return (
    <div className="pi-page pi-spin-screen-matching">
      {/* Header Bar matching Android */}
      <div className="pi-spin-header">
        <Link href="/home" className="pi-spin-back-btn" aria-label="Back to Home">
          ←
        </Link>
        <span className="pi-spin-header-title">Daily Challenge</span>
        <div className="pi-spin-total-win-pill">
          <span className="pi-muted" style={{ color: "#DDD6FE", fontSize: 12 }}>
            Total win:
          </span>
          <span style={{ fontSize: 13 }}>🪙</span>
          <span style={{ fontWeight: 900, color: "#FFF", fontSize: 14 }}>
            {balance === undefined ? "…" : balance}
          </span>
        </div>
      </div>

      {/* Step Indicators Bar (1 2 3 4 5 6 7) matching Android */}
      <div className="pi-spin-steps-bar">
        {[1, 2, 3, 4, 5, 6, 7].map((stepNum) => {
          const isDone = stepNum <= 2;
          const isCurrent = stepNum === 3;
          return (
            <div
              key={stepNum}
              className={`pi-spin-step-circle ${isDone ? "pi-spin-step-done" : ""} ${
                isCurrent ? "pi-spin-step-current" : ""
              }`}
            >
              {isDone ? "✓" : stepNum}
            </div>
          );
        })}
      </div>

      {/* Main Title Section */}
      <div className="pi-spin-title-section">
        <h1 className="pi-spin-main-title">SPIN THE WHEEL</h1>
        <p className="pi-spin-main-sub">Tap on wheel to earn points</p>
      </div>

      {/* Circular SVG Spin Wheel matching Android SvgSpinWheel */}
      <PiSvgSpinWheel
        size={320}
        spinning={spinning}
        disabled={disabled}
        rotationDeg={rotationDeg}
        onSpinPress={startSpin}
      />

      {/* Status & Timer Badges */}
      <div className="pi-spin-status-row" style={{ marginTop: 18 }}>
        <div className="pi-spin-badge-pill">
          <span>⚡</span>
          <span>{spinsRemaining} Spins Available</span>
        </div>
        {refillMs > 0 && (
          <div className="pi-spin-badge-pill pi-spin-badge-timer">
            <span>⏱️</span>
            <span>Refill: {formatTimer(refillMs)}</span>
          </div>
        )}
      </div>

      {/* Global Message Bar */}
      {msg && (
        <div
          className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}
          style={{ marginTop: 14, textAlign: "center" }}
        >
          {msg.text}
        </div>
      )}

      {/* Result Card or Action Buttons */}
      {result !== null ? (
        <div className="pi-card pi-spin-result-card" style={{ marginTop: 16 }}>
          <div className="pi-spin-trophy-icon">🏆</div>
          <p className="pi-spin-result-title">{result > 0 ? "YOU WON!" : "NO BONUS"}</p>
          <p className="pi-spin-result-pts">{result > 0 ? `+${result} PTS` : "TRY AGAIN"}</p>

          {/* Double Reward Pi Ad Button */}
          {result > 0 && !doubleClaimed && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDoubleRewardAd}
              disabled={doubleAdBusy}
              style={{
                width: "100%",
                marginTop: 10,
                backgroundColor: "rgba(245, 158, 11, 0.2)",
                borderColor: "#F59E0B",
                color: "#F59E0B",
                fontWeight: 800,
              }}
            >
              {doubleAdBusy ? "Loading video…" : `🎬 Double Reward (+${result} PTS)`}
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setResult(null)}
            style={{ width: "100%", marginTop: 12 }}
          >
            {spinsRemaining > 0 ? "SPIN AGAIN" : "CLAIM REWARD 🎉"}
          </button>
        </div>
      ) : (
        <div className="pi-spin-actions-matching" style={{ marginTop: 16 }}>
          {/* Main Tap Wheel / Spin Button with Pi Ad Fallback */}
          <button
            type="button"
            className={`pi-spin-main-btn ${disabled && spinsRemaining <= 0 ? "pi-spin-main-btn-ad" : ""}`}
            onClick={startSpin}
            disabled={spinning}
          >
            {spinning ? (
              <span className="pi-spinner pi-spinner-inline" />
            ) : spinsRemaining > 0 ? (
              <span>👆 TAP WHEEL TO SPIN ({spinsRemaining} LEFT)</span>
            ) : adBonusRemaining > 0 ? (
              <span>🎬 FREE +1 SPIN ({adBonusRemaining}/{adBonusLimit})</span>
            ) : (
              <span>OUT OF SPINS (REFILL IN {formatTimer(refillMs)})</span>
            )}
          </button>

          {/* Bonus Ad Button */}
          <button
            type="button"
            className={`pi-spin-bonus-ad-btn ${adDisabled ? "pi-spin-bonus-ad-off" : ""}`}
            onClick={handleWatchAdForSpin}
            disabled={adDisabled}
          >
            <span style={{ fontSize: 16 }}>🎬</span>
            <span>
              {adBonusRemaining > 0
                ? `Free Bonus Spin (${adBonusRemaining}/${adBonusLimit} left)`
                : "Daily bonus spin limit reached"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
