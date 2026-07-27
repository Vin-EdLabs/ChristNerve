-- Church brand colors + primary admin username
ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS brand_color VARCHAR(20) DEFAULT '#2D1B69';

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#C4A035';

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);

ALTER TABLE church_users
  ADD COLUMN IF NOT EXISTS username VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS idx_church_users_username
  ON church_users (church_id, LOWER(username))
  WHERE username IS NOT NULL;
