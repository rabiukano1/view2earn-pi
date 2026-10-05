#!/usr/bin/env bash
# Prepare a fresh Ubuntu 24.04 server for self-hosted Convex.
# Idempotent: safe to run again.
#
#   sudo bash setup-server.sh [deploy-user]
#
# It does NOT touch SSH password login — that is a separate, deliberate step
# (harden-ssh.sh) you run only after confirming key login works.
set -euo pipefail

DEPLOY_USER="${1:-deploy}"
log() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }

log "Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw debian-keyring debian-archive-keyring apt-transport-https

log "Firewall (allow 22/80/443 only)"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

log "Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker --version

log "Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
systemctl enable --now caddy
caddy version

log "Node.js 20 (for the Convex CLI used by backup.sh)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

log "Deploy user: ${DEPLOY_USER}"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo,docker "$DEPLOY_USER"
# Carry over root's authorized_keys so you can log in as the new user.
if [[ -f /root/.ssh/authorized_keys ]]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

log "Directories"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/convex
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/convex-backup

cat <<EOS

==> Done.

Next:
  1. Upload infra/vps/* into /opt/convex (see infra/README.md).
  2. cp /opt/convex/.env.example /opt/convex/.env
     openssl rand -hex 32        # paste as INSTANCE_SECRET
     chmod 600 /opt/convex/.env
  3. Point DNS at this server, copy the Caddyfile to /etc/caddy/Caddyfile,
     then: sudo systemctl reload caddy
  4. cd /opt/convex && docker compose up -d
  5. docker compose exec backend ./generate_admin_key.sh   # save the key

  Only AFTER confirming you can SSH in as '${DEPLOY_USER}' with your key,
  run:  sudo bash /opt/convex/harden-ssh.sh
EOS
