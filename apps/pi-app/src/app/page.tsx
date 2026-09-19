"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { api } from "@convex/api";
import { PiSignIn } from "@/pi/components/PiSignIn";
import { IS_TELEGRAM_APP, getTelegramInitData } from "@/pi/telegram";

// /pi gate: show sign-in when signed out, send signed-in users to the dashboard.
export default function PiGate() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const bindTelegram = useAction(api.surfaces.bindTelegramSession);
  const [tgError, setTgError] = useState("");

  // Telegram: an already-signed-in session may still be bound to another
  // surface (persisted before binding worked) — prove we're in Telegram and
  // rebind it before showing balances, so the TG ledger is what's displayed.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const tgInit = IS_TELEGRAM_APP ? getTelegramInitData() : "";
    if (tgInit) {
      bindTelegram({ initData: tgInit })
        .catch(() => {})
        .finally(() => router.replace("/home"));
    } else {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, router, bindTelegram]);

  // Telegram Mini App: sign in silently with the signed initData.
  const initData = IS_TELEGRAM_APP ? getTelegramInitData() : "";
  useEffect(() => {
    if (!IS_TELEGRAM_APP || isLoading || isAuthenticated || !initData) return;
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    signIn("telegram", { initData }).catch((e) => setTgError(String(e).replace("[CONVEX] ", "")));
  }, [isLoading, isAuthenticated, initData, signIn]);

  if (IS_TELEGRAM_APP) {
    if (tgError) {
      return <div className="pi-centered"><div className="pi-card pi-blocked"><h1>Telegram sign-in failed</h1><p>{tgError}</p></div></div>;
    }
    if (!initData && !isLoading) {
      return (
        <div className="pi-centered">
          <div className="pi-card pi-blocked">
            <h1>Open in Telegram</h1>
            <p>This app runs inside Telegram. Open it from the View2Earn bot menu button.</p>
          </div>
        </div>
      );
    }
    return <div className="pi-centered"><div className="pi-spinner" /></div>;
  }

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
