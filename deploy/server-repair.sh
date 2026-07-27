#!/usr/bin/env bash
# One-shot production repair for ChristNerve 502 / missing schema / demo market.
# Run on the VPS as root (or with sudo for nginx/pm2):
#   bash /var/www/christnerve/deploy/server-repair.sh

set -euo pipefail

ROOT="${CHRISTNERVE_ROOT:-/var/www/christnerve}"
cd "$ROOT"

echo "==== ChristNerve server repair ===="
echo "Root: $ROOT"

# --- 1) Load DATABASE_URL ---
if [ -f "$ROOT/backend/.env" ]; then
  export DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/backend/.env" | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//;s/^'\''//;s/'\''$//')"
  export PORT="$(grep -E '^PORT=' "$ROOT/backend/.env" | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//' || true)"
fi
PORT="${PORT:-5001}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not found in backend/.env"
  exit 1
fi

echo "Port: $PORT"
echo "DB:   ${DATABASE_URL%%@*}@***"

# --- 2) Migrate + seed demo listings ---
cd "$ROOT/backend"
npm install
npm run build
SEED_DEMO=1 NODE_ENV=production npm run migrate

# --- 3) Restart the correct PM2 process ---
cd "$ROOT"
if pm2 describe christnerve-backend >/dev/null 2>&1; then
  pm2 restart christnerve-backend --update-env
  APP=christnerve-backend
elif pm2 describe christnerve-api >/dev/null 2>&1; then
  pm2 restart christnerve-api --update-env
  APP=christnerve-api
else
  pm2 start ecosystem.config.js --env production
  APP=christnerve-backend
fi
pm2 save
echo "PM2 app: $APP"
sleep 2

# --- 4) Local app checks (isolates nginx vs app) ---
echo "---- local health ----"
curl -sS -m 5 "http://127.0.0.1:${PORT}/health" || echo "FAIL /health"
curl -sS -m 5 "http://127.0.0.1:${PORT}/api/health" || echo "FAIL /api/health"
echo
echo "---- local public church ----"
curl -sS -m 10 -H "Host: ch-pka.scholarnerve.com" \
  "http://127.0.0.1:${PORT}/api/public/church/pka" | head -c 400 || true
echo

# --- 5) Nginx config check / reload ---
if [ -f "$ROOT/deploy/nginx/christnerve" ]; then
  echo "---- installing nginx site ----"
  cp "$ROOT/deploy/nginx/christnerve" /etc/nginx/sites-available/christnerve
  ln -sfn /etc/nginx/sites-available/christnerve /etc/nginx/sites-enabled/christnerve
fi

# Prefer wildcard cert; fall back to christnerve cert for ch-* if needed
if [ ! -f /etc/letsencrypt/live/scholarnerve.com/fullchain.pem ] \
  && [ -f /etc/letsencrypt/live/christnerve.scholarnerve.com/fullchain.pem ]; then
  echo "WARN: wildcard cert missing — patching nginx to use christnerve cert for ch-*"
  sed -i 's|/etc/letsencrypt/live/scholarnerve.com/|/etc/letsencrypt/live/christnerve.scholarnerve.com/|g' \
    /etc/nginx/sites-available/christnerve || true
fi

nginx -t
systemctl reload nginx

echo "---- public HTTPS ----"
curl -sS -m 15 "https://ch-pka.scholarnerve.com/api/health" | head -c 200 || true
echo
curl -sS -m 15 "https://ch-pka.scholarnerve.com/api/public/church/pka" | head -c 400 || true
echo

echo "---- recent nginx errors ----"
tail -n 30 /var/log/nginx/error.log 2>/dev/null || true

echo "---- recent PM2 errors ----"
pm2 logs "$APP" --err --lines 30 --nostream || true

echo "==== repair finished ===="
