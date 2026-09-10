"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function PiLeaderboard() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me);
  const userId = (me?._id ?? null) as Id<"users"> | null;

  const top = useQuery(api.leaderboard.topEarners, {});
  const myRank = useQuery(api.leaderboard.myRank, userId ? { userId } : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  if (!userId) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-page pi-leaderboard">
      <div className="pi-page-head">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Leaderboard</h1>
          <p className="pi-muted">Top View2Earn point earners this week</p>
        </div>
        <Link className="pi-link-text" href="/home">
          ← Back
        </Link>
      </div>

      {/* User Rank Card */}
      {myRank && (
        <div
          className="pi-card pi-card-glass"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            marginBottom: 20,
            borderColor: "var(--accent)",
            background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(76,29,149,0.25))",
          }}
        >
          <div>
            <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
              Your Rank
            </span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
              #{myRank.rank ?? "Unranked"} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-3)" }}>of {myRank.total}</span>
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="pi-muted" style={{ fontSize: 12, display: "block" }}>
              Your Balance
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "var(--accent-2)" }}>
              {myRank.balance} PTS
            </span>
          </div>
        </div>
      )}

      {/* Top Earners List */}
      <section className="pi-card pi-card-glass" style={{ padding: 0, overflow: "hidden" }}>
        <div className="pi-card-head" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Weekly Standings</h2>
          <span className="pi-muted" style={{ fontSize: 12 }}>Top 20</span>
        </div>

        {top === undefined ? (
          <div className="pi-centered" style={{ padding: 40 }}>
            <div className="pi-spinner" />
          </div>
        ) : top.length === 0 ? (
          <p className="pi-muted" style={{ padding: 24, textAlign: "center" }}>
            No earners yet this week. Complete tasks to claim #1!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {top.map((item, index) => {
              const isMe = item._id === userId;
              return (
                <div
                  key={item._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderBottom: index < top.length - 1 ? "1px solid var(--border)" : "none",
                    backgroundColor: isMe ? "rgba(124, 58, 237, 0.12)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      fontSize: 18,
                      fontWeight: 900,
                      color: index < 3 ? "var(--accent)" : "var(--text-3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {index < 3 ? MEDAL[index] : `#${index + 1}`}
                  </span>
                  <div style={{ flex: 1, marginLeft: 12 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: isMe ? "var(--accent-2)" : "var(--text)" }}>
                      {item.username || "Pioneer User"} {isMe ? "(You)" : ""}
                    </p>
                    <span className="pi-muted" style={{ fontSize: 11 }}>
                      {item.ecosystem || "PI"} Network
                    </span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "var(--ok)" }}>
                    +{item.balance} PTS
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
