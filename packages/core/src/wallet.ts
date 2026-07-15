// Sign-In With Ethereum (SIWE) verification, plan §7.1 identity via web3 wallet.
// The wallet signs a server-issued message (EIP-191 personal_sign); the server
// recovers the signer address from the signature and checks it matches. Pure
// crypto (no keys, no network) via audited @noble libs — server-only.

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

// EIP-191 personal_sign digest: keccak256("\x19Ethereum Signed Message:\n" + len + msg).
function personalHash(message: string): Uint8Array {
  const msg = utf8ToBytes(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msg.length}`);
  const packed = new Uint8Array(prefix.length + msg.length);
  packed.set(prefix, 0);
  packed.set(msg, prefix.length);
  return keccak_256(packed);
}

// Recover the signer's lowercased 0x address from an EIP-191 signature
// (65 bytes: r‖s‖v, v = 27/28 as wallets produce).
export function recoverAddress(message: string, signatureHex: string): string {
  const sig = hexToBytes(signatureHex.replace(/^0x/, ""));
  if (sig.length !== 65) throw new Error("Signature must be 65 bytes");
  const v = sig[64];
  const recovery = v >= 27 ? v - 27 : v;
  if (recovery !== 0 && recovery !== 1) throw new Error("Invalid signature recovery byte");
  const signature = secp256k1.Signature.fromBytes(sig.subarray(0, 64), "compact").addRecoveryBit(
    recovery,
  );
  const pub = signature.recoverPublicKey(personalHash(message)).toBytes(false); // uncompressed
  return "0x" + bytesToHex(keccak_256(pub.subarray(1)).subarray(-20));
}

export function verifyPersonalSign(
  message: string,
  signatureHex: string,
  expectedAddress: string,
): boolean {
  try {
    return recoverAddress(message, signatureHex) === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

// The exact message the wallet is asked to sign. The server stores this and
// verifies the signature over it — never trust a client-supplied message.
export function buildSignInMessage(address: string, nonce: string, issuedAt: number): string {
  return [
    "View2Earn wants you to sign in with your wallet.",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
  ].join("\n");
}
