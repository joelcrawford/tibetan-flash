#!/bin/bash
# The only thing tibetan-flash's CI deploy key can run.
#
# Installed by hand on bot as /usr/local/sbin/deploy-tibetan-flash (root:root
# 0755); this file is the canonical copy — reinstall after changing it. CI logs
# in as `deploy`, whose authorized_keys pins the key to
#   command="sudo -n /usr/local/sbin/deploy-tibetan-flash \"$SSH_ORIGINAL_COMMAND\"",restrict
# and /etc/sudoers.d/deploy allows exactly these wrappers.
#
#   deploy-tibetan-flash check    show what would deploy; changes nothing
#   deploy-tibetan-flash deploy   read the built web app (.tar.gz) on stdin,
#                                 reset the server clone to origin/main, then
#                                 run its ops/deploy.sh
#
# The web app is built in CI because it needs Node 20 and this server runs 18.
# Everything else comes from git, so only the build crosses the wire.
set -euo pipefail

APP=tibetan-flash
SRC=/opt/src/tibetan-flash
SELF=/usr/local/sbin/deploy-$APP

# CI sends "<wrapper> deploy" so the same command works whether the key is
# the old unrestricted one or the forced-command one. Anything else is refused.
req="${1:-}"
req="${req#"$SELF "}"
case "$req" in
  check | deploy) ;;
  *) echo "usage: $SELF check|deploy (got: '${1:-}')" >&2; exit 64 ;;
esac

# One deploy at a time across every app on this 3.8 GB box.
exec 9>/run/lock/deploy.lock
flock -w 1800 9 || { echo "another deploy held the lock for 30 minutes" >&2; exit 75; }

cd "$SRC"
git fetch -q origin main

if [ "$req" = check ]; then
  echo "$APP clone:       $(git log -1 --format='%h %s' HEAD)"
  echo "$APP origin/main: $(git log -1 --format='%h %s' origin/main)"
  git log --oneline HEAD..origin/main | sed 's/^/  would deploy: /'
  if git cat-file -e origin/main:ops/deploy.sh 2>/dev/null; then
    echo "ops/deploy.sh is on origin/main"
  else
    echo "ops/deploy.sh is NOT on origin/main yet — a deploy would fail"
  fi
  echo "pm2-root.service: $(systemctl is-active pm2-root)"
  exit 0
fi

# The PM2 daemon must be the systemd-managed one. If it were down, pm2 would
# start a fresh daemon inside the deploy's transient unit, and it would die
# when the unit ends — taking both apps with it.
if ! systemctl is-active --quiet pm2-root; then
  echo "pm2-root.service is not running — start it before deploying" >&2
  exit 69
fi

# Unpack the build. GNU tar skips absolute and '..' member names, and
# ops/deploy.sh copies regular files only, so a symlink can't escape the web root.
web=$(mktemp -d /var/tmp/tibetan-web.XXXXXX)
if ! tar -xzf - -C "$web" --no-same-owner --no-same-permissions; then
  rm -rf "$web"; echo "could not unpack the web build from stdin" >&2; exit 65
fi
if [ ! -f "$web/index.html" ]; then
  rm -rf "$web"; echo "the web build has no index.html — refusing" >&2; exit 65
fi

git reset -q --hard origin/main
echo "$APP: deploying $(git log -1 --format='%h %s')"
# Own unit: a CI timeout or cancel only drops the log stream, it can't stop
# the install half-way. The unit name also blocks a second concurrent deploy.
exec systemd-run --unit="deploy-$APP" --wait --pipe --quiet --collect \
  -p WorkingDirectory="$SRC" -E HOME=/root -E PM2_HOME=/root/.pm2 \
  "$SRC/ops/deploy.sh" "$web"
