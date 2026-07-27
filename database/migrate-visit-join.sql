-- Visit / join church applications
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
  -- pending | approved | declined
  reviewed_by INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_join_apps_church_status
  ON church_join_applications (church_id, status, created_at DESC);

-- Optional dedicated visit hero image (falls back to banner_url)
ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS visit_hero_url TEXT;
