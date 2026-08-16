"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { api } from "@convex/api";
import { signInWithPi, isPiBrowser } from "@/pi/pi";

// Android → Pi Browser account linking (plan §7.1). The Android app deep-links
// here with a one-time token: pi://pi.view2earn.org/link?token=<t>. After the
// user authenticates with Pi, the token + verified Pi identity are exchanged
// server-side to promote the Android user to the Pi economy. This page creates
// NO Pi web session — it only completes the link.
function cleanErrorMessage(raw: string): string {
  let msg = raw.replace(/^\[CONVEX\s*[^\]]*\]\s*/i, "");
  if (msg.includes("Uncaught Error:")) {
    const parts = msg.split("Uncaught Error:");
    msg = parts[parts.length - 1].split("\n")[0].split(" at ")[0].trim();
  }
  return msg || "An error occurred during verification.";
}

function LinkCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const completeLink = useAction(api.piLink.completeLink);
  const { signIn } = useAuthActions();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>("");
  const [inPi, setInPi] = useState<boolean | null>(null);

  useEffect(() => {
    isPiBrowser().then(setInPi).catch(() => setInPi(false));
  }, []);

  const handleLink = async () => {
    if (!token) {
      setError("Missing link token. Return to the app and tap 'Open Pi Browser to verify' again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await signInWithPi();
      await completeLink({
        token,
        accessToken: res.accessToken,
        uid: res.user.uid,
        ...(res.user.wallet_address ? { walletAddress: res.user.wallet_address } : {}),
        ...(res.user.username ? { piUsername: res.user.username } : {}),
      });
      await signIn("pi", { accessToken: res.accessToken, uid: res.user.uid });
      setDone(true);
    } catch (e) {
      setError(cleanErrorMessage(String((e as Error)?.message ?? e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pi-centered">
      <div className="pi-card pi-signin" style={{ maxWidth: 400 }}>
        <Link href="/" className="pi-logo" aria-label="Go home">
          <img
            src="/logo.png"
            alt="View2Earn Logo"
            width={64}
            height={64}
            style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "18px" }}
          />
        </Link>

        {done ? (
          <>
            <h1 className="pi-title">Pi linked ✓</h1>
            <p className="pi-sub">
              Your account is now verified on the Pi economy. Return to the app — rewards are
              unlocked.
            </p>
          </>
        ) : (
          <>
            <h1 className="pi-title">Verify with Pi</h1>
            <p className="pi-sub">
              {inPi === false
                ? "You're not in the Pi Browser. Open this link inside the Pi Browser to verify."
                : "Authenticate with your Pi Network account to link it to your rewards balance."}
            </p>
            {error ? <div className="pi-error">{error}</div> : null}
            <button
              className="btn btn-primary btn-lg pi-btn"
              onClick={handleLink}
              disabled={busy || inPi === false}>
              {busy ? "Waiting for Pi…" : "Verify with Pi"}
            </button>
            {inPi === false ? (
              <p className="pi-hint">Off-Pi-Browser linking requires sandbox mode on the Pi side.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function LinkPage() {
  return (
    <Suspense fallback={<div className="pi-centered"><div className="pi-spinner" /></div>}>
      <LinkCard />
    </Suspense>
  );
}