-- Audit trail for church actions + platform monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'staff',
  -- staff | member | superadmin | system
  actor_id INTEGER,
  actor_name VARCHAR(200),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80),
  entity_id INTEGER,
  summary TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_church ON audit_logs (church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
