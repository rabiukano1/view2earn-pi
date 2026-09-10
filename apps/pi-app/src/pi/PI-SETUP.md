# Pi Integration Setup Guide

How to take the Pi Browser app from sandbox to **real mainnet** purchases, wired
to real VAS (airtime/data) providers. Code in this folder already implements the
official Pi SDK + Platform API flows; this guide is what you must configure in
the Pi Developer Portal and as environment variables.

## 1. Pi Developer Portal (in Pi Browser)

Open `pi://develop.pinet.com` inside the Pi Browser.

1. **Register the app.** From the Developer Portal home, choose "Quick Start" →
   "Pi Apps" or add a new web app. Enter the app's name. You get an **App ID**.
2. **Configure the Development URL** for sandbox testing (e.g. `http://localhost:3000`).
   A **Sandbox URL** is generated — open it in a desktop browser, then in the Pi
   mobile app go to **Pi Utilities → Authorize Sandbox** and enter the code.
3. **Add the Production URL** (`https://view2earn.org/pi` or your deployed domain)
   before going live on Mainnet.
4. **Generate a Server API Key.** Tap "Get API key" and **save it immediately** —
   it is only shown once. This is `PI_API_KEY`, a production secret.
5. In the app's checklist you'll find the Sandbox URL and Mainnet launch gate.

Your App ID is not needed by the customer SDK (that API was deprecated in favor
of the Dev Portal key); the SDK only needs the script tag + version/sandbox flag.

## 2. SDK script + login (already implemented)

- `apps/website/src/pi/pi.ts`
  - loads `https://sdk.minepi.com/pi-sdk.js` (required in every Pi app)
  - `await Pi.init({ version: "2.0", sandbox })` before any call
  - `Pi.authenticate(["username", "payments"], onIncompletePaymentFound)`
  - `Pi.createPayment(paymentData, { onReadyForServerApproval,
      onReadyForServerCompletion, onCancel, onError })`
- `apps/website/src/convex` → backend `convex/PiProvider.ts` + `convex/piAuth.ts`
  verify the access token via `GET https://api.minepi.com/v2/me` before creating
  the account. **Never trust a client-sent uid.**

## 3. Environment variables

### Convex backend (`npx convex env set …` on the live deployment)
| Variable | Purpose |
| -------- | ------- |
| `PI_API_KEY` | Pi Server API Key (from Developer Portal). Used for `/approve`, `/complete`, `/cancel`. |
| `CLUBKONNECT_USER_ID` | ClubKonnect / Nello Byte account user ID (placed first in the VAS pipeline). |
| `CLUBKONNECT_API_KEY` | ClubKonnect API key. |
| `RELOADLY_CLIENT_ID` | Reloadly OAuth client id. |
| `RELOADLY_CLIENT_SECRET` | Reloadly OAuth client secret. |
| `RELOADLY_SANDBOX` | set to `"false"` for live Reloadly; any other value = sandbox. |

Behavior: if `CLUBKONNECT_*` are set they are used first; otherwise Reloadly is
used; if **neither** is configured, VAS runs in **dev-sandbox simulate** mode
(`mock-vas-*` provider refs — no real top-up).

### Website build (`apps/website/.env.local`)
| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://valuable-ostrich-597.convex.cloud` |
| `NEXT_PUBLIC_PI_SANDBOX` | `"false"` for mainnet; unset/`"true"` for sandbox development. |

## 4. Payment flow (already implemented, plan §7.8)

The SDK drives three phases; server calls use `Authorization: Key <PI_API_KEY>`:

1. **Phase I — approve**: `Pi.createPayment` → `onReadyForServerApproval(paymentId)`
   → `startPiRedemption` (creates the redemption + runs `approvePayment` action →
   `POST /payments/{id}/approve`).
2. **Phase II — blockchain**: the user signs + submits the Pi transaction.
3. **Phase III — complete + deliver**: `onReadyForServerCompletion(paymentId, txid)`
   → `completePiRedemption` → `completeAndFulfill` action verifies the txid →
   `POST /payments/{id}/complete` → **only after a 200 does it call
   `internal.vas.fulfill`** (the real airtime/data top-up).

A failed/unconfirmed payment is cancelled: `POST /payments/{id}/cancel` and the
redemption is marked refunded — the user is never charged for an unfulfilled order.

Incomplete (signed-but-uncompleted) payments are stashed during sign-in and
resolved by `PiIncompleteResumer` once the session is known.

## 5. Going live checklist
- [ ] App registered in Developer Portal with Prod URL `https://view2earn.org/pi`.
- [ ] `PI_API_KEY` set on the Convex deployment.
- [ ] Real `CLUBKONNECT_*` or `RELOADLY_*` creds set (or accept simulate mode).
- [ ] `NEXT_PUBLIC_PI_SANDBOX="false"` for the production web build.
- [ ] Redeployed website via `npm run deploy -w @view2earn/website`.