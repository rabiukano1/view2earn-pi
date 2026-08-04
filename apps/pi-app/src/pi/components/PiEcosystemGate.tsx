"use client";

import { useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { PiIncompleteResumer } from "@/pi/components/PiIncompleteResumer";
import type { ReactNode } from "react";

// The Pi web app is Pi-only (plan §2: "sidra-mobile contains ZERO Pi code" —
// and the Pi web app contains ZERO Sidra/VINTA code). Non-Pi accounts are
// blocked from every /pi route.
export function PiEcosystemGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();

  if (isLoading) {
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

  // Not signed in yet — the /pi gate shows the Pi sign-in card.
  if (!isAuthenticated || !me) return <>{children}</>;

  if (me.ecosystem !== "PI") {
    return (
      <div className="pi-centered">
        <div className="pi-card pi-blocked">
          <h1>Pi Network only</h1>
          <p>
            The Pi web app is for Pi Network accounts. This account is on{" "}
            {me.ecosystem === "SIDRA" ? "the Sidra Chain" : "another ecosystem"}.
            Use the Sidra mobile app instead.
          </p>
          <button className="btn btn-primary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Resolve any incomplete Pi purchase once a valid Pi session is present.
  return (
    <>
      <PiIncompleteResumer />
      {children}
    </>
  );
}
