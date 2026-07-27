#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Deploying ChristNerve..."

if [ -d .git ]; then
  git pull origin main || true
fi

echo "==> Backend install + build (+ migrate/seed)"
cd "$ROOT/backend"
# Need typescript for build — force install of all deps even if NODE_ENV=production
npm install --include=dev
SEED_DEMO=1 NODE_ENV=production npm run build
npm prune --omit=dev || true

echo "==> Frontend install + build"
cd "$ROOT/frontend"
# vite + tsc are devDependencies; NODE_ENV=production would skip them
npm install --include=dev
npm run build
# Keep vite out of runtime tree if desired (static dist already built)
npm prune --omit=dev || true

# Production static + uploads paths
if [ -d /var/www/christnerve ]; then
  echo "==> Syncing frontend dist → /var/www/christnerve/frontend/dist"
  mkdir -p /var/www/christnerve/frontend
  rsync -a --delete "$ROOT/frontend/dist/" /var/www/christnerve/frontend/dist/

  echo "==> Ensuring uploads directory exists"
  mkdir -p /var/www/christnerve/uploads/church
  chmod -R u+rwX /var/www/christnerve/uploads
fi

echo "==> Nginx site"
if [ -f "$ROOT/deploy/nginx/christnerve" ]; then
  cp "$ROOT/deploy/nginx/christnerve" /etc/nginx/sites-available/christnerve
  ln -sfn /etc/nginx/sites-available/christnerve /etc/nginx/sites-enabled/christnerve
  # Wildcard cert missing? fall back to christnerve leaf cert
  if [ ! -f /etc/letsencrypt/live/scholarnerve.com/fullchain.pem ] \
    && [ -f /etc/letsencrypt/live/christnerve.scholarnerve.com/fullchain.pem ]; then
    sed -i 's|/etc/letsencrypt/live/scholarnerve.com/|/etc/letsencrypt/live/christnerve.scholarnerve.com/|g' \
      /etc/nginx/sites-available/christnerve || true
  fi
  nginx -t && systemctl reload nginx
fi

echo "==> Restarting API (PM2)"
cd "$ROOT"
if pm2 describe christnerve-backend >/dev/null 2>&1; then
  pm2 restart christnerve-backend --update-env
elif pm2 describe christnerve-api >/dev/null 2>&1; then
  # Migrate old name → new
  pm2 delete christnerve-api || true
  pm2 start ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

echo "==> Health checks"
sleep 2
curl -fsS "http://127.0.0.1:5001/health" >/dev/null
curl -fsS "http://127.0.0.1:5001/api/health" >/dev/null
curl -fsS -H "Host: ch-pka.scholarnerve.com" \
  "http://127.0.0.1:5001/api/public/church/pka" | head -c 120
echo
echo "ChristNerve deployed successfully"
