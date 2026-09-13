-- Live-stream session history + YouTube-style comments under the live stream.
CREATE TABLE IF NOT EXISTS church_livestream_sessions (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_livestream_sessions_church
  ON church_livestream_sessions (church_id, started_at DESC);

CREATE TABLE IF NOT EXISTS church_livestream_comments (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES church_livestream_sessions(id) ON DELETE CASCADE,
  user_type VARCHAR(10) NOT NULL,
  user_id INTEGER,
  author_name VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livestream_comments_session
  ON church_livestream_comments (session_id, created_at ASC);
