-- Speed up the marketplace listing feed: the church/active/created-at combo backs
-- the main listing query's WHERE + ORDER BY, and the FK columns below had no index
-- at all (Postgres doesn't add one automatically), so every listing's primary-image
-- and rating subqueries were doing a sequential scan.
CREATE INDEX IF NOT EXISTS idx_listings_church_active_created
  ON market_listings(church_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing
  ON market_listing_images(listing_id, is_primary, display_order);

CREATE INDEX IF NOT EXISTS idx_market_reviews_listing
  ON market_reviews(listing_id);
