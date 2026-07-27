-- Hotfix for production 500: /api/public/church/:slug
-- Missing columns/tables used by the visit + market public API.
-- Safe to re-run.

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS brand_color VARCHAR(20) DEFAULT '#2D1B69';

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#C4A035';

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS visit_welcome TEXT;

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS visit_hero_url TEXT;

CREATE TABLE IF NOT EXISTS church_gallery_images (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_church_gallery_church
  ON church_gallery_images (church_id, display_order);

CREATE TABLE IF NOT EXISTS church_join_applications (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255),
  whatsapp VARCHAR(40),
  city VARCHAR(120),
  note TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_join_apps_church_status
  ON church_join_applications (church_id, status, created_at DESC);
