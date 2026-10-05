#!/usr/bin/env bash
# Daily snapshot of the self-hosted Convex deployment.
# Keeps 14 days locally; optional off-site copy with rclone.
#
#   sudo bash backup.sh
#
# Credentials come from /opt/convex/backup.env (root-only, chmod 600):
#   CONVEX_SELF_HOSTED_URL=https://api.view2earn.org
#   CONVEX_SELF_HOSTED_ADMIN_KEY=...
#   RCLONE_REMOTE=            # optional, e.g. "gdrive:view2earn-backups"
set -euo pipefail

ENV_FILE=/opt/convex/backup.env
DEST=/opt/convex-backup
KEEP_DAYS=14

[[ -r "$ENV_FILE" ]] || { echo "Missing $ENV_FILE"; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${CONVEX_SELF_HOSTED_URL:?}" "${CONVEX_SELF_HOSTED_ADMIN_KEY:?}"

mkdir -p "$DEST"
stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
out="$DEST/convex-$stamp.zip"

# --include-file-storage also pulls uploaded files (screenshots, voice notes,
# videos) — a document-only export would silently lose them.
npx --yes convex export --include-file-storage --path "$out"

if [[ ! -s "$out" ]]; then
  echo "Export produced no file — leaving older backups alone." >&2
  exit 1
fi
echo "Wrote $out ($(du -h "$out" | cut -f1))"

find "$DEST" -name 'convex-*.zip' -type f -mtime +"$KEEP_DAYS" -print -delete

if [[ -n "${RCLONE_REMOTE:-}" ]] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$out" "$RCLONE_REMOTE" && echo "Copied off-site to $RCLONE_REMOTE"
fi
