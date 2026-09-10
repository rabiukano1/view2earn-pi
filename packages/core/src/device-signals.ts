// Device fingerprint hashing (plan §7.9 Layer 2). The client collects raw
// hardware/browser signals; the server hashes an ordered subset into one
// compact fingerprint. Cloned apps on the SAME physical phone produce the same
// hardware signals → the same hash, which is how the clone-app attack is caught.

// FNV-1a 32-bit — small, dependency-free, deterministic. Not cryptographic; it
// only needs to cluster identical inputs, not resist attackers.
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Order matters — callers must pass parts in a stable order so the same device
// always hashes the same way.
export function compositeFingerprint(parts: (string | number | null | undefined)[]): string {
  return hashString(parts.map((p) => String(p ?? "")).join("|"));
}
