-- In-app marketplace chat (buyer ↔ vendor)
CREATE TABLE IF NOT EXISTS market_conversations (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  buyer_type VARCHAR(20) NOT NULL,
  buyer_id INTEGER NOT NULL,
  seller_member_id INTEGER NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES market_listings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_conv_pair
  ON market_conversations (church_id, buyer_type, buyer_id, seller_member_id);

CREATE INDEX IF NOT EXISTS idx_market_conv_seller
  ON market_conversations (seller_member_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS market_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES market_conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  -- buyer | seller
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_msg_conv
  ON market_messages (conversation_id, created_at ASC);
