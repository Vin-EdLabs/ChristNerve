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

### Database migrations (fixes 500 on /api/public/church/pka)

If marketplace / visit page returns **500**, the server DB is missing newer columns/tables
(`visit_hero_url`, `youtube_url`, `church_gallery_images`, etc.).

On the VPS (from the ChristNerve repo root):

```bash
cd /var/www/christnerve   # or your clone path
cd backend && npm install  # needs pg for the node runner

# Apply all migrations (safe to re-run)
node ../database/run-migrations.js

# Also load demo members + ~20 market listings for PKA:
SEED_DEMO=1 node ../database/run-migrations.js

# Restart API
pm2 restart christnerve-api --update-env
```

Then verify:

```bash
curl -sS https://ch-pka.scholarnerve.com/api/public/church/pka | head
# should return JSON with church + featured_listings (not 500)
```

Or with psql:

```bash
psql "$DATABASE_URL" -f database/migrate-visit-join.sql
psql "$DATABASE_URL" -f database/migrate-member-staff-depts-visit.sql
psql "$DATABASE_URL" -f database/migrate-demo-market-20.sql
```


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
