-- Public, no-login join links for live rooms
ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS public_join_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_join_code VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_rooms_public_join_code
  ON live_rooms (public_join_code)
  WHERE public_join_code IS NOT NULL;
