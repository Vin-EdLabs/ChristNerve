# ChristNerve

**The Nerve System of Your Church.**

ChristNerve is a premium multi-tenant SaaS platform for Christian churches in Ghana. It combines:

1. **Church Management** — members, attendance, finance, giving, events, announcements, departments
2. **Member Marketplace** — Vublishop-style discovery where members list and sell their businesses, with shareable public storefronts that invite outsiders into the church

Every church gets a branded subdomain (e.g. `pka.scholarnerve.com`). Members get personal storefronts they can share on WhatsApp.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| Auth | JWT (church admins + super admin) |
| Real-time | Socket.IO |

---

## Setup

### 1. Create the database

```bash
# Using psql
createdb christnerve

# Or:
psql -U postgres -c "CREATE DATABASE christnerve;"
```

### 2. Run schema + seed

```bash
psql -U postgres -d christnerve -f database/schema.sql
psql -U postgres -d christnerve -f database/seed.sql
```

`schema.sql` creates extensions (`uuid-ossp`, `pgcrypto`), all tables, indexes, 15 market categories, and the PKA demo tenant.

`seed.sql` adds Grace Chapel Accra, Living Word Church Tema, PKA users/members, attendance, giving, expenses, events, announcements, marketplace listings (with Unsplash images), and reviews.

Demo passwords are hashed with PostgreSQL `pgcrypto` (`crypt(..., gen_salt('bf'))`), which is compatible with `bcryptjs` on the backend.

### 3. Backend

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL, JWT_SECRET, SUPERADMIN_JWT_SECRET, etc.
npm install
npm run dev
```

API defaults to `http://localhost:5000`.

### 4. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

App defaults to `http://localhost:5173`.

---

## Demo credentials

| Role | Email | Password | Church slug |
|------|-------|----------|-------------|
| Pastor | `pastor@pka.com` | `password123` | `pka` |
| Finance | `finance@pka.com` | `password123` | `pka` |
| Admin | `admin@pka.com` | `password123` | `pka` |
| Grace pastor | `pastor@grace.com` | `password123` | `grace` |
| Living Word pastor | `pastor@livingword.com` | `password123` | `livingword` |

**Super admin** is env-based (not seeded in SQL). Set credentials / secrets in backend `.env` (`SUPERADMIN_JWT_SECRET` and whatever login the API expects).

### Demo churches

| Name | Slug | City |
|------|------|------|
| Pentecost Assembly Kumasi | `pka` | Kumasi |
| Grace Chapel Accra | `grace` | Accra |
| Living Word Church Tema | `livingword` | Tema |

### Sample marketplace storefronts (PKA)

- `/shop/akosua-mensah` — Akosua's Kente Collection
- `/shop/kwame-asante` — Fresh Produce by Kwame
- `/shop/emmanuel-ofori` — Phone repairs
- `/shop/abena-boateng` — Photography

---

## Local domain / tenant routing

Production uses subdomains (`pka.scholarnerve.com`). Locally:

### Quick demo (easiest)

1. Start backend + frontend
2. Open `http://localhost:5173` — landing page
3. Click **Get Started** or **Explore Marketplace** — this enables church mode for PKA and routes into the app
4. Sign in with `pastor@pka.com` / `password123`

Or in the browser console:
```js
localStorage.setItem('church_mode', '1');
localStorage.setItem('church_slug', 'pka');
location.href = '/login';
```

To return to the landing page:
```js
localStorage.removeItem('church_mode');
location.href = '/';
```

### Option A — `X-Church-Slug` header (API)

The frontend Axios client already sends `X-Church-Slug` from `getChurchSlug()`. Manual API calls:

```http
X-Church-Slug: pka
```

### Option B — hosts file + subdomain

Edit your hosts file:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`  
**macOS/Linux:** `/etc/hosts`

```
127.0.0.1  pka.localhost
127.0.0.1  grace.localhost
127.0.0.1  livingword.localhost
127.0.0.1  christnerve.localhost
```

Then open:

- Landing: `http://christnerve.localhost:5173`
- PKA dashboard: `http://pka.localhost:5173`
- Marketplace: `http://pka.localhost:5173/market`
- Member shop: `http://pka.localhost:5173/shop/kwame-asante`

### Option C — login with church slug

The login API accepts `{ email, password, churchSlug }` so you can stay on `localhost:5173` and pass `pka` / `grace` / `livingword` at sign-in.

---

## Project layout

```
christnerve/
├── database/
│   ├── schema.sql      # Tables, indexes, categories, PKA tenant
│   └── seed.sql        # Full Ghanaian demo data
├── backend/            # Express API
└── frontend/           # React app
```

---

## Environment (backend)

```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/christnerve
JWT_SECRET=your_jwt_secret_here
SUPERADMIN_JWT_SECRET=your_superadmin_secret_here
FRONTEND_URL=http://localhost:5173
UPLOADS_DIR=./uploads
NODE_ENV=development
```

---

*ChristNerve — The Nerve System of Your Church.*  
*Premium church management + member marketplace. Built for Ghana.*
