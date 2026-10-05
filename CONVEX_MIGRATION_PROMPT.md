# Prompt: Move my monorepo from Convex Cloud to Self-Hosted Convex

> **How to use:** Fill in the `<<...>>` values below, then paste this whole file into your VS Code AI agent (Claude Code, Copilot Chat agent mode, Cline, etc.). You can also save it in your repo as `docs/CONVEX_MIGRATION_PROMPT.md` and tell the agent: "Read docs/CONVEX_MIGRATION_PROMPT.md and start Phase 1."
>
> If you unzipped `convex-self-hosting-guide.zip` into the repo, put it at `docs/convex-self-hosting-guide/` so the agent can use those files.

---

## My values (fill these in)

- Domain for the backend API: `<<api.yourdomain.com>>`
- Domain for HTTP actions: `<<site.yourdomain.com>>`
- Server: InterServer Linux VPS, Ubuntu 24.04, 2 slices (2 vCPU / 4 GB RAM), IP `<<SERVER_IP>>`
- Path of the Convex package in my monorepo (folder containing `convex/`): `<<packages/backend>>`
- React Native app path(s): `<<apps/mobile>>`
- Next.js app path(s): `<<apps/web>>`
- Did the Convex cloud export work? `<<yes, file is rescue.zip / no>>`

---

## Context

You are a senior full-stack engineer helping me move my apps off Convex Cloud to **self-hosted Convex** (the open-source `convex-backend` in Docker).

- My stack: **React Native CLI (Hermes)**, **Next.js**, and **Convex** as a shared TypeScript backend, organized as a **monorepo**. Some apps integrate **Pi Network** and **Sidra Chain**.
- Convex Cloud disabled my projects for exceeding the free plan. My apps are down right now. I need them back up quickly without paying Convex.
- Target setup:
  - **Production:** self-hosted Convex on my VPS behind **Caddy** (HTTPS), at `https://<<api domain>>` (API) and `https://<<site domain>>` (HTTP actions).
  - **Development:** self-hosted Convex in Docker on my laptop at `http://127.0.0.1:3210`, used with `npx convex dev`.
  - I must keep the normal Convex workflow: `npx convex dev` for development, `npx convex deploy` for production.
- The Convex CLI targets self-hosted when `.env.local` contains `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. It targets cloud when it contains `CONVEX_DEPLOYMENT`. **Never both.**

---

## Rules (follow strictly)

1. **Work one phase at a time.** At the start of each phase, show a short plan. At the end, summarize what changed and **wait for me to say "continue"**.
2. **Explain in simple English.** I am an experienced developer, but keep instructions short and clear.
3. **Never commit or print secrets.** Admin keys, `INSTANCE_SECRET`, API keys, and `cloud-env-vars.txt` stay out of git and out of logs. Add them to `.gitignore`.
4. **Ask before any destructive command.** That includes `npx convex import --replace`, deleting files or tables, `docker compose down -v`, and `git push --force`.
5. **Do not SSH into my server yourself.** For server work, write scripts and give me the exact commands to run. I will paste back the output.
6. **Do not change business logic** in `convex/` functions unless a phase asks for it. If you find a bug, report it and don't fix it silently.
7. **Never hardcode** `*.convex.cloud`, `*.convex.site`, an IP address, or an admin key in app code. Backend URLs must come from config/env.
8. After code changes, run the type check and build for affected packages (`tsc --noEmit`, `npx convex codegen` where relevant) and fix errors.
9. If the official Convex self-hosting docs in the repo (`get-convex/convex-backend` → `self-hosted/`) differ from this prompt, **tell me**. Don't guess.

---

## Phase 1 — Audit the repo (no code changes)

Scan the monorepo and create `docs/MIGRATION_AUDIT.md` with:

- The location of every Convex package and `convex/` folder.
- **Every place the backend URL is used:** `ConvexReactClient`, `ConvexHttpClient`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_URL`, and any hardcoded `.convex.cloud` / `.convex.site` URL. List file and line.
- **All environment variables** read in `convex/` (`process.env.X`). List names only, no values.
- Auth setup (Convex Auth, Clerk, custom JWT, Pi auth, etc.) and which env vars it needs (e.g. `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`).
- Crons (`crons.ts`), scheduled functions (`ctx.scheduler`), HTTP routes (`http.ts`), `"use node"` actions, and file storage usage.
- External services that call my HTTP actions (webhooks, payment callbacks) and need a new URL.
- **Likely reasons I hit the free-plan limits:** frequent crons, client polling, queries using `.collect()` on large tables without an index, large documents returned to clients, actions in loops, heavy bandwidth. Rank them by likely cost.

---

## Phase 2 — Environment switching

In the Convex package:

- Create `.env.cloud.example`, `.env.selfhosted.example`, and `.env.localdev.example`. Use `docs/convex-self-hosting-guide/project/` if present.
- Create `scripts/switch-env.mjs`. It must work on Windows, macOS, and Linux. It copies `.env.<target>` into `.env.local`, keeps non-Convex lines, backs up the old `.env.local`, and refuses if both cloud and self-hosted keys are present.
- Add `package.json` scripts: `use:cloud`, `use:self`, `use:local`. Optionally add safe helpers like `deploy:prod` (`npm run use:self && npx convex deploy`).
- Update `.gitignore`: `.env.local`, `.env.local.bak`, `.env.cloud`, `.env.selfhosted`, `.env.localdev`, `cloud-env-vars.txt`, `*.zip`, `backups/`.

---

## Phase 3 — Centralize the backend URL in the apps

- **React Native:** use `react-native-config` (or the config method already in the repo) with `.env.development`, `.env.staging`, and `.env.production`. Create one module (e.g. `src/lib/convex.ts`) that builds the `ConvexReactClient` from config. Development points to the laptop instance: `http://10.0.2.2:3210` on the Android emulator, `http://<laptop LAN IP>:3210` on a real device. Production uses `https://<<api domain>>`.
  - Android: allow cleartext HTTP **only in debug builds** for the laptop instance (debug `network_security_config`). Release must stay HTTPS-only.
- **Next.js:** read `NEXT_PUBLIC_CONVEX_URL` everywhere. Provide `.env.development.example` and `.env.production.example`.
- Replace every hardcoded Convex URL found in Phase 1.
- If any app exposes HTTP-action URLs to third parties, read them from a `CONVEX_SITE_URL`-style config.

---

## Phase 4 — Infrastructure files

Create `infra/` (reuse `docs/convex-self-hosting-guide/` files if present):

- `infra/vps/docker-compose.yml`: `convex-backend` and `convex-dashboard`, with ports bound to `127.0.0.1` only, a named data volume, `restart: unless-stopped`, and a healthcheck on `/version`.
- `infra/vps/.env.example`: `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, `INSTANCE_NAME`, `INSTANCE_SECRET` (with the note: generate using `openssl rand -hex 32`, set before generating the admin key), optional `POSTGRES_URL`, `DISABLE_BEACON`, `REDACT_LOGS_TO_CLIENT`, `ACTIONS_USER_TIMEOUT_SECS`.
- `infra/vps/Caddyfile`: `api` → `localhost:3210`, `site` → `localhost:3211`.
- `infra/vps/setup-server.sh`: an idempotent script for fresh Ubuntu 24.04. It updates the system; sets up `ufw` (22/80/443 only); installs Docker, Caddy and Node.js 20; creates a non-root user with sudo and docker access; disables SSH password login **only after confirming key login works** (print a warning and make this a separate step); and creates `/opt/convex` and `/opt/convex-backup`.
- `infra/vps/backup.sh`: runs `npx convex export --include-file-storage` daily, keeps 14 days, and has an optional `rclone` off-site copy. Credentials come from a root-only env file, not from the script itself.
- `infra/laptop/docker-compose.yml`: a local dev instance on ports 3210/3211/6791.
- `infra/README.md`: exact commands for me to upload these files (`scp`) and run them on the server.

---

## Phase 5 — Data and environment variable migration

- Create `scripts/copy-env-vars.mjs`. It reads a `KEY=VALUE` file (from `npx convex env list`), shows me the **names only**, asks for confirmation, then runs `npx convex env set KEY VALUE` for each against the currently selected target. It must never print values.
- Write the exact command sequence for me to run:
  - **If the export worked:** `use:self` → `npx convex deploy` → copy env vars → `npx convex import --replace rescue.zip` (ask me first) → verify row counts in the dashboard.
  - **If the export did NOT work:** deploy with an empty database now so the apps run again. Then write a plan for when Convex cloud re-enables (start of next month): export immediately, and merge old data table by table with `npx convex import --table <name> --append <file>`. Never use `--replace` here. Flag tables where `_id` references or unique fields could conflict.

---

## Phase 6 — Reduce backend load

Using the Phase 1 findings, propose fixes **one at a time** and wait for my approval before each:

- Add indexes and replace full-table `.collect()` with indexed queries or pagination.
- Reduce cron frequency, or switch to scheduled functions triggered by events.
- Remove client polling in favor of reactive `useQuery`.
- Return only needed fields; paginate large lists.
- Batch writes in mutations; avoid action → mutation loops where one mutation would do.

---

## Phase 7 — Verification

- Run type checks and builds for all apps and the Convex package.
- Create `docs/MIGRATION_CHECKLIST.md` with test steps: sign up/login, existing-user login, live updates on two devices, main CRUD, **Pi payment create → approve → complete**, Sidra Chain actions, crons, scheduler, HTTP actions at the new site URL, file upload/download, `"use node"` actions, and Next.js with the new URL.
- Write the final cutover steps:
  - Point production app configs to `https://<<api domain>>`.
  - Bump the React Native version and build release APK/AAB.
  - Redeploy Next.js.
  - Update webhook URLs.
  - Keep the Convex cloud project untouched for 2 weeks as a rollback option.

---

## Daily workflow after migration (document in `docs/DEV_WORKFLOW.md`)

```bash
# Develop features (laptop instance, safe)
npm run use:local
npx convex dev

# Ship to production (VPS)
npm run use:self
npx convex deploy
```

Warning: never run `npx convex dev` while targeting the VPS, because it pushes straight to production.

---

**Start with Phase 1 now.**
