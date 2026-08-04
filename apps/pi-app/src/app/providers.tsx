"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convex } from "@/pi/convex";
import { PiAppShell } from "@/pi/components/PiAppShell";
import { PiEcosystemGate } from "@/pi/components/PiEcosystemGate";
import type { ReactNode } from "react";

// Client providers for the Pi web app. ConvexAuthProvider gives every route a
// real Convex Auth session so existing requireUser-protected functions work
// unchanged. PiEcosystemGate keeps non-Pi accounts (Sidra/VINTA) out entirely.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <PiEcosystemGate>
        <PiAppShell>{children}</PiAppShell>
      </PiEcosystemGate>
    </ConvexAuthProvider>
  );
}