import { isEvmAddress, isSolanaAddress } from "../src/wallet-address";

describe("wallet address validation", () => {
  it("accepts a valid EVM address", () => {
    expect(isEvmAddress("0x3d342410fd5e1ad6de130bb529f1cb6dba22a731")).toBe(true);
  });

  it("rejects bad EVM addresses", () => {
    expect(isEvmAddress("0x123")).toBe(false); // too short
    expect(isEvmAddress("3d342410fd5e1ad6de130bb529f1cb6dba22a731")).toBe(false); // no 0x
    expect(isEvmAddress("0xZZZ2410fd5e1ad6de130bb529f1cb6dba22a731")).toBe(false); // non-hex
    expect(isEvmAddress("")).toBe(false);
  });

  it("accepts valid Solana addresses", () => {
    expect(isSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
    expect(isSolanaAddress("4Nd1mYtowEbLp3aQ7Y8vT2Y3xU2r8hQ9y7wX6z1K2m3n")).toBe(true);
  });

  it("rejects bad Solana addresses", () => {
    expect(isSolanaAddress("0x3d342410fd5e1ad6de130bb529f1cb6dba22a731")).toBe(false); // 0/x not base58 start, has 0
    expect(isSolanaAddress("short")).toBe(false); // too short
    expect(isSolanaAddress("IIIl0O" + "1".repeat(30))).toBe(false); // contains disallowed 0,O,I,l
    expect(isSolanaAddress("")).toBe(false);
  });
});
