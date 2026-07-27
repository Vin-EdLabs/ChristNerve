-- Pastoral care + cell groups
CREATE TABLE IF NOT EXISTS church_prayer_requests (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false,
  request TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  -- pending | in_progress | answered
  assigned_to INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  response TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prayer_church_status
  ON church_prayer_requests (church_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS church_follow_ups (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  -- pending | completed | visitor
  assigned_to INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  notes TEXT,
  last_seen_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followups_church_status
  ON church_follow_ups (church_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS church_welfare_cases (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  case_type VARCHAR(50) NOT NULL DEFAULT 'other',
  -- bereavement | hospital | financial | other
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  -- open | in_progress | closed
  assigned_to INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_welfare_church_status
  ON church_welfare_cases (church_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS church_cell_groups (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  leader_member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  meeting_day VARCHAR(20),
  meeting_time TIME,
  location TEXT,
  last_meeting_at TIMESTAMP,
  next_meeting_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cell_groups_church
  ON church_cell_groups (church_id);

CREATE TABLE IF NOT EXISTS church_cell_group_members (
  id SERIAL PRIMARY KEY,
  cell_group_id INTEGER NOT NULL REFERENCES church_cell_groups(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (cell_group_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_cell_group_members_member
  ON church_cell_group_members (member_id);

-- Backfill cell groups from free-text cell_group on members
INSERT INTO church_cell_groups (church_id, name)
SELECT DISTINCT m.church_id, TRIM(m.cell_group)
FROM church_members m
WHERE m.cell_group IS NOT NULL AND TRIM(m.cell_group) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM church_cell_groups g
    WHERE g.church_id = m.church_id AND LOWER(g.name) = LOWER(TRIM(m.cell_group))
  );

INSERT INTO church_cell_group_members (cell_group_id, member_id)
SELECT g.id, m.id
FROM church_members m
JOIN church_cell_groups g
  ON g.church_id = m.church_id
 AND LOWER(TRIM(g.name)) = LOWER(TRIM(m.cell_group))
WHERE m.cell_group IS NOT NULL AND TRIM(m.cell_group) <> ''
ON CONFLICT DO NOTHING;
