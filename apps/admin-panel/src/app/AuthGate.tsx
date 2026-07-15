"use client";

import { Component, useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/api";
import { PW_KEY } from "./useAdmin";

const KEY = "v2e_admin_auth";

// A rejected admin token throws "Unauthorized" from any admin.* query and would
// otherwise crash the whole panel. Catch that one error and bounce to login;
// let every other error surface so real bugs aren't swallowed.
class UnauthorizedBoundary extends Component<
  { onUnauthorized: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(error: Error) {
    if (String(error?.message ?? "").includes("Unauthorized")) return { failed: true };
    throw error;
  }
  componentDidCatch(error: Error) {
    if (String(error?.message ?? "").includes("Unauthorized")) this.props.onUnauthorized();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAuthed(localStorage.getItem(KEY) === "1");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ok = await convex.query(api.admin.checkPassword, { password });
      if (ok) {
        localStorage.setItem(KEY, "1");
        localStorage.setItem(PW_KEY, password);
        setAuthed(true);
      } else {
        setError("Incorrect password");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const logout = (msg = "") => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PW_KEY);
    setAuthed(false);
    setPassword("");
    setError(msg);
  };

  // Avoid a flash of the panel before the localStorage check runs.
  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="login-screen">
        <form className="login-card card" onSubmit={submit}>
          <div className="login-brand">View2Earn</div>
          <h1 className="login-title">Admin sign in</h1>
          <p className="login-sub">Enter the admin password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !password}>
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <UnauthorizedBoundary
        onUnauthorized={() => logout("Session expired or password changed — sign in again.")}
      >
        {children}
      </UnauthorizedBoundary>
      <button className="logout-btn" onClick={() => logout()} title="Sign out">
        Sign out
      </button>
    </>
  );
}
