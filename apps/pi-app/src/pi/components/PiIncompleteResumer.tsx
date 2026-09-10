"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { popPendingPiPayment } from "@/pi/pi";

// Resolves incomplete Pi payments that were signed on-chain but never completed
// server-side (plan §7.8). Pi surfaces these during authenticate(), before the
// account's userId exists — they are stashed in localStorage and drained here
// once a signed-in session is known.
export function PiIncompleteResumer() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const completePi = useMutation(api.piPayments.completePiRedemption);
  const doneRef = useRef(false);

  const userId = typeof me?._id === "string" ? me._id : null;

  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId || doneRef.current) return;
    doneRef.current = true;
    const pending = popPendingPiPayment();
    if (!pending?.paymentId || !pending.txid) return;
    completePi({ userId, paymentId: pending.paymentId, txid: pending.txid }).catch(() => {
      // Best-effort completion; the client will be retried on next purchase via
      // onReadyForServerCompletion. No user-facing action is safe post-error.
    });
  }, [isLoading, isAuthenticated, userId, completePi]);

  return null;
}