"use client";

import { useEffect, useState } from "react";

// In-app toast and action sheet, in place of window.alert / window.confirm.
// A browser dialog inside Pi Browser is titled "pi.view2earn.org says…" and
// inside Telegram it is a plain web alert — the loudest possible reminder that
// you are looking at a web page rather than using an app. These two functions
// are imperative on purpose so the call sites stay one-liners.

type Kind = "info" | "error";
type Toast = { id: number; text: string; kind: Kind };
type Ask = { text: string; resolve: (ok: boolean) => void };

let pushToast: ((t: Toast) => void) | null = null;
let pushAsk: ((a: Ask) => void) | null = null;
let nextId = 1;

function haptic(style: "light" | "medium" | "rigid") {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {
    /* not in Telegram, or an older client */
  }
}

/** Fire-and-forget message. Falls back to alert() if no Toaster is mounted. */
export function toast(text: string, kind: Kind = "info") {
  const msg = String(text).replace("[CONVEX] ", "").trim() || "Something went wrong";
  if (!pushToast) {
    alert(msg);
    return;
  }
  haptic(kind === "error" ? "rigid" : "light");
  pushToast({ id: nextId++, text: msg, kind });
}

/** Bottom sheet in place of window.confirm. Resolves false if dismissed. */
export function askConfirm(text: string): Promise<boolean> {
  if (!pushAsk) return Promise.resolve(confirm(text));
  haptic("medium");
  return new Promise<boolean>((resolve) => pushAsk!({ text, resolve }));
}

export function PiToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    pushToast = (t) => {
      setToasts((xs) => [...xs, t]);
      setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 3600);
    };
    // A second question while one is open answers the first with "no" rather
    // than leaving its promise pending forever.
    pushAsk = (a) =>
      setAsk((prev) => {
        if (prev) prev.resolve(false);
        return a;
      });
    return () => {
      pushToast = null;
      pushAsk = null;
    };
  }, []);

  const answer = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  return (
    <>
      <div className="pi-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pi-toast${t.kind === "error" ? " pi-toast-bad" : ""}`}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.text}
          </div>
        ))}
      </div>

      {ask ? (
        <div className="pi-sheet-wrap" role="dialog" aria-modal="true">
          <button
            type="button"
            className="pi-sheet-scrim"
            aria-label="Dismiss"
            onClick={() => answer(false)}
          />
          <div className="pi-sheet">
            <span className="pi-sheet-grip" aria-hidden />
            <p className="pi-sheet-text">{ask.text}</p>
            <button type="button" className="pi-sheet-ok" onClick={() => answer(true)}>
              Confirm
            </button>
            <button type="button" className="pi-sheet-cancel" onClick={() => answer(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
