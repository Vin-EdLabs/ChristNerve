ALTER TABLE church_tenants
ADD COLUMN IF NOT EXISTS live_service_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS live_service_url TEXT;

CREATE TABLE IF NOT EXISTS live_reactions (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id),
  service_id VARCHAR(100) NOT NULL,
  reaction_type VARCHAR(20) NOT NULL,
  member_id INTEGER REFERENCES church_members(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_reactions_church_service
  ON live_reactions (church_id, service_id, reaction_type);
