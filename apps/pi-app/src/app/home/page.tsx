"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

// Pi dashboard: balance, streak, progress + recent activity (plan §7.11b).
export default function PiHome() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const balance = useQuery(api.points.balance, userId ? { userId } : "skip");
  const streak = useQuery(api.streaks.getStreak, userId ? { userId } : "skip");
  const progress = useQuery(api.rewards.progressToNext, userId ? { userId } : "skip");
  const history = useQuery(api.points.history, userId ? { userId, limit: 10 } : "skip");
  const checkIn = useMutation(api.streaks.checkIn);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!me || !userId) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  const doCheckIn = async () => {
    try {
      await checkIn({ userId });
    } catch (e) {
      alert(String(e).replace("[CONVEX] ", ""));
    }
  };

  return (
    <div className="pi-page">
      <div className="pi-hero">
        <div>
          <p className="pi-kicker">PI NETWORK · PI BROWSER</p>
          <h1>Welcome, {me.name || me.username} 👋</h1>
          <p className="pi-hero-sub">Every follow, join and like earns points — redeem them for real rewards.</p>
        </div>
        <div className="pi-balance">
          <span className="pi-balance-label">POINTS BALANCE</span>
          <span className="pi-balance-value">{balance ?? "…"}</span>
        </div>
      </div>

      <div className="pi-grid">
        <section className="pi-card">
          <div className="pi-card-head">
            <h2>Daily streak</h2>
            {streak?.canCheckIn ? <span className="pi-badge pi-badge-live">OPEN</span> : null}
          </div>
          {streak ? (
            <>
              <div className="pi-streak-num">{streak.current}<small> day{streak.current === 1 ? "" : "s"}</small></div>
              <p className="pi-muted">Longest: {streak.longest} · Today's reward: {streak.todayReward} pts</p>
              <button
                className="btn btn-primary pi-full"
                onClick={doCheckIn}
                disabled={!streak.canCheckIn}>
                {streak.checkedInToday ? "Checked in today ✓" : "Check in now"}
              </button>
            </>
          ) : (
            <div className="pi-spinner" />
          )}
        </section>

        <section className="pi-card">
          <div className="pi-card-head"><h2>Next reward</h2></div>
          {progress ? (
            <>
              <div className="pi-progress-track">
                <div
                  className="pi-progress-fill"
                  style={{ width: `${progress.target ? Math.min(100, Math.round((progress.balance / progress.target.pointsPrice) * 100)) : 100}%` }}
                />
              </div>
              <p className="pi-muted">
                {progress.ready
                  ? `Ready! You can redeem ${progress.target?.name ?? "a reward"} now.`
                  : progress.target
                    ? `${progress.target.pointsPrice - progress.balance} pts to ${progress.target.name}`
                    : "No redeemable rewards yet."}
              </p>
            </>
          ) : (
            <div className="pi-spinner" />
          )}
        </section>
      </div>

      <section className="pi-card">
        <div className="pi-card-head">
          <h2>Recent activity</h2>
          <a className="pi-link-text" href="/tasks">Browse tasks →</a>
        </div>
        {history === undefined ? (
          <div className="pi-spinner" />
        ) : history.length === 0 ? (
          <p className="pi-muted">No activity yet — complete your first task to start earning.</p>
        ) : (
          <table className="pi-table">
            <tbody>
              {history.map((h) => (
                <tr key={h._id}>
                  <td className="pi-delta">{h.delta > 0 ? `+${h.delta}` : h.delta}</td>
                  <td>{h.reason}</td>
                  <td className="pi-muted">{new Date(h._creationTime).toLocaleDateString()}</td>
                  <td className="pi-num">Bal {h.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
