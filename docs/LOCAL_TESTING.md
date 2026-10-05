# Running and testing locally

Cloud is disabled and the VPS does not exist yet, so everything runs against
the **laptop backend**. Importing the real snapshot into it turns this into a
full rehearsal of the production cutover — same commands, zero risk.

Nothing here can touch real users: the local backend is a separate database on
this PC, and `.env.local` targets it (`CONVEX_DEPLOYMENT=local:…`).

---

## 1. Start the backend (terminal 1 — leave open)

```
cd D:\user\v2e\View2Earn
npm run dev:backend
```

`dev:backend` = `use:local` + `convex dev`. It starts the local backend on
port 3210 and pushes functions on every save. Wait for
`Convex functions ready!`.

Verify in another terminal:

```
curl http://127.0.0.1:3210/version
```

## 2. Load the environment variables (terminal 2, once)

Functions need API keys (Resend for sign-up emails, Telegram, Pi, …):

```
npm run copy:env
```

Shows the 20 names and waits for you to type `yes`. These are the real keys —
emails actually send, so use your own address when testing sign-up.

## 3. Import the real data (once)

```
npx convex import --replace-all convex-export-full-2026-10-04.zip
```

Takes a few minutes for 123 124 documents + 32 files. `--replace-all` is safe
here: the target is your throwaway local database.

Then the two post-import steps, exactly as production will need them:

```
npx convex run backfill:backfillEconomyBalances
```

It processes as many users as fit in one mutation's budget, then reschedules
itself until every user is done. **The command only kick-starts the chain** —
it returns `done: false` immediately; the rest runs in the background, so the
backend must stay up (keep `convex dev` / the VPS running).

Check progress by counting rows until the number stops growing:

```
npx convex data economyBalances --limit 2000
```

For this dataset it settles at ~260 rows (240 users have ledger rows, some
across more than one surface). Re-running afterwards is safe and reports
`written: 0`.

Then the spin backlog:

```
npx convex run spin:purgeSettledSpins "{\"dryRun\":true}"
npx convex run spin:purgeSettledSpins
```

Expected `wouldDelete: 200, more: true`. The purge deletes 200 rows per batch
and reschedules itself; a 32k backlog drains in roughly half an hour in the
background. Track it with the dry run's `oldestRemaining` timestamp — it moves
forward as rows are removed oldest-first. `more: false` means finished.
Run the purge for real to see it drain:

```
npx convex run spin:purgeSettledSpins
```

Verify the whole backend still behaves:

```
npx convex run selfcheck:identity
```

> Windows quoting: cmd.exe needs `"{\"dryRun\":true}"`; PowerShell needs
> `'{\"dryRun\":true}'`. Plain `'{"dryRun":true}'` fails.

## 4. Run the apps

### Android app (terminal 3 + 4)

Point the debug build at the laptop backend — edit `src/config.ts`:

```ts
const USE_LOCAL_BACKEND = true;   // debug builds only
```

```
npx react-native start                       # terminal 3, leave open
adb reverse tcp:8081 tcp:8081                # terminal 4
adb reverse tcp:3210 tcp:3210
adb reverse tcp:3211 tcp:3211
npx react-native run-android
```

Debug builds allow plain HTTP (debug manifest only), so `127.0.0.1:3210`
works. **Set `USE_LOCAL_BACKEND` back to `false` before any release build.**

### Wallet app

Same, with its own Metro port and `apps/wallet-app/src/config.ts`:

```
cd apps\wallet-app
npx react-native start --port 8082
adb reverse tcp:8082 tcp:8082
npx react-native run-android --port 8082
```

### Admin panel — easiest thing to test

```
npm run admin:dev
```

<http://localhost:3000>, password = the `ADMIN_PASSWORD` env var. With the data
imported you can see real users, tasks, redemptions and settings.

### Pi app / Telegram app

```
npm run pi:dev        # http://localhost:3002
```

`.env.development.local` already points these at `127.0.0.1:3210`.
Pi sign-in needs the Pi Browser (or the Pi sandbox URL), and Telegram sign-in
needs a Mini App session, so on a desktop browser these stop at the sign-in
screen — that is expected. The admin panel and the Android app are the
practical ways to exercise the backend.

---

## What to check after the Phase 6 fixes

| Area | How | Expect |
|---|---|---|
| Leaderboard | Android → Leaderboard | populated, ranks correct, fast |
| Level progress | Android → Home / Level | level matches lifetime points |
| Cash-out gate | Pi/TG wallet, or Android withdraw | "link all three + level 9" message |
| Spin | Android → Spin, claim, spin again | no "Already claimed" error |
| Task flow | claim → upload screenshot | state advances |
| Daily purge | `spin:purgeSettledSpins` | drains, then `more: false` |

## Switching back

```
npm run use:local     # (already the default)
npm run use:cloud     # only to talk to the disabled cloud deployment
```

Reset the local database at any time by re-importing with `--replace-all`.

## Known limits of local testing

- **Pi payments** need the Pi Browser over HTTPS — cannot be tested locally.
- **Webhooks** (Telegram, Adsgram, CPX, VAS) cannot reach `127.0.0.1`; the
  providers still point at the dead `.convex.site` domain until Phase 7.
- **Scheduled jobs** that were in flight when cloud was disabled are not in the
  snapshot, so some `verifications` may sit in `PENDING_HOLD`.
