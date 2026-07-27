-- In-app notifications + FCM device tokens
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  -- null church_id = platform-wide / superadmin
  user_type VARCHAR(20) NOT NULL DEFAULT 'staff', -- staff | member | superadmin
  user_id INTEGER, -- church_users.id or church_members.id; null = broadcast to church
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_type VARCHAR(20) NOT NULL,
  user_id INTEGER NOT NULL,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_type, user_id, is_read);

-- Seed demo notifications (idempotent: only if table is empty)
DO $$
DECLARE
  cid INTEGER;
  staff_id INTEGER;
BEGIN
  IF (SELECT COUNT(*) FROM notifications) > 0 THEN
    RETURN;
  END IF;

  SELECT id INTO cid FROM church_tenants ORDER BY id ASC LIMIT 1;
  SELECT id INTO staff_id FROM church_users WHERE church_id = cid ORDER BY id ASC LIMIT 1;

  -- Platform / superadmin notification
  INSERT INTO notifications (church_id, user_type, user_id, title, body, link, is_read)
  VALUES (
    NULL,
    'superadmin',
    NULL,
    'Welcome to ChristNerve Platform',
    'Your platform console is ready. Create churches and assign domains from here.',
    '/admin/churches',
    false
  );

  IF cid IS NOT NULL THEN
    -- Church-wide broadcast (all staff/members of this church)
    INSERT INTO notifications (church_id, user_type, user_id, title, body, link, is_read)
    VALUES (
      cid,
      'staff',
      NULL,
      'Welcome to your church dashboard',
      'Stay updated with announcements, events, and giving activity here.',
      '/dashboard',
      false
    );

    INSERT INTO notifications (church_id, user_type, user_id, title, body, link, is_read)
    VALUES (
      cid,
      'member',
      NULL,
      'Member portal is live',
      'Check events, announcements, and your marketplace profile anytime.',
      '/member',
      false
    );

    IF staff_id IS NOT NULL THEN
      INSERT INTO notifications (church_id, user_type, user_id, title, body, link, is_read)
      VALUES (
        cid,
        'staff',
        staff_id,
        'Complete your church profile',
        'Add your logo, contact details, and Sunday service times so members can find you.',
        '/settings',
        false
      );
    END IF;
  END IF;
END $$;
