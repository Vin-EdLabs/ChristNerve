-- Church life features: sermons, live, devotionals, bulletin, feed, sunday report, badges
-- Safe to re-run (IF NOT EXISTS)

ALTER TABLE church_members
  ADD COLUMN IF NOT EXISTS wedding_anniversary DATE;

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS live_stream_url TEXT,
  ADD COLUMN IF NOT EXISTS live_stream_active BOOLEAN DEFAULT false;

-- Sermons
CREATE TABLE IF NOT EXISTS church_sermons (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  preacher VARCHAR(180),
  series VARCHAR(180),
  youtube_url TEXT NOT NULL,
  youtube_id VARCHAR(32),
  thumbnail_url TEXT,
  preached_at DATE,
  description TEXT,
  is_published BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sermons_church_date
  ON church_sermons (church_id, preached_at DESC NULLS LAST, id DESC);

-- Daily devotionals
CREATE TABLE IF NOT EXISTS church_devotionals (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  scripture VARCHAR(255),
  body TEXT NOT NULL,
  author_name VARCHAR(180),
  devote_date DATE NOT NULL,
  is_published BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (church_id, devote_date)
);
CREATE INDEX IF NOT EXISTS idx_devotionals_church_date
  ON church_devotionals (church_id, devote_date DESC);

-- Sunday bulletin
CREATE TABLE IF NOT EXISTS church_bulletins (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Sunday Bulletin',
  service_date DATE NOT NULL,
  order_of_service TEXT,
  announcements TEXT,
  offering_focus TEXT,
  welcome_note TEXT,
  is_published BOOLEAN DEFAULT false,
  created_by INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (church_id, service_date)
);
CREATE INDEX IF NOT EXISTS idx_bulletins_church_date
  ON church_bulletins (church_id, service_date DESC);

-- Church feed
CREATE TABLE IF NOT EXISTS church_feed_posts (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  author_staff_id INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  author_member_id INTEGER REFERENCES church_members(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE church_feed_posts
  ADD COLUMN IF NOT EXISTS video_url TEXT;
CREATE INDEX IF NOT EXISTS idx_feed_posts_church
  ON church_feed_posts (church_id, created_at DESC);

CREATE TABLE IF NOT EXISTS church_feed_reactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES church_feed_posts(id) ON DELETE CASCADE,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES church_members(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES church_users(id) ON DELETE CASCADE,
  reaction VARCHAR(20) NOT NULL CHECK (reaction IN ('amen', 'love', 'fire')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (post_id, member_id, reaction),
  UNIQUE (post_id, staff_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_post
  ON church_feed_reactions (post_id);

-- Sunday service report
CREATE TABLE IF NOT EXISTS church_sunday_reports (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  attendance_id INTEGER REFERENCES church_attendance(id) ON DELETE SET NULL,
  men INTEGER DEFAULT 0,
  women INTEGER DEFAULT 0,
  children INTEGER DEFAULT 0,
  visitors INTEGER DEFAULT 0,
  salvations INTEGER DEFAULT 0,
  decisions INTEGER DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES church_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (church_id, service_date)
);

-- Milestone badges
CREATE TABLE IF NOT EXISTS church_member_badges (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  badge_key VARCHAR(60) NOT NULL,
  badge_label VARCHAR(120) NOT NULL,
  awarded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (church_id, member_id, badge_key)
);
CREATE INDEX IF NOT EXISTS idx_member_badges_member
  ON church_member_badges (member_id, awarded_at DESC);
