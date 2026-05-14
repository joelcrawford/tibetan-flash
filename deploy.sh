#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
# Override any of these with environment variables:
#   DEPLOY_USER=joel DEPLOY_HOST=your-droplet.com npm run deploy
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_HOST="${DEPLOY_HOST:-bot}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/tibetan-flash}"
REMOTE_WEB="${REMOTE_WEB:-/var/www/tibetan-flash}"

# ── Build ─────────────────────────────────────────────────────
echo "→ Building client..."
npm run build

# ── Sync static build ─────────────────────────────────────────
echo "→ Syncing dist/ to $DEPLOY_HOST:$REMOTE_WEB"
rsync -az --delete dist/ "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_WEB/"

# ── Sync server & python ───────────────────────────────────────
echo "→ Syncing server/ and src/python/ to $DEPLOY_HOST:$REMOTE_ROOT"
rsync -az --delete \
  --exclude='node_modules' \
  server/ "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/server/"

rsync -az --delete \
  --exclude='__pycache__' \
  src/python/ "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/src/python/"

rsync -az ecosystem.config.cjs "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_ROOT/"

# ── Install deps & restart ────────────────────────────────────
echo "→ Installing deps and restarting PM2..."
ssh "$DEPLOY_USER@$DEPLOY_HOST" bash <<EOF
  set -e
  cd $REMOTE_ROOT

  # Node deps
  cd server && npm install --omit=dev && cd ..

  # Python deps
  .venv/bin/pip install -q -r src/python/requirements.txt

  # Restart both processes
  pm2 startOrRestart ecosystem.config.cjs --update-env
  pm2 save
EOF

echo "✓ Done"
