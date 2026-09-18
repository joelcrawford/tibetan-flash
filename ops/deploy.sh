#!/bin/bash
# Installs tibetan-flash on bot from the server clone plus the CI-built web app.
#
# Runs as root in a transient systemd unit started by
# /usr/local/sbin/deploy-tibetan-flash (canonical copy: ops/deploy-wrapper.sh),
# which has already reset /opt/src/tibetan-flash to origin/main and unpacked
# the web build into the directory passed as $1.
#
# The live layout is exactly what the old rsync-from-CI deploy produced —
# /var/www/tibetan-flash, /opt/tibetan-flash with its .venv, and the two PM2
# apps in ecosystem.config.cjs. Only where the files come from changed.
set -euo pipefail

WEB=${1:?usage: ops/deploy.sh <unpacked web build dir>}
trap 'rm -rf "$WEB"' EXIT
SRC=/opt/src/tibetan-flash
LIVE=/opt/tibetan-flash
cd "$SRC"

echo "→ web app"
# -rt, not -a: regular files only (no symlinks, no source owners).
rsync -rt --delete --chmod=D755,F644 "$WEB"/ /var/www/tibetan-flash/

echo "→ server and python"
rsync -rt --delete --exclude node_modules --exclude models/ --exclude .env \
  server/ "$LIVE/server/"
rsync -rt --delete --exclude __pycache__ src/python/ "$LIVE/src/python/"
install -m644 ecosystem.config.cjs "$LIVE/"
# The old rsync-from-CI kept the GitHub runner's uid on these files.
chown -R root:root /var/www/tibetan-flash "$LIVE/server" "$LIVE/src" "$LIVE/ecosystem.config.cjs"

echo "→ dependencies"
(cd "$LIVE/server" && npm install --omit=dev --no-audit --no-fund)
"$LIVE/.venv/bin/pip" install -q -r "$LIVE/src/python/requirements.txt"

echo "→ restarting under PM2"
cd "$LIVE"
pm2 startOrRestart ecosystem.config.cjs --update-env

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:7860/health >/dev/null; then
    # Save only once healthy, so a reboot never restores a broken set.
    pm2 save
    echo "Deployment successful: $(curl -s http://127.0.0.1:7860/health)"
    exit 0
  fi
  sleep 2
done

echo "Health check failed after 60s — PM2 dump NOT saved; a reboot restores the last good set"
pm2 logs --nostream --lines 40 tibetan-node || true
exit 1
