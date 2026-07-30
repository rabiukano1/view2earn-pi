// Payout wallet address validation. Users provide only a public receiving
// address (no keys, no custody) — but a malformed address loses funds, so these
// run server-side before storing. Format checks, not on-chain existence.

// EVM (Ethereum, Sidra, BSC, …): 0x + 40 hex chars.
export function isEvmAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

// Solana: base58 (no 0, O, I, l), 32–44 chars.
export function isSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}
