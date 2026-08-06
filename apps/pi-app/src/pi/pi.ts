// Pi SDK helpers for the Pi Browser (plan §3 / §7.1). The SDK script is loaded
// from Pi's CDN and is only available when the page is served inside the Pi
// Browser (or running in Pi's sandbox). Everything here is client-only.
//
// Follows the OFFICIAL SDK (sdk.minepi.com) contract:
//   - await Pi.init({ version, sandbox }) before any other call
//   - Pi.authenticate(scopes, onIncompletePaymentFound)
//   - Pi.createPayment(paymentData, { onReadyForServerApproval,
//       onReadyForServerCompletion, onCancel, onError })  — callback-driven
"use client";

type PiUser = { uid: string; username?: string; wallet_address?: string };
export type PiAuthResult = {
  accessToken: string;
  user: PiUser;
};

export type PiPaymentData = {
  amount: number;
  memo: string;
  metadata?: Record<string, string>;
  uid?: string;
};

export type PiPaymentCallbacks = {
  // Phase I — server must POST /payments/{id}/approve using this id.
  onReadyForServerApproval: (paymentId: string) => void | Promise<void>;
  // Phase III — after the user submits the blockchain txn, server must
  // POST /payments/{id}/complete with the txid, THEN deliver the goods.
  onReadyForServerCompletion: (paymentId: string, txid: string) => void | Promise<void>;
  onCancel?: (paymentId: string) => void;
  onError?: (error: Error, payment?: unknown) => void;
};

declare global {
  interface Window {
    Pi?: {
      init: (opts: { version: string; sandbox: boolean }) => Promise<void>;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound?: (payment: unknown) => void,
      ) => Promise<PiAuthResult>;
      createPayment: (paymentData: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
    };
  }
}

const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
const DEFAULT_PI_SCOPES = ["username", "payments", "wallet_address"] as const;

// Sandbox vs mainnet. Controlled by env so the same build can run either way;
// defaults to sandbox (true) and flips off only when explicitly set to "false".
export function getPiSandbox(): boolean {
  if (typeof process === "undefined") return true;
  return process.env.NEXT_PUBLIC_PI_SANDBOX !== "false";
}

// Loads the Pi SDK exactly once. Resolves with the Pi global.
export function loadPiSdk(): Promise<NonNullable<Window["Pi"]>> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Pi SDK is browser-only"));
      return;
    }
    if (window.Pi) {
      resolve(window.Pi);
      return;
    }
    const existing = document.getElementById("pi-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () =>
        window.Pi ? resolve(window.Pi) : reject(new Error("Pi SDK failed to load")),
      );
      existing.addEventListener("error", () => reject(new Error("Pi SDK failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.id = "pi-sdk";
    s.src = PI_SDK_URL;
    s.async = true;
    s.onload = () => {
      if (window.Pi) resolve(window.Pi);
      else reject(new Error("Pi SDK failed to initialize"));
    };
    s.onerror = () => reject(new Error("Could not load Pi SDK"));
    document.head.appendChild(s);
  });
}

// Whether the Pi SDK can actually run on this page. Off-Pi-Browser it only
// works in sandbox mode so users can test locally.
export async function isPiBrowser(): Promise<boolean> {
  try {
    const Pi = await loadPiSdk();
    await Pi.init({ version: "2.0", sandbox: getPiSandbox() });
    return true;
  } catch {
    return false;
  }
}

// Initialize the SDK once (idempotent).
export async function initPi(sandbox = getPiSandbox()): Promise<NonNullable<Window["Pi"]>> {
  const Pi = await loadPiSdk();
  await Pi.init({ version: "2.0", sandbox });
  return Pi;
}

// Runs the Pi login flow (plan §7.1): requests the username + payments scopes
// and returns the access token. The backend verifies the token via /me before
// creating the account — never trust the client-sent uid alone.
export async function signInWithPi(
  onIncompletePaymentFound?: (payment: unknown) => void,
  sandbox = getPiSandbox(),
): Promise<PiAuthResult> {
  const Pi = await initPi(sandbox);
  return Pi.authenticate([...DEFAULT_PI_SCOPES], onIncompletePaymentFound);
}

// Reads the authenticated user's Pi wallet address. Uses the SAME scope set as
// sign-in: requesting a subset of already-granted scopes can make the Pi SDK
// hang instead of returning the cached auth, so we always re-request the full
// default set. A timeout keeps the caller from spinning forever.
export async function authenticatePiWallet(
  sandbox = getPiSandbox(),
): Promise<string | undefined> {
  const Pi = await initPi(sandbox);
  let res: PiAuthResult;
  try {
    res = await withTimeout(
      Pi.authenticate([...DEFAULT_PI_SCOPES], () => {
        // no incomplete-payment resume needed for a read-only address fetch
      }),
      30000,
    );
  } catch (e) {
    throw new Error(
      e instanceof TimeoutError
        ? "Pi didn't respond. Open the Pi authorization dialog and approve it."
        : `Pi wallet access failed: ${(e as Error)?.message ?? e}`,
    );
  }
  return res.user.wallet_address;
}

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError()), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

// Resumes a payment that was submitted to the blockchain but never completed
// server-side (fires from the authenticate() onIncompletePaymentFound callback).
// Routes it to the same completion handler as a normal onReadyForServerCompletion.
export async function resumeIncompletePayment(
  payment: unknown,
  complete: (paymentId: string, txid: string) => void | Promise<void>,
): Promise<void> {
  const p = payment as { identifier?: string; transaction?: { txid?: string } | null };
  if (p?.identifier && p.transaction?.txid) {
    await complete(p.identifier, p.transaction.txid);
  }
}

// Incomplete payments surface during authenticate() — before the session (and
// therefore the account's userId) exists. Stash them and let a post-auth
// component resolve them with the real userId.
export const PENDING_PI_KEY = "view2earn:pi:pending";
type StashedPiPayment = { paymentId?: string; txid?: string };

export function stashPendingPiPayment(payment: unknown): void {
  if (typeof window === "undefined") return;
  const p = payment as { identifier?: string; transaction?: { txid?: string } | null };
  if (!p?.identifier || !p.transaction?.txid) return;
  window.localStorage.setItem(
    PENDING_PI_KEY,
    JSON.stringify({ paymentId: p.identifier, txid: p.transaction.txid } as StashedPiPayment),
  );
}

export function popPendingPiPayment(): StashedPiPayment | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_PI_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PENDING_PI_KEY);
  try {
    return JSON.parse(raw) as StashedPiPayment;
  } catch {
    return null;
  }
}

// Initiates a Pi purchase (plan §7.8). Opens the Pi payment dialog and hands the
// paymentId/txid to the given handlers. The server must approve (Phase I) and
// complete + deliver (Phase III) — the top-up is ONLY triggered after the Pi
// blockchain transaction is confirmed.
export async function startPiPayment(
  data: PiPaymentData,
  callbacks: PiPaymentCallbacks,
  sandbox = getPiSandbox(),
): Promise<void> {
  const Pi = await initPi(sandbox);
  Pi.createPayment(data, {
    onReadyForServerApproval: (paymentId) => {
      callbacks.onReadyForServerApproval(paymentId);
    },
    onReadyForServerCompletion: (paymentId, txid) => {
      callbacks.onReadyForServerCompletion(paymentId, txid);
    },
    onCancel: (paymentId) => callbacks.onCancel?.(paymentId),
    onError: (error, payment) => callbacks.onError?.(error, payment),
  });
}