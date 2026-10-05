#!/usr/bin/env bash
# Disable SSH password login. SEPARATE STEP ON PURPOSE.
#
# !! Run this ONLY after you have opened a SECOND terminal and confirmed you
# !! can log in with your SSH key. If key login is not working, this will lock
# !! you out of the server permanently.
#
#   sudo bash harden-ssh.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }

read -r -p "Have you confirmed key-based SSH login in another terminal? (type: yes) " ok
[[ "$ok" == "yes" ]] || { echo "Aborted. Nothing changed."; exit 1; }

conf=/etc/ssh/sshd_config.d/99-hardening.conf
cat > "$conf" <<'CONF'
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
CONF
chmod 644 "$conf"
sshd -t
systemctl reload ssh || systemctl reload sshd
echo "Password login disabled. Keep this session open and verify a NEW login works."
