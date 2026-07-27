-- Dual role: staff linked to a member profile
ALTER TABLE church_users
  ADD COLUMN IF NOT EXISTS member_id INTEGER
    REFERENCES church_members(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_church_users_member
  ON church_users (church_id, member_id)
  WHERE member_id IS NOT NULL;

-- Public visit page media
ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS visit_welcome TEXT;

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

-- Multi-department membership
CREATE TABLE IF NOT EXISTS church_department_members (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES church_departments(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (department_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_dept_members_member
  ON church_department_members (member_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept
  ON church_department_members (department_id);

-- Backfill from free-text department name
INSERT INTO church_department_members (church_id, department_id, member_id)
SELECT m.church_id, d.id, m.id
FROM church_members m
JOIN church_departments d
  ON d.church_id = m.church_id
 AND LOWER(TRIM(m.department)) = LOWER(TRIM(d.name))
WHERE m.department IS NOT NULL AND TRIM(m.department) <> ''
ON CONFLICT DO NOTHING;

-- Also mark leaders
UPDATE church_department_members dm
SET role = 'leader'
FROM church_departments d
WHERE d.id = dm.department_id
  AND d.leader_member_id = dm.member_id;

-- Department posts / meetings from leaders
CREATE TABLE IF NOT EXISTS church_department_posts (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES church_departments(id) ON DELETE CASCADE,
  author_member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  post_type VARCHAR(30) DEFAULT 'update',
  -- update | meeting | event
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  meeting_at TIMESTAMP,
  location TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dept_posts_dept
  ON church_department_posts (department_id, created_at DESC);
