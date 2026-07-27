#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Deploying ChristNerve..."

if [ -d .git ]; then
  git pull origin main
fi

echo "==> Backend install + build"
cd "$ROOT/backend"
npm install --omit=dev
npm run build

echo "==> Frontend install + build"
cd "$ROOT/frontend"
npm install
npm run build

# Production static + uploads paths (adjust if your VPS layout differs)
if [ -d /var/www/christnerve ]; then
  echo "==> Syncing frontend dist → /var/www/christnerve/frontend/dist"
  mkdir -p /var/www/christnerve/frontend
  rsync -a --delete "$ROOT/frontend/dist/" /var/www/christnerve/frontend/dist/

  echo "==> Ensuring uploads directory exists"
  mkdir -p /var/www/christnerve/uploads/church
  chmod -R u+rwX /var/www/christnerve/uploads
fi

echo "==> Restarting API (PM2)"
cd "$ROOT"
if pm2 describe christnerve-api >/dev/null 2>&1; then
  pm2 restart christnerve-api --update-env
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

echo "==> Health check"
sleep 1
curl -fsS "http://127.0.0.1:5001/health" || {
  echo "WARNING: health check failed — check pm2 logs: pm2 logs christnerve-api"
  exit 1
}

echo "ChristNerve deployed successfully"
