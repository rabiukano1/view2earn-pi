"use client";

import { useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/api";

const KEY = "v2e_admin_auth";

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

  const logout = () => {
    localStorage.removeItem(KEY);
    setAuthed(false);
    setPassword("");
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
      {children}
      <button className="logout-btn" onClick={logout} title="Sign out">
        Sign out
      </button>
    </>
  );
}
