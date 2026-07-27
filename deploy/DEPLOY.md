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

cp backend/.env.production.example backend/.env   # fill secrets
mkdir -p /var/www/christnerve/uploads/church

chmod +x deploy.sh && ./deploy.sh
pm2 start ecosystem.config.js --env production && pm2 save

sudo cp deploy/nginx/christnerve /etc/nginx/sites-available/christnerve
sudo ln -sf /etc/nginx/sites-available/christnerve /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d christnerve.scholarnerve.com
```

Cloudflare DNS:

| Type | Name        | Content     | Proxy   |
|------|-------------|-------------|---------|
| A    | christnerve | YOUR_VPS_IP | Proxied |
| A    | *           | YOUR_VPS_IP | Proxied |

Church hosts look like `ch-pka.scholarnerve.com` — ScholarNerve’s other hosts are untouched.
