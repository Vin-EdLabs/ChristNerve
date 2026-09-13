-- LiveKit-powered live rooms: devotions, bible studies, cell groups, meetings, counseling
CREATE TABLE IF NOT EXISTS live_rooms (
  id SERIAL PRIMARY KEY,
  church_id INTEGER NOT NULL REFERENCES church_tenants(id) ON DELETE CASCADE,
  livekit_room VARCHAR(140) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  room_type VARCHAR(30) NOT NULL DEFAULT 'meeting',
  -- devotion | service | bible_study | cell_group | meeting | counseling
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  -- scheduled | live | ended
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  max_participants INTEGER NOT NULL DEFAULT 50,
  created_by INTEGER,
  created_by_name VARCHAR(200),
  peak_participants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_rooms_church_status
  ON live_rooms (church_id, status, scheduled_at DESC);

-- One row per unique attendee who has ever joined a room (for attendee counts once a room ends).
CREATE TABLE IF NOT EXISTS live_room_attendees (
  id BIGSERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  church_id INTEGER NOT NULL,
  user_type VARCHAR(10) NOT NULL,
  user_id INTEGER NOT NULL,
  display_name VARCHAR(200),
  identity VARCHAR(140) NOT NULL,
  first_joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (room_id, user_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_room_attendees_room
  ON live_room_attendees (room_id);
