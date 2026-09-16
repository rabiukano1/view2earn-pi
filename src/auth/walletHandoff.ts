// Holds a wallet sign-in nonce that arrived via deep link while the user was
// logged out. The logged-out and logged-in navigators are different trees, so
// the WalletAuth screen unmounts on login; AppNavigator reads this to open it
// again as the first screen of the signed-in tree.
let pendingNonce: string | null = null;

export function setPendingWalletNonce(nonce: string | null) {
  pendingNonce = nonce;
}

export function takePendingWalletNonce(): string | null {
  const n = pendingNonce;
  pendingNonce = null;
  return n;
}
