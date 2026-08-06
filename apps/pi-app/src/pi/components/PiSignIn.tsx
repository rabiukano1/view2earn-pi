"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { signInWithPi, isPiBrowser, stashPendingPiPayment } from "@/pi/pi";

// Pi Browser sign-in card (plan §7.1). Runs the Pi SDK authenticate() flow,
// then hands the access token + uid to the backend "pi" Convex Auth provider,
// which verifies the token against Pi's API before creating the account.
export function PiSignIn() {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [inPi, setInPi] = useState<boolean | null>(null);

  useEffect(() => {
    isPiBrowser()
      .then(setInPi)
      .catch(() => setInPi(false));
  }, []);

  const handleSignIn = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await signInWithPi((payment) => {
        // A previously-approved Pi payment was signed but never completed
        // server-side. Stash it; the post-auth PiIncompleteResumer resolves it
        // with the real account once the session is known.
        stashPendingPiPayment(payment);
      });
      await signIn("pi", {
        accessToken: res.accessToken,
        uid: res.user.uid,
        ...(res.user.wallet_address ? { walletAddress: res.user.wallet_address } : {}),
      });
    } catch (e) {
      setError(String((e as Error)?.message ?? e).replace("[CONVEX] ", ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-card pi-signin">
      <div className="pi-logo" aria-hidden>
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 7v10M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="pi-title">Sign in with Pi</h1>
      <p className="pi-sub">
        {inPi === false
          ? "You're not in the Pi Browser. Open this app inside the Pi Browser to sign in with your Pi identity."
          : "Continue with your Pi Network account to start earning points for every engagement."}
      </p>
      {error ? <div className="pi-error">{error}</div> : null}
      <button
        className="btn btn-primary btn-lg pi-btn"
        onClick={handleSignIn}
        disabled={busy || inPi === false}>
        {busy ? "Waiting for Pi…" : "Sign in with Pi"}
      </button>
      {inPi === false ? (
        <p className="pi-hint">Off-Pi-Browser sign-in requires sandbox mode on the Pi side.</p>
      ) : null}
    </div>
  );
}
