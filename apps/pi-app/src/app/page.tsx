"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "@convex-dev/auth/react";
import { PiSignIn } from "@/pi/components/PiSignIn";

// /pi gate: show sign-in when signed out, send signed-in users to the dashboard.
export default function PiGate() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/home");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="pi-centered">
        <div className="pi-spinner" />
      </div>
    );
  }

  return (
    <div className="pi-centered">
      <PiSignIn />
    </div>
  );
}
