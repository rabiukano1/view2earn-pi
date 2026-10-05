# infra — self-hosted Convex

Two environments, same backend image:

| | Where | API | HTTP actions | Dashboard |
|---|---|---|---|---|
| Production | InterServer VPS, behind Caddy | `https://api.view2earn.org` | `https://site.view2earn.org` | SSH tunnel only |
| Local dev | your laptop (Docker) | `http://127.0.0.1:3210` | `http://127.0.0.1:3211` | `http://127.0.0.1:6791` |

Replace `<SERVER_IP>` below with the VPS address. Commands run from the repo
root on your PC unless stated otherwise.

---

## 1. DNS first

Before Caddy can get certificates, both names must resolve to the VPS:

```
A   api    -> <SERVER_IP>     (DNS only / grey cloud)
A   site   -> <SERVER_IP>     (DNS only / grey cloud)
```

Cloudflare proxy (orange cloud) also works, but grey cloud is one less moving
part for WebSockets. Verify:

```
nslookup api.view2earn.org
nslookup site.view2earn.org
```

## 2. Prepare the server

```
scp infra/vps/*.sh infra/vps/.env.example infra/vps/docker-compose.yml infra/vps/Caddyfile root@<SERVER_IP>:/root/
ssh root@<SERVER_IP>
```

On the server:

```
bash /root/setup-server.sh deploy
```

Installs Docker, Caddy, Node 20; sets `ufw` to 22/80/443; creates the `deploy`
user with your SSH key; creates `/opt/convex` and `/opt/convex-backup`.
It deliberately does **not** change SSH password settings.

Move the files into place:

```
mv /root/docker-compose.yml /root/.env.example /root/backup.sh /root/harden-ssh.sh /opt/convex/
cp /root/Caddyfile /etc/caddy/Caddyfile
chown -R deploy:deploy /opt/convex
```

## 3. Configure and start Convex

```
cd /opt/convex
cp .env.example .env
openssl rand -hex 32          # paste the output as INSTANCE_SECRET in .env
nano .env
chmod 600 .env
```

`INSTANCE_SECRET` must be final **before** the next step — changing it later
invalidates every admin key.

```
docker compose up -d
docker compose ps             # backend should be "healthy"
curl -s localhost:3210/version
```

TLS:

```
sudo systemctl reload caddy
curl -s https://api.view2earn.org/version        # from your PC
```

## 4. Admin key

```
docker compose exec backend ./generate_admin_key.sh
```

Copy the key into `.env.selfhosted` on your PC (git-ignored):

```
CONVEX_SELF_HOSTED_URL=https://api.view2earn.org
CONVEX_SELF_HOSTED_ADMIN_KEY=<the key>
CONVEX_URL=https://api.view2earn.org
CONVEX_SITE_URL=https://site.view2earn.org
```

Never commit it, never put it in app code.

## 5. Dashboard (no public exposure)

```
ssh -L 6791:127.0.0.1:6791 deploy@<SERVER_IP>
```

Then open <http://127.0.0.1:6791> and paste the admin key when asked.

## 6. Daily backups

```
sudo nano /opt/convex/backup.env      # URL + admin key (+ optional RCLONE_REMOTE)
sudo chmod 600 /opt/convex/backup.env
sudo bash /opt/convex/backup.sh       # test run
sudo crontab -e
```

Add:

```
15 3 * * * bash /opt/convex/backup.sh >> /var/log/convex-backup.log 2>&1
```

Keeps 14 days in `/opt/convex-backup`, includes file storage.

## 7. Harden SSH (last, and only once key login is proven)

Open a **second** terminal, confirm `ssh deploy@<SERVER_IP>` works with your
key, then in the first one:

```
sudo bash /opt/convex/harden-ssh.sh
```

---

## Local development backend

```
docker compose -f infra/laptop/docker-compose.yml up -d
docker compose -f infra/laptop/docker-compose.yml exec backend ./generate_admin_key.sh
```

Put that key in `.env.localdev` (Option A in `.env.localdev.example`), then:

```
npm run use:local
npx convex dev
```

Wipe it any time: `docker compose -f infra/laptop/docker-compose.yml down -v`.

The Convex CLI's own local deployment (already configured in this repo) also
uses port 3210 — run one or the other, not both.

## Day-to-day

```
npm run dev:backend      # local backend + convex dev
npm run deploy:backend   # push functions to the VPS
```

Never run a bare `npx convex dev` while `.env.local` targets the VPS: it pushes
on every file save, straight to production.

## Server operations

```
cd /opt/convex
docker compose logs -f backend      # logs
docker compose pull && docker compose up -d   # upgrade image
docker compose restart backend
```

`docker compose down -v` **deletes the database volume** — take a backup first.

## Notes / deviations

- The migration prompt lists `ACTIONS_USER_TIMEOUT_SECS`; upstream splits this
  into `V8_ACTION_USER_TIMEOUT_SECS` and `NODE_ACTION_USER_TIMEOUT_SECS`.
  Both are in `.env.example`.
- Storage defaults to the backend's built-in SQLite, held in the `data` volume.
  The whole dataset is ~6 MB / 123 k documents, so Postgres buys nothing yet;
  set `POSTGRES_URL` in `.env` if you want it later.
- `convex/piWithdrawalsPayout.ts` and `convex/anchor.ts` are `"use node"`
  actions — supported, but they are the heaviest thing on the box.
