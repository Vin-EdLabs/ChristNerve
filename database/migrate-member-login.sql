-- Member login credentials + roles
ALTER TABLE church_members
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS username VARCHAR(80),
  ADD COLUMN IF NOT EXISTS member_role VARCHAR(50) DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS credentials_set BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_church_members_username
  ON church_members (church_id, LOWER(username))
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_church_members_phone
  ON church_members (church_id, phone);
