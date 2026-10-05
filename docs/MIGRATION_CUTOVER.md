# Cutover runbook — data + env vars to the self-hosted backend

Phase 5 of `CONVEX_MIGRATION_PROMPT.md`.

**The cloud export worked**, so this is the clean path: stand the VPS up, push
the functions, copy the env vars, import the snapshot.

## Rescue artefacts (both git-ignored, on this PC)

| File | Contents |
|---|---|
| `convex-export-full-2026-10-04.zip` | **9.1 MB — use this one.** 123 124 documents + 32 stored files (screenshots, PDFs, media) |
| `convex-export-2026-10-04.zip` | 6.1 MB, documents only. Superseded — keep as a second copy |
| `.env.convex-backup` | all 20 Convex environment variables |

> Copy all three somewhere off this machine before you start. If Convex deletes
> the disabled project, they cannot be recreated.

---

## Prerequisites

`infra/README.md` steps 1–4 are done: DNS resolves, containers are healthy,
Caddy serves HTTPS, and you have the admin key in `.env.selfhosted`.

Confirm from this PC:

```
curl -s https://api.view2earn.org/version
```

---

## The sequence

### 1. Point the CLI at the VPS

```
cd D:\user\v2e\View2Earn
npm run use:self
```

Prints `self-hosted`. If it says cloud or CLI local, stop — `.env.selfhosted`
is wrong.

### 2. Push the functions and schema

```
npx convex deploy
```

Creates every table and index on an empty database. Expect warnings about
missing env vars — step 3 fixes those.

### 3. Copy the environment variables

```
npm run copy:env
```

Shows the 20 names (never the values), the target deployment, and waits for you
to type `yes`.

Then set the two that are **not** carried over, because they describe the new
deployment rather than the old one:

```
npx convex env set SITE_URL https://pi.view2earn.org
```

`CONVEX_SITE_URL` is provided by the backend itself from `CONVEX_SITE_ORIGIN`
in `/opt/convex/.env` — do not set it by hand. Verify it is right, because
`convex/auth.config.ts` uses it as the JWT issuer:

```
npx convex env list | findstr /B "SITE_URL"
```

### 4. Import the data  ⚠ DESTRUCTIVE

`--replace-all` wipes whatever is in the target deployment first. It is correct
here only because the target is brand new and empty. **Never run it against a
deployment that has live data.**

```
npx convex import --replace-all convex-export-full-2026-10-04.zip
```

Takes a few minutes for 123 k documents. It asks for confirmation; read the
prompt before accepting.

### 4b. Rebuild the leaderboard cache  (required after any import)

`economyBalances` is maintained going forward by `lib/ledger.ts:insertLedgerRow`,
but imported history never passed through it. Build it once:

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

Until this completes, the leaderboard is empty and levels read as 0.

### 4c. Drain the pendingSpins backlog

43 868 settled rows (36 % of all documents) carry over in the import. Check
first, then purge — it self-reschedules until drained:

```
npx convex run spin:purgeSettledSpins "{\"dryRun\":true}"
npx convex run spin:purgeSettledSpins
npx convex run spin:purgeSettledSpins
```

> Windows quoting: in cmd.exe escape the inner quotes as above; in PowerShell
> use `'{\"dryRun\":true}'`. A bare `'{"dryRun":true}'` fails with
> "arguments ... must be an object" because cmd strips the double quotes.

Only `claimed` rows older than 7 days are deleted; their points are already in
`pointsLedger`, and every row is in the export.

### 5. Verify

```
npx convex run selfcheck:identity
```

All checks should print `ok:`. Then open the dashboard over the SSH tunnel
(`infra/README.md` §5) and compare row counts against the source numbers:

| Table | Expected |
|---|---|
| `users` | 321 |
| `pointsLedger` | 56 805 |
| `pendingSpins` | 43 868 |
| `adWatchLogs` | 8 498 |
| `verifications` | 964 |
| `authAccounts` | 322 |
| `authSessions` | 336 |
| `authRefreshTokens` | 4 768 |
| **total documents** | **123 124** |

Also spot-check one stored file, e.g. open a task proof screenshot in the admin
panel, to confirm file storage came across.

---

## What is NOT in the snapshot

- **Scheduled jobs in flight.** Any `ctx.scheduler` job that was pending when
  the cloud deployment was disabled is gone. After the import, check for
  `verifications` rows stuck in `PENDING_HOLD` with a past `holdUntil`, and
  `piWithdrawals` rows stuck in `processing`, and re-trigger them.
- **Cron history.** Crons restart on their own schedule — harmless.
- **The `_storage` IDs stay the same**, so documents referencing files keep
  working.

---

## After the import

Do not point the apps at the new backend yet — that is Phase 7, together with
the webhook URL changes. If you re-point the web apps early, the Telegram
webhook, Adsgram reward URL, CPX postback and VAS callback will still be aimed
at the dead `.convex.site` domain, and those events will be lost.

---

## If you ever need the other path

If a future export fails (deployment deleted, not just disabled), the recovery
is per table, never `--replace-all`:

```
npx convex import --table <name> --append <file>
```

Tables where `_id` collisions or unique fields would conflict and need manual
review first: `users` (`externalUid`, `telegramUserId`), `authAccounts`
(`provider` + `providerAccountId`), `pointsLedger` (the `balanceAfter` chain
must stay monotonic per user+economy), `completedTargets` (`normalizedUrl`),
`adCompletions` (`adId` replay protection).
