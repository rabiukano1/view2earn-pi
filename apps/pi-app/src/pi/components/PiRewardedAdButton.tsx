"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { showPiRewardedAd } from "@/pi/pi";

interface PiRewardedAdButtonProps {
  userId: Id<"users">;
  label?: string;
  sublabel?: string;
  bonusPoints?: number;
  onSuccess?: (newBalance: number) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function PiRewardedAdButton({
  userId,
  label = "Watch Pi Rewarded Ad",
  sublabel = "Earn instant bonus points by watching a short ad",
  bonusPoints = 50,
  onSuccess,
  style,
  className = "",
}: PiRewardedAdButtonProps) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const adConfig = useQuery(api.ads.getAdRewardConfig, userId ? { userId } : "skip");
  const rewardForAd = useMutation(api.ads.rewardForAd);

  const pointsToAward = adConfig?.rewardPoints ?? bonusPoints;

  const handleWatchAd = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);

    try {
      const ad = await showPiRewardedAd();
      if (ad.supported && ad.rewarded) {
        const newBal = await rewardForAd({
          userId,
          provider: ad.adId,
          adType: "pi_rewarded_ad",
          rewardAmount: pointsToAward,
        });
        setMsg({ ok: true, text: `🎉 Success! +${pointsToAward} PTS credited to your wallet.` });
        if (onSuccess) onSuccess(newBal);
      } else if (ad.supported) {
        setMsg({ ok: false, text: `Ad not completed: ${ad.reason}` });
      } else {
        // Fallback for dev / browser testing outside Pi Browser
        const newBal = await rewardForAd({
          userId,
          provider: "pi_ad_simulated",
          adType: "pi_rewarded_ad",
          rewardAmount: pointsToAward,
        });
        setMsg({ ok: true, text: `🎉 Bonus +${pointsToAward} PTS credited!` });
        if (onSuccess) onSuccess(newBal);
      }
    } catch (e) {
      setMsg({
        ok: false,
        text: String((e as Error)?.message ?? e).replace("[CONVEX] ", ""),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`pi-card pi-card-glass ${className}`} style={{ padding: 16, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🎬</span>
            <p className="pi-card-title-sm" style={{ fontSize: 15, margin: 0 }}>
              {label}
            </p>
            <span className="pi-badge pi-badge-accent" style={{ fontSize: 11, fontWeight: 800 }}>
              +{pointsToAward} PTS
            </span>
          </div>
          <p className="pi-muted" style={{ fontSize: 12, margin: 0 }}>
            {sublabel}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleWatchAd}
          disabled={busy}
          style={{ whiteSpace: "nowrap" }}
        >
          {busy ? "Loading Ad…" : `▶ Watch Ad (+${pointsToAward} PTS)`}
        </button>
      </div>

      {msg && (
        <div
          className={`pi-msg ${msg.ok ? "pi-msg-ok" : "pi-msg-err"}`}
          style={{ marginTop: 10, fontSize: 12, padding: "8px 12px" }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
