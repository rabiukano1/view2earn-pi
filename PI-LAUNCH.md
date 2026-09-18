# Pi Network launch checklist (View2Earn)

Everything needed to get the Pi Browser app fully live: Mainnet app, paired
Testnet app, App Wallet, Ad Network, Convex secrets. Tick as you go.

Why two apps: Pi Developer Portal apps are locked to ONE network. The Mainnet
app is the real product. The Testnet app exists only to unlock the Mainnet
**App Wallet** ("paired Testnet app needs App-to-User transactions to 5 unique
wallets"). You must complete BOTH — the Testnet one is small.

Each Portal app has its OWN validation key, and Pi checks it at
`https://<host>/validation-key.txt` (domain root). Two apps therefore need two
hostnames — that is why Testnet domain verification failed on `pi.view2earn.org`.

| App | Network | URL | Cloudflare Pages project | Source |
|---|---|---|---|---|
| View2earn | Mainnet | `https://pi.view2earn.org` | `view2earn-pi` | `apps/pi-app` |
| View2earn Testnet | Testnet | `https://testnet.view2earn.org` | `view2earn-pi-testnet` | `apps/pi-testnet` |

---

## A. Mainnet app  (submitted — verify these stay true)

- [ ] Portal → app → App URL is exactly `https://pi.view2earn.org` (no `/`, no `www`)
- [ ] `https://pi.view2earn.org/validation-key.txt` returns the Mainnet app's key
      (file: `apps/pi-app/public/validation-key.txt`)
- [ ] Build is mainnet: `apps/pi-app/.env.production` has `NEXT_PUBLIC_PI_SANDBOX=false`
- [ ] Deployed: `npm run deploy -w @view2earn/pi-app`
- [ ] Convex has the **Mainnet** app's Server API key:
      `npx convex env set PI_API_KEY "<mainnet key>"`
- [ ] Sign in works inside Pi Browser
- [ ] Checklist "User-to-App payment": Donate page → 0.1 π tier, until the
      checklist counter is satisfied (Pi goes to the app wallet, not lost)

## B. Testnet app  (needed for the App Wallet)

1. Deploy the Testnet site (one time):
   ```
   cd D:\user\v2e\View2Earn
   npm install
   npm run deploy:setup -w @view2earn/pi-testnet
   npm run deploy -w @view2earn/pi-testnet
   ```
   Cloudflare dashboard → Workers & Pages → `view2earn-pi-testnet` →
   Custom domains → `testnet.view2earn.org` → Activate.
2. Pi Browser → `pi://develop.pinet.com` → the **Testnet** app (create one if
   missing: App Network = Testnet, pair it with the Mainnet app):
   - [ ] App URL = `https://testnet.view2earn.org`
   - [ ] Copy its **validation key** → paste into
         `apps/pi-testnet/public/validation-key.txt` → redeploy
         (`npm run deploy -w @view2earn/pi-testnet`) → Portal "Verify domain"
   - [ ] **Get API key** → save as `PI_TESTNET_API_KEY` (shell only, NOT Convex)
   - [ ] **App Wallet** → create the Testnet wallet in `wallet.pi`
         (switch wallet to Testnet; faucet gives 100 Test-Pi) → show secret key
         → save as `PI_TESTNET_WALLET_SEED` (shell only)
3. Collect 5 UIDs: 5 Pioneers (you count as one) open
   `https://testnet.view2earn.org` in Pi Browser → Sign in → send you the UID.
   Each must have opened `wallet.pi` on Testnet once (auto-creates a wallet).
4. Pay them (5 App-to-User Test-Pi payments):
   ```
   cd D:\user\v2e\View2Earn
   set PI_TESTNET_API_KEY=...
   set PI_TESTNET_WALLET_SEED=S...
   node scripts/testnet-a2u.js uid1 uid2 uid3 uid4 uid5
   ```
   Expect `OK <uid> payment=… tx=…` ×5.

## C. Mainnet App Wallet

- [ ] Portal → Mainnet app → App Checklist → **App Wallet → Apply**
      (form: reason for applying, Privacy `https://view2earn.org/privacy`,
      Terms `https://view2earn.org/terms`). The red "paired Testnet app needs
      A2U transactions to 5 unique wallets" line disappears after step B.4.
      1 π is deducted from your next migration as the wallet's minimum balance.
- [ ] When approved: in `wallet.pi` open the app wallet → show secret key →
      `npx convex env set PI_WALLET_PRIVATE_SEED "S..."`
      (this is what pays Pi withdrawals to users — must be the APP wallet)
- [ ] Send a few Pi to the app wallet for payouts + fees

## D. Pi Ad Network

- [ ] Portal → Mainnet app → **Dev Ad Network** → Ads Checklist (3 steps) →
      application form:
      - Ad types: Interstitial ✅ Rewarded ✅ Banner ☐
      - Other ad SDKs: **No** (Pi app uses Pi Ads only; CPX surveys removed)
      - ERC-20 payout address: an Ethereum-mainnet `0x…` you control
        (MetaMask / Trust / exchange ETH-ERC20 deposit). Not a Pi address.
      - Notes: rewards app; every rewarded adId verified via
        `/ads_network/status` before crediting.
- [ ] Until approved, `Pi.Ads.showAd("rewarded")` returns no `adId` and the app
      (correctly) pays nothing for ads.
- [ ] Optional after approval: Dev Ad Network → Settings → Enable Loading Banner Ads

## E. Mainnet ecosystem listing rules (keep the app compliant)

- Pi Auth only (no email/Telegram login in the Pi app) ✅
- Pi-only payments ✅
- No external redirects: Tasks = Fireside Forum only ✅; **Promote page still
  opens social links — restrict before/if reviewers flag it**
- Minimal data collection ✅
- Domain must not START with "pi": `pi.view2earn.org` is a subdomain of
  view2earn.org — if reviewers object, switch to `app.view2earn.org`
- Developer KYC complete

## F. Convex env (dev deployment `valuable-ostrich-597` = live users)

| Var | Value |
|---|---|
| `PI_API_KEY` | Mainnet app Server API key |
| `PI_WALLET_PRIVATE_SEED` | Mainnet APP wallet secret (after C) |
| `CLUBKONNECT_USER_ID` / `CLUBKONNECT_API_KEY` | airtime/data provider (set) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | Telegram app (set) |
| `ADSGRAM_REWARD_SECRET` | Adsgram Reward URL key (Telegram app) |

Check: `npx convex env list`

## Useful

- Official docs: https://github.com/pi-apps/pi-platform-docs (ads.md, platform_API.md, SDK_reference.md)
- Listing requirements: https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/mainnetListingRequirements/
- Live check mainnet build: `curl -s https://pi.view2earn.org/ | grep -c telegram-web-app` → must be `0`
