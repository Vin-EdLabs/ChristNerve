-- Fix marketplace chat: one conversation per buyer + seller + listing
DROP INDEX IF EXISTS idx_market_conv_pair;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_conv_buyer_seller_listing
  ON market_conversations (
    church_id,
    buyer_type,
    buyer_id,
    seller_member_id,
    (COALESCE(listing_id, 0))
  );
