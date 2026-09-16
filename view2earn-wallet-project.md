# View2Earn Wallet — Multi-Token Data & Airtime Payments

## 1. Overview

The View2Earn Wallet is a points-based payment system for buying airtime and data bundles. It accepts deposits in multiple blockchain tokens and fiat, converts them into internal points, and lets users spend those points on airtime/data or withdraw them back out as any supported token.

The wallet is a feature of View2Earn but is **not restricted to View2Earn users** — anyone can fund the wallet and buy data/airtime, whether or not they've ever used the View2Earn rewards platform.

**Core rule:** the platform never stores or requests a user's private key or bank account details. Deposits and withdrawals move through the user's own wallets/bank apps; the platform never touches user-held credentials.

## 2. Two User Populations

### A. Migrated View2Earn users (eligible accounts)
- Already have a points balance earned from social tasks, quizzes, and offerwall surveys on View2Earn
- Need a **migration path** to move their existing View2Earn points balance into the new wallet's points ledger
- "Eligible" implies a filter — likely: verified account, no pending fraud flags, minimum activity threshold (to be defined)
- Migration should be a one-time, auditable ledger event, not a silent balance copy

### B. New/general wallet users
- Never used View2Earn; sign up directly for the wallet
- Fund their points balance only via direct deposit (crypto or fiat) — no rewards-earned points
- Same points ledger, same spend/withdraw flows as migrated users

Both populations share **one unified points ledger and balance system** — the distinction is only in *how points got there* (earned vs. deposited vs. migrated), which should be tagged per ledger entry for reporting and fraud review.

## 3. Supported Value In/Out

**Tokens accepted for deposit and withdrawal:**
- Pi (Pi Network)
- Sidra (Sidra Chain)
- Ethereum (ETH)
- Core
- BNB
- Solana (SOL)
- A stablecoin available across all of the above chains (e.g. USDT/USDC) for price stability

**Fiat:** accepted via a payment gateway (e.g. Paystack/Flutterwave) — gateway handles all bank/card data; platform never stores it.

## 4. Migration Requirements

- [ ] Define "eligible" criteria for existing View2Earn accounts (e.g. verified identity anchor, no active fraud flag, minimum point balance)
- [ ] One-time migration ledger entry per eligible account: `source: view2earn_migration`
- [ ] Migrated balance should be visible to the user before/after migration (transparency, avoid support tickets)
- [ ] Decide whether migration is automatic (batch job) or user-initiated (user taps "Migrate my points")
- [ ] Keep View2Earn's existing rule in mind: View2Earn v1 currently disallows points-for-coin withdrawal — confirm whether that restriction still applies post-migration, or whether the wallet supersedes it for migrated points

## 5. Core Flows

### Deposit (crypto → points)
1. User sends token to platform's custodial address for that chain (shared address + memo, or per-user address)
2. Watcher service detects and confirms the transaction on-chain
3. Live price lookup converts token amount to points
4. Ledger entry created, user's points balance credited

### Deposit (fiat → points)
1. User pays via payment gateway
2. Gateway webhook confirms payment
3. Points credited via ledger entry

### Spend (points → airtime/data)
1. User selects network + amount
2. Points deducted via ledger entry
3. VTU/airtime API (e.g. Reloadly, VTpass) fulfills the purchase

### Withdraw (points → any supported token)
1. User selects token, amount, and their own destination wallet address
2. Points deducted via ledger entry
3. Withdrawal queued; larger amounts require manual/admin approval
4. Payout service sends from platform's custodial hot wallet for that chain

## 6. Security Principles

- Platform never stores or requests user private keys or bank account details
- Hot wallets hold small operating balances only; bulk funds held in cold/multisig storage
- Daily withdrawal limits per user; manual approval above a threshold
- Reuse View2Earn's existing anti-fraud layers (device fingerprinting, one-account-per-identity anchor) for wallet accounts too
- Every deposit/withdrawal logged with transaction hash for audit

## 7. Open Questions (to resolve before build)

- Exact eligibility criteria for View2Earn migration
- Whether migrated points carry the "no coin withdrawal" restriction from View2Earn v1
- Per-user deposit addresses vs. shared address + memo (cost/complexity tradeoff)
- Which fiat payment gateway (Paystack vs. Flutterwave) and which VTU provider
- Withdrawal approval threshold and process (manual admin vs. automated risk scoring)

## 8. Build Order

1. Unified points ledger + balance API (shared across migrated and new users)
2. View2Earn migration job (batch or user-triggered)
3. One deposit chain end-to-end (watcher → convert → credit)
4. Airtime/data spend integration
5. Withdrawal flow for that same chain, with approval threshold
6. Add remaining chains one at a time
7. Fiat on-ramp via payment gateway
