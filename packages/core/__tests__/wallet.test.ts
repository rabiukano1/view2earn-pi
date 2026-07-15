import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { recoverAddress, verifyPersonalSign, buildSignInMessage } from "../src/wallet";

function personalHash(message: string): Uint8Array {
  const msg = utf8ToBytes(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msg.length}`);
  const packed = new Uint8Array(prefix.length + msg.length);
  packed.set(prefix, 0);
  packed.set(msg, prefix.length);
  return keccak_256(packed);
}

function addressOf(priv: Uint8Array): string {
  const pub = secp256k1.getPublicKey(priv, false);
  return "0x" + bytesToHex(keccak_256(pub.subarray(1)).subarray(-20));
}

// Produce a wallet-style signature: r‖s‖v, v = 27/28.
function walletSign(message: string, priv: Uint8Array): string {
  const s = secp256k1.sign(personalHash(message), priv, { prehash: false, format: "recovered" });
  const parsed = secp256k1.Signature.fromBytes(s, "recovered");
  const out = new Uint8Array(65);
  out.set(parsed.toBytes("compact"), 0);
  out[64] = parsed.recovery + 27;
  return "0x" + bytesToHex(out);
}

describe("wallet SIWE verification", () => {
  const priv = secp256k1.utils.randomSecretKey();
  const address = addressOf(priv);
  const message = buildSignInMessage(address, "nonce-abc-123", 1_700_000_000_000);
  const sig = walletSign(message, priv);

  it("recovers the exact signer address", () => {
    expect(recoverAddress(message, sig)).toBe(address);
  });

  it("verifies a genuine signature", () => {
    expect(verifyPersonalSign(message, sig, address)).toBe(true);
  });

  it("rejects a signature checked against a different address", () => {
    const other = addressOf(secp256k1.utils.randomSecretKey());
    expect(verifyPersonalSign(message, sig, other)).toBe(false);
  });

  it("rejects a tampered message (replay/altered nonce)", () => {
    const forged = buildSignInMessage(address, "nonce-DIFFERENT", 1_700_000_000_000);
    expect(verifyPersonalSign(forged, sig, address)).toBe(false);
  });

  it("rejects a malformed signature without throwing", () => {
    expect(verifyPersonalSign(message, "0xdeadbeef", address)).toBe(false);
  });
});
