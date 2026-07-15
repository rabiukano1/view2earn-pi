"use client";

import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

// The admin password, stored at login by AuthGate. Sent as `token` on every
// admin.* call so the server (requireAdmin) can enforce auth — the UI gate alone
// doesn't stop direct calls.
export const PW_KEY = "v2e_admin_pw";
const pw = () =>
  typeof window === "undefined" ? "" : localStorage.getItem(PW_KEY) ?? "";

type Args<Ref> = Ref extends FunctionReference<any, any, infer A> ? A : never;
type Ret<Ref> = Ref extends FunctionReference<any, any, any, infer R> ? R : never;
// Everything the caller passes except the token we inject.
type Given<Ref> = Omit<Args<Ref>, "token">;

export function useAdminQuery<Ref extends FunctionReference<"query">>(
  ref: Ref,
  args?: Given<Ref> | "skip",
): Ret<Ref> | undefined {
  return useQuery(
    ref,
    (args === "skip" ? "skip" : { ...(args ?? {}), token: pw() }) as any,
  );
}

export function useAdminMutation<Ref extends FunctionReference<"mutation">>(
  ref: Ref,
): (args?: Given<Ref>) => Promise<Ret<Ref>> {
  const run = useMutation(ref);
  return (args?: Given<Ref>) => run({ ...(args ?? {}), token: pw() } as any);
}
