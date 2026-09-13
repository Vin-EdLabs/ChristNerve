# ChristNerve Documentation

## 1. Executive Summary

ChristNerve is a multi-tenant church operating platform for churches in Ghana. It brings church administration, member care, communication, church content, reporting, and a member-powered marketplace into one branded digital space.

The system has three connected experiences:

1. **Platform administration**: ChristNerve operators create, approve, configure, monitor, and manage church tenants.
2. **Church portal**: church staff and members use a tenant-specific dashboard for administration, ministry, content, communication, and marketplace activity.
3. **Public church and marketplace**: visitors can discover a church, view its public information and events, browse member businesses, view storefronts, and submit a join request.

The central design principle is tenant isolation: every church has its own slug, branding, members, staff, activity, content, finance records, pastoral records, and marketplace listings.

## 2. What Has Been Achieved

The repository contains a working full-stack product foundation rather than a static prototype:

- React and TypeScript web application built with Vite.
- Node.js, Express, and TypeScript API.
- PostgreSQL persistence with a base schema and ordered migrations.
- JWT authentication for staff, members, and super administrators.
- Tenant resolution from production hosts, localhost query parameters, and API headers.
- Role-aware church dashboard navigation and backend authorization checks.
- Church member registry with generated member numbers, departments, member credentials, verification, and profiles.
- Attendance recording, member check-in, personal attendance, statistics, and Sunday reporting.
- Giving and expense management in Ghana cedis, with summaries, trends, receipts, filtering, and audit entries.
- Events, announcements, pinning, church branding, and a public church page.
- Department management, department posts, department membership, and leader support.
- Pastoral care workflows for prayer requests, follow-ups, welfare cases, and cell groups.
- Church life publishing for sermons, devotionals, bulletins, live streams, church feed posts, reactions, birthdays, growth, and WhatsApp-oriented reporting.
- Marketplace categories, listings, images, reviews, public listing detail, member storefronts, cart, orders, vendor tools, and buyer/vendor chat.
- In-app notifications, unread counts, church broadcasts, device token registration, Firebase Cloud Messaging, and installable PWA support.
- Super-admin dashboards for platform statistics, churches, registrations, notifications, audit, and health monitoring.
- File uploads for logos, listing media, church feed images, and related media.
- Production deployment support using PM2, Nginx, HTTPS, wildcard-style tenant hosts, and repair scripts.

## 3. Product Model

### 3.1 Platform

The platform host is the ChristNerve control plane. In production it is represented by a host such as `christnerve.scholarnerve.com`. Locally, `/` without a church query parameter is the platform landing page.

Platform capabilities include:

- Platform dashboard statistics.
- Church tenant listing and detail statistics.
- New church creation with branding and an initial pastor/admin account.
- Public church registration, which creates a pending inactive tenant for review.
- Approval, rejection, setup, editing, logo upload, and deletion of church accounts.
- Subscription plan, status, amount, and billing-date fields.
- Platform-wide notifications and audit visibility.
- Firebase notification health checks.

Super-admin authentication is separate from church authentication and uses `SUPERADMIN_JWT_SECRET`.

### 3.2 Church Tenant

A tenant is represented by a row in `church_tenants`. Its `slug` is used to select the church for both the frontend and API. A tenant stores:

- Name, short name, tagline, description, denomination, founded year.
- Logo, banner, brand color, and public visit-page details.
- Address, city, region, phone, and email.
- Subscription plan, status, amount, and next billing date.
- Active/inactive state.
- Live-stream URL and active state.

All church-owned records reference `church_id`. The API checks that authenticated staff or members belong to the resolved tenant before returning protected data.

### 3.3 Church Users and Members

There are two account families:

- **Staff users** live in `church_users` and can have roles such as pastor, admin, finance, or secretary.
- **Members** live in `church_members`. Members can receive credentials, sign in, use member-specific pages, participate in church life, and operate marketplace storefronts.

Staff and members use the same church portal shell, but their allowed routes and backend operations differ. Finance users are further restricted to finance, settings, audit, and supporting pages. Members cannot access staff-only administration endpoints.

## 4. How the Application Works

### 4.1 Frontend Startup and Routing

The frontend starts in `frontend/src/main.tsx` and renders `App.tsx`. The application first decides whether it is in platform mode or church mode.

Platform mode exposes:

- `/` for the landing page.
- `/admin` for the super-admin dashboard.
- `/admin/monitor` for platform monitoring.
- `/admin/registrations` for pending registrations.
- `/admin/churches` for church management.

Church mode is selected from a `ch-{slug}.scholarnerve.com` host in production, or from `?church=slug` / session state on localhost. It exposes login, the church dashboard, member routes, ministry routes, and marketplace routes.

`DashboardLayout` applies route guards after authentication. `MarketLayout` provides marketplace navigation, tenant branding, categories, and cart behavior.

### 4.2 API Request Flow

A typical request follows this path:

1. The browser Axios client reads the current church slug.
2. It adds `Authorization: Bearer ...` using either the church or super-admin token.
3. It adds `X-Church-Slug` for tenant-aware requests.
4. Express applies security headers, CORS, JSON parsing, and static upload serving.
5. `resolveChurchTenant` resolves the church from the production host, localhost query, or header.
6. Protected routes apply `requireChurchTenant` and/or `requireChurchAuth`.
7. The route validates role and account type, executes parameterized PostgreSQL queries, and returns JSON.
8. Mutating operations may write an audit record and send notifications.

The API exposes both `/health` and `/api/health` for operational checks.

### 4.3 Authentication

Church login is handled under `/api/auth`. JWT claims carry the user identity, church identity, account type, and role. On every protected request, the backend loads the current active user/member from PostgreSQL rather than trusting all profile details in the token.

Member first-login and credential setup are supported. Member PINs are normalized, validated, and hashed through the member authentication utilities. Staff passwords use `bcryptjs`.

A tenant mismatch produces a forbidden response, preventing a valid token for one church from being used against another church's records.

## 5. Achieved Church Portal Modules

### Dashboard

The church home dashboard combines operational indicators into a briefing view:

- Total and active members.
- Recent and latest attendance.
- Current-month giving.
- Active marketplace listings.
- New members this week.
- Pending prayer requests.
- Pending follow-ups.
- Open welfare cases.
- Whether attendance has been recorded today.
- Recent giving, attendance, and member activity.
- Events occurring today.

### Members

The member registry supports:

- Search by name, email, phone, or member number.
- Filtering by status and department.
- Pagination and member statistics.
- Member creation and editing.
- Automatically generated numbers such as `PKA-0001`.
- Phone normalization and member PIN validation.
- Department membership synchronization.
- Member verification.
- Member profile and detail views.
- Credential setup and PIN reset.
- Avatar uploads.
- Marketplace slug and storefront identity.
- Promotion of a member to a staff account through the users workflow.

Member statuses represented by the schema include active, inactive, visitor, and transferred.

### Attendance

Staff can create attendance records for service types such as Sunday Service, Midweek, Prayer Meeting, and Youth Service. Attendance stores date, totals, demographic counts, visitor count, notes, and recorder identity.

Individual member check-ins are stored separately and are unique per attendance record/member pair. Members can view their own attendance; staff can view attendance records, member attendance, statistics, and check-ins.

### Finance

Finance is divided into giving and expenses.

Giving supports:

- Tithe, offering, building fund, thanksgiving, donation, mission fund, and other types.
- Amounts in GHS by default.
- Cash, mobile-money, and bank-transfer style payment methods.
- Mobile-money references and notes.
- Optional member association.
- Date filtering, member filtering, pagination, and detail records.
- Automatically generated receipt numbers such as `CNV-YYYYMMDD-0001`.
- Monthly total, type breakdown, six-month trend, and top-giver summaries.

Expenses support categories, descriptions, amounts, payment methods, dates, receipt URLs, approvals, and recording staff.

Finance routes are restricted to staff and finance users. Finance users are routed to the finance area when they attempt to access unrelated administrative pages.

### Events and Announcements

Church staff can create, view, edit, and delete events. Events can be public and include title, description, type, time, location, and banner media.

Announcements support audiences, department targeting, publication dates, pinning, editing, deletion, and detail views. Announcements can be used for church-wide or member-facing communication.

### Departments

Departments can be created, edited, viewed, and deleted. They have descriptions and leaders, and members can belong to multiple departments. Department posts are supported for local communication.

### Church Page and Public Visit Experience

The church-page administration area manages the public-facing tenant profile, branding, visitor information, gallery content, and join requests. Public endpoints expose church details, public events, and featured marketplace content.

The public visit page is available at `/visit` in church mode. It is intended to help visitors understand the church and take the next step through the public join flow.

### Pastoral Care

Pastoral care is represented by dedicated data and workflows:

- **Prayer requests**: member submissions, anonymous requests, assignment, status, response, and staff management.
- **Follow-ups**: reasons, assigned staff, notes, last-seen information, completion, and visitor handling.
- **Welfare cases**: bereavement, hospital, financial, and other case types with assignment and open/in-progress/closed status.
- **Cell groups**: group leaders, meeting schedules, locations, members, and next/last meeting information.

Members receive personal views for the workflows that apply to them, while staff receive management views.

### Church Life and Content

The church-life module supports recurring spiritual and communication content:

- Sermons with preacher, series, YouTube URL, thumbnail, date, description, and publication state.
- Daily devotionals with scripture, author, body, date, and publication state.
- Sunday bulletins with order of service, announcements, offering focus, welcome note, and publication state.
- Live stream URL and active status.
- Church feed posts with text, images, videos, author identity, and reactions.
- Reactions including `amen`, `love`, and `fire`.
- Sunday reports with attendance demographics, salvations, decisions, notes, and WhatsApp text generation.
- Growth dashboard data.
- Birthday information and milestone badges.
- WhatsApp action/template support for communication workflows.

### Notifications

Notifications can be personal or church-wide. Authenticated users can:

- View recent notifications.
- Read one notification.
- Mark all notifications read.
- View unread counts.
- Register a browser/device token.

Server-side notification helpers are used by finance, super-admin, and other workflows to notify staff or members. Firebase Cloud Messaging can deliver browser and installed-PWA notifications when the required credentials and VAPID key are configured.

### Audit

Mutating administrative operations can write audit entries. Staff and super-admin audit views expose activity for accountability and operational review.

## 6. Marketplace

The marketplace connects church members' economic activity to the church community and the public.

### Buyer Experience

Visitors and authenticated users can:

- Browse categories.
- Search and filter listings by church and category.
- Open a listing detail page.
- See listing images, seller profile, church identity, reviews, ratings, and related listings.
- Add items to a cart.
- Contact a seller through marketplace chat.
- Browse a member storefront.

Listing pages increment their view count when opened. Public listing queries return only active listings.

### Seller Experience

Members can:

- Create listings.
- Upload listing images.
- Edit or remove their listings.
- Manage their own shop view.
- View vendor orders.
- Communicate with buyers.

Listing slugs are generated uniquely, and member marketplace slugs provide shareable storefront URLs such as `/shop/kwame-asante`.

### Marketplace Data

The marketplace uses these core entities:

- `market_categories`
- `market_listings`
- `market_listing_images`
- `market_reviews`
- `market_conversations`
- `market_messages`

Listing results include category data, seller verification state, primary image, rating average, review count, and pagination metadata.

## 7. Super-Admin Operations

The super-admin API and frontend form the platform control plane.

Available operations include:

- Platform totals for churches, active churches, pending churches, members, listings, and subscription revenue.
- Church listing with member, listing, user, and primary-admin summaries.
- Create a church and its initial administrator in one transaction.
- Upload or replace church logos.
- Approve, reject, set up, edit, or delete churches.
- View per-church statistics.
- Send and manage platform notifications.
- Inspect notification health and device-token counts.
- Review platform audit records.

Public self-service church registration does not create a pastor account. It inserts a pending inactive tenant, which must be reviewed and provisioned by a super administrator.

## 8. Database and Migrations

PostgreSQL is the source of truth. The base schema creates extensions, tenants, users, members, departments, attendance, finance, events, announcements, marketplace categories/listings/images/reviews, indexes, and demo foundations.

Feature migrations add:

- Member authentication and login fields.
- Church branding and PWA fields.
- Staff/member departments and visit-page data.
- Join requests.
- Notifications and device tokens.
- Audit records.
- Live reactions.
- Marketplace chat and listing relationships.
- Pastoral care and cell groups.
- Church life content, feed, reports, growth data, and badges.
- Demo marketplace content.

The migration runners preserve the required order and are intended to be re-runnable with `IF NOT EXISTS` protections where supported. The Node runner verifies the PKA tenant, active listings, required tenant columns, and the church gallery table.

For local bootstrap, `backend/scripts/setup-db.cjs` can create the database, apply `schema.sql`, and load `seed.sql`. For an existing deployment, use `database/run-migrations.js` or `database/run-migrations.sh`.

## 9. Tenant Routing

### Production

- Platform: `https://christnerve.scholarnerve.com`
- Church: `https://ch-{slug}.scholarnerve.com`
- Example: `https://ch-pka.scholarnerve.com/market`

The frontend extracts the church slug from the `ch-` subdomain. The API extracts it from the forwarded host and resolves the active tenant.

### Localhost

The repository's active Vite configuration uses port `5174`, and the backend defaults to port `5001`.

Examples:

- Landing: `http://localhost:5174/`
- PKA portal: `http://localhost:5174/?church=pka`
- PKA login: `http://localhost:5174/login?church=pka`
- PKA marketplace: `http://localhost:5174/market?church=pka`
- PKA storefront: `http://localhost:5174/shop/kwame-asante?church=pka`

The frontend sends `X-Church-Slug: pka` to the API. The API also accepts `?church=pka` when resolving localhost requests.

Hosts-file aliases can be used for local testing, but the frontend's canonical local implementation is query/session-based tenant selection.

## 10. Security and Operational Controls

Implemented controls include:

- JWT verification for church and super-admin sessions.
- Active-user and active-member checks on protected requests.
- Tenant membership checks for authenticated identities.
- Role and account-type restrictions.
- Parameterized PostgreSQL queries.
- Helmet security headers.
- CORS allowlisting for configured frontend, localhost, and expected production hosts.
- Express rate limiting dependency for protected operational use.
- Upload handling through Multer and a controlled uploads directory.
- PostgreSQL constraints, foreign keys, unique keys, and indexes.
- Audit service integration for important administrative changes.
- Separate secrets for regular JWTs and super-admin JWTs.

Production still requires disciplined secret management, HTTPS, database backups, least-privilege credentials, and monitoring outside the application code.

## 11. Notifications, Realtime, and PWA

Socket.IO is included for realtime server/client communication, particularly for chat and live interaction surfaces. Marketplace messages are persisted in PostgreSQL so the conversation history does not depend only on a live connection.

The frontend includes Firebase Analytics and Firebase Cloud Messaging integration. Notification setup can resolve the VAPID key from the frontend environment or the public API configuration endpoint.

The PWA layer includes:

- Service workers.
- Dynamic tenant-aware manifest generation.
- Tenant branding in the manifest.
- Install prompts.
- Browser push registration.
- iPhone guidance requiring Add to Home Screen before Web Push can operate.

Push notifications are optional and remain unavailable until Firebase project configuration, VAPID keys, service-worker registration, HTTPS, and authorized domains are correctly set.

## 12. Deployment

The intended production shape is:

1. Build the backend TypeScript into `backend/dist`.
2. Apply database migrations, optionally with demo data.
3. Build the Vite frontend into `frontend/dist`.
4. Run the backend with PM2 using `ecosystem.config.js`.
5. Serve the frontend and proxy API, uploads, and Socket.IO through Nginx.
6. Configure DNS and TLS for the platform and tenant hosts.
7. Verify `/health`, `/api/health`, public church JSON, and notification health.

`deploy/server-repair.sh` automates a production repair sequence: dependency installation, build/migration, PM2 restart, local health checks, Nginx installation/reload, public HTTPS checks, and recent error-log inspection.

Production deployment values currently reflected in the repository include backend port `5001`, PM2 app name `christnerve-backend`, and production host patterns under `scholarnerve.com`.

## 13. Local Setup

### Requirements

- Node.js and npm.
- PostgreSQL with permission to create/use the database.
- Optional Firebase credentials for push notifications.
- Optional Nginx/PM2 for production-like deployment.

### Install

From the repository root:

```bash
npm run install:all
```

Create `backend/.env` with at least:

```env
PORT=5001
DATABASE_URL=postgresql://postgres:password@localhost:5432/christnerve
JWT_SECRET=replace_with_a_long_secret
SUPERADMIN_JWT_SECRET=replace_with_a_second_long_secret
FRONTEND_URL=http://localhost:5174
UPLOADS_DIR=./uploads
NODE_ENV=development
```

Initialize the database with either:

```bash
cd backend
node scripts/setup-db.cjs
```

or the explicit `psql` schema/seed commands documented in the root README.

Start both applications from separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5174/`, choose church mode, and use the seeded PKA credentials when demo data is loaded.

## 14. Demo Dataset

The seed currently provides these church tenants:

| Church | Slug | City |
|---|---|---|
| ChristNerve demo / PKA | `pka` | Accra in the seed tenant record |
| Grace Chapel Accra | `grace` | Accra |
| Living Word Church Tema | `livingword` | Tema |

Seeded PKA staff accounts include:

- `pastor@pka.com`
- `finance@pka.com`
- `admin@pka.com`

The seed password for the demo church accounts is `password123`. This is for local demonstration only and must not be reused in production.

The demo also includes members, attendance, giving, expenses, events, announcements, reviews, and marketplace listings. Example storefront slugs include `akosua-mensah`, `kwame-asante`, `emmanuel-ofori`, and `abena-boateng`.

## 15. API Surface

The API is organized by route family:

| Prefix | Responsibility |
|---|---|
| `/api/auth` | Staff/member login, first login, credentials, profile, super-admin login |
| `/api/members` | Member registry, statistics, credentials, verification, uploads |
| `/api/attendance` | Attendance records, statistics, member check-in, personal attendance |
| `/api/finance` | Giving, expenses, summaries, reports |
| `/api/events` | Church events |
| `/api/announcements` | Announcements and pinning |
| `/api/departments` | Departments, memberships, and posts |
| `/api/market` | Categories, listings, storefronts, images, reviews, orders, chat-related marketplace actions |
| `/api/chat` | Conversations, messages, unread totals |
| `/api/public` | Church registration, public church data, public events, public market, manifest, FCM configuration |
| `/api/church-page` | Branding, gallery, public page administration, join requests |
| `/api/dashboard` | Church home briefing data |
| `/api/pastoral` | Prayer requests, follow-ups, welfare, cell groups |
| `/api/church-life` | Sermons, live, devotionals, bulletins, feed, reports, growth, birthdays, home content |
| `/api/notifications` | Notification inbox, read state, unread counts, device tokens |
| `/api/audit` | Church audit feed |
| `/api/users` | Church staff users, audit feed, member promotion |
| `/api/superadmin` | Platform administration, monitoring, notifications, audit |

Most church route families require both an active tenant and a valid church JWT. Public marketplace/category and public church endpoints are intentionally available without church login where their route comments identify them as public.

## 16. Known Boundaries and Configuration Dependencies

The following are implementation boundaries, not claims of missing core functionality:

- Subscription fields and monthly revenue reporting exist, but the repository does not show a payment gateway or automated billing processor.
- Firebase push is implemented as an integration, but it requires project credentials, VAPID configuration, HTTPS, and authorized domains.
- Marketplace listings, cart, orders, and chat are implemented as application workflows; the repository does not establish an external payment settlement provider.
- YouTube is used for sermon/live media through stored URLs; the repository does not host or encode video.
- Production DNS, certificates, PostgreSQL provisioning, backups, PM2, Nginx, and secrets remain deployment responsibilities.
- The application has demo credentials and seeded demo content for exploration; production deployments must replace them and review all tenant branding and access roles.
- The root README contains the quick-start path. This document is the fuller product and engineering reference.

## 17. Source Map

Important implementation anchors:

- Frontend route composition: `frontend/src/App.tsx`
- Tenant resolution: `frontend/src/utils/tenantHost.ts` and `backend/src/middleware/churchTenant.ts`
- Church authentication: `backend/src/middleware/churchAuth.ts`
- API bootstrap and middleware: `backend/src/index.ts`
- Database foundation: `database/schema.sql`
- Demo data: `database/seed.sql`
- Migration runners: `database/run-migrations.js`, `database/run-migrations.sh`, and `backend/scripts/migrate.js`
- Deployment process: `deploy/DEPLOY.md`, `deploy/server-repair.sh`, and `ecosystem.config.js`

## 18. Conclusion

ChristNerve has achieved a broad church operating system with multi-tenant foundations, authenticated staff/member workflows, church content and care tools, public visitor journeys, and a marketplace that extends church community into economic discovery.

Its strongest completed foundation is the connection between operational church data and everyday participation: members can be managed, welcomed, cared for, informed, counted, connected, and represented through their businesses, while church leaders receive a consolidated view of the congregation and its activity.
