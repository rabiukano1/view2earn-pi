import { ConvexReactClient } from "convex/react";

// Shared Convex client for the Pi web app. The backend is the SAME Convex
// deployment as the mobile apps (plan §3: "Pi web app talks to the same
// Convex backend").
export const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});
