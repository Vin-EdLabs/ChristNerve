-- Add member portal login support
ALTER TABLE church_members
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Demo member passwords (password123) for PKA sample emails
UPDATE church_members m
SET password_hash = crypt('password123', gen_salt('bf'))
WHERE m.email IS NOT NULL
  AND m.password_hash IS NULL
  AND m.church_id IN (SELECT id FROM church_tenants WHERE slug = 'pka');
