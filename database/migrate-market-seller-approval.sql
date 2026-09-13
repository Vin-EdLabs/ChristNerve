-- Seller approval workflow: members must request permission to sell and a
-- church admin must approve it before they can create marketplace listings.
ALTER TABLE church_members
  ADD COLUMN IF NOT EXISTS seller_status VARCHAR(20) NOT NULL DEFAULT 'none',
  -- none | pending | approved | rejected
  ADD COLUMN IF NOT EXISTS seller_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS seller_reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS seller_reviewed_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_church_members_seller_status
  ON church_members (church_id, seller_status);
