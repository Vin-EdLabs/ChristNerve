# ChristNerve production deployment
#
# Ports (do not conflict):
#   ScholarNerve → 3001
#   Vublishop    → 4000
#   ChristNerve  → 5001 (API) / 5174 (Vite local)
#
# Tenancy:
#   Production → ch-{slug}.scholarnerve.com
#   Local      → http://localhost:5174?church={slug}

## Local

```bash
# backend/.env  PORT=5001  FRONTEND_URL=http://localhost:5174
# frontend/.env VITE_API_URL=http://localhost:5001/api

cd backend && npm run dev
cd frontend && npm run dev   # → http://localhost:5174

# Landing
open http://localhost:5174

# Demo church
open http://localhost:5174?church=pka
open http://localhost:5174/login?church=pka
open http://localhost:5174/market?church=pka
```

## Production

```bash
createdb christnerve
psql christnerve < database/schema.sql
psql christnerve < database/seed.sql
# Also run any migrate-*.sql files under database/ if needed
psql christnerve < database/migrate-notifications.sql

cp backend/.env.production.example backend/.env   # fill secrets + Firebase Admin key
# Ensure frontend/.env.production has VITE_FIREBASE_* + VAPID key (baked at build)

mkdir -p /var/www/christnerve/uploads/church

chmod +x deploy.sh && ./deploy.sh
pm2 start ecosystem.config.js --env production && pm2 save

sudo cp deploy/nginx/christnerve /etc/nginx/sites-available/christnerve
sudo ln -sf /etc/nginx/sites-available/christnerve /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d christnerve.scholarnerve.com
# Wildcard for church hosts (preferred):
# sudo certbot certonly --dns-cloudflare -d '*.scholarnerve.com' -d scholarnerve.com
```

Cloudflare DNS:

| Type | Name        | Content     | Proxy   |
|------|-------------|-------------|---------|
| A    | christnerve | YOUR_VPS_IP | Proxied |
| A    | *           | YOUR_VPS_IP | Proxied |

Church hosts look like `ch-pka.scholarnerve.com` — ScholarNerve’s other hosts are untouched.

### Push notifications (required for production)

Firebase Console → Project **christnerve** → Project settings → Cloud Messaging:

1. Copy **Web Push certificates** key into:
   - `frontend/.env.production` → `VITE_FIREBASE_VAPID_KEY`
   - `backend/.env` → `FIREBASE_WEB_VAPID_KEY`
2. Add **Authorized domains** (Authentication → Settings → Authorized domains):
   - `christnerve.scholarnerve.com`
   - `scholarnerve.com`
   - each live church host you care about, or use custom domain allowlist carefully
3. Backend must have Firebase Admin credentials (`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` or `secrets/firebase-adminsdk.json`).
4. HTTPS is mandatory — push will not work on plain HTTP.

#### Device checklist

| Platform | How to enable | Badge |
|----------|---------------|-------|
| **Desktop** (Chrome/Edge) | Allow notifications when prompted after login | Bell badge + dock badge (Chromium) |
| **Android** (Chrome) | Allow notifications; optional Add to Home Screen | Bell badge + home-screen icon badge |
| **iPhone (Safari)** | Share → **Add to Home Screen**, open the icon, then allow notifications | Bell badge + icon badge (iOS 16.4+) |

After deploy, verify:

```bash
curl -s https://christnerve.scholarnerve.com/api/superadmin/notifications/health \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT"
# Expect: fcm_configured: true, device token counts
```

Send a test from Super Admin → Monitor / notifications, then confirm:
- toast / system notification appears
- bell shows unread count
- home-screen / dock badge updates (installed PWA)
