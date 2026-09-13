-- Professional listings: a member can post about their trade/profession (plumber,
-- lawyer, mason, driver, etc.) with no price — just a description of their work
-- and portfolio photos, distinct from priced product listings.
ALTER TABLE market_listings
  ADD COLUMN IF NOT EXISTS listing_type VARCHAR(20) NOT NULL DEFAULT 'product';
  -- 'product' | 'professional'

CREATE INDEX IF NOT EXISTS idx_listings_type
  ON market_listings (church_id, listing_type, is_active);

INSERT INTO market_categories (name, slug, icon, display_order)
VALUES
  ('Plumbing', 'plumbing', 'Wrench', 16),
  ('Legal Services', 'legal', 'Scale', 17)
ON CONFLICT (slug) DO NOTHING;
