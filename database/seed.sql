-- ============================================================
-- ChristNerve — Demo Seed Data
-- Rich Ghanaian content for ChristNerve Church (demo slug: pka)
-- ============================================================
-- Passwords use pgcrypto bcrypt (compatible with bcryptjs):
--   All demo church users: password123
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CHURCH TENANTS
-- ============================================================

INSERT INTO church_tenants (
  name, slug, tagline, description, address, city, region, phone, email,
  denomination, founded_year, subscription_plan, subscription_status,
  subscription_amount, next_billing_date, is_active
) VALUES (
  'ChristNerve Church',
  'pka',
  'The Nerve System of Your Church — live demo',
  'Official ChristNerve demo congregation. Explore the church dashboard, member marketplace, and growth tools with real Ghanaian sample data.',
  'Accra Digital Hub',
  'Accra',
  'Greater Accra',
  '0300000000',
  'demo@christnerve.com',
  'Non-denominational',
  2024,
  'starter',
  'active',
  300.00,
  '2026-08-26',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  region = EXCLUDED.region,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  denomination = EXCLUDED.denomination,
  founded_year = EXCLUDED.founded_year,
  updated_at = NOW();

INSERT INTO church_tenants (
  name, slug, tagline, description, address, city, region, phone, email,
  denomination, founded_year, subscription_plan, subscription_status,
  subscription_amount, next_billing_date, is_active
) VALUES
(
  'Grace Chapel Accra',
  'grace',
  'Grace that transforms lives',
  'An interdenominational church in Accra focused on worship, youth discipleship, and marketplace ministry.',
  'Osu Oxford Street Extension',
  'Accra',
  'Greater Accra',
  '0302987654',
  'hello@gracechapel.gh',
  'Interdenominational',
  2005,
  'starter',
  'active',
  300.00,
  '2026-08-15',
  true
),
(
  'Living Word Church Tema',
  'livingword',
  'Living by the Word, serving the city',
  'A growing congregation in Tema Community 5, known for strong Bible teaching and community outreach.',
  'Community 5, Near Tema Harbour Road',
  'Tema',
  'Greater Accra',
  '0303210987',
  'office@livingwordtema.org',
  'Pentecostal',
  1999,
  'starter',
  'active',
  300.00,
  '2026-08-20',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  city = EXCLUDED.city,
  region = EXCLUDED.region,
  updated_at = NOW();

-- ============================================================
-- CHURCH USERS (PKA)
-- password: password123  (bcrypt via pgcrypto)
-- ============================================================

INSERT INTO church_users (
  church_id, first_name, last_name, email, password_hash, phone, role, is_active
)
SELECT
  t.id,
  'Kwesi',
  'Owusu',
  'pastor@pka.com',
  crypt('password123', gen_salt('bf', 10)),
  '0244111222',
  'pastor',
  true
FROM church_tenants t
WHERE t.slug = 'pka'
ON CONFLICT (church_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = true;

INSERT INTO church_users (
  church_id, first_name, last_name, email, password_hash, phone, role, is_active
)
SELECT
  t.id,
  'Ama',
  'Serwaa',
  'finance@pka.com',
  crypt('password123', gen_salt('bf', 10)),
  '0244333444',
  'finance',
  true
FROM church_tenants t
WHERE t.slug = 'pka'
ON CONFLICT (church_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = true;

INSERT INTO church_users (
  church_id, first_name, last_name, email, password_hash, phone, role, is_active
)
SELECT
  t.id,
  'Kofi',
  'Adjei',
  'admin@pka.com',
  crypt('password123', gen_salt('bf', 10)),
  '0244555666',
  'admin',
  true
FROM church_tenants t
WHERE t.slug = 'pka'
ON CONFLICT (church_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = true;

-- Grace Chapel admin
INSERT INTO church_users (
  church_id, first_name, last_name, email, password_hash, phone, role, is_active
)
SELECT
  t.id,
  'Ruth',
  'Annan',
  'pastor@grace.com',
  crypt('password123', gen_salt('bf', 10)),
  '0244777888',
  'pastor',
  true
FROM church_tenants t
WHERE t.slug = 'grace'
ON CONFLICT (church_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true;

-- Living Word admin
INSERT INTO church_users (
  church_id, first_name, last_name, email, password_hash, phone, role, is_active
)
SELECT
  t.id,
  'Daniel',
  'Tetteh',
  'pastor@livingword.com',
  crypt('password123', gen_salt('bf', 10)),
  '0244999000',
  'pastor',
  true
FROM church_tenants t
WHERE t.slug = 'livingword'
ON CONFLICT (church_id, email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true;

-- ============================================================
-- MEMBERS (PKA) — PKA-0001 through PKA-0008
-- ============================================================

INSERT INTO church_members (
  church_id, member_number, first_name, last_name, email, phone, whatsapp,
  gender, date_of_birth, marital_status, occupation, address, city,
  department, ministry, cell_group, membership_status, membership_date,
  baptism_date, is_verified, marketplace_slug
)
SELECT
  t.id, v.member_number, v.first_name, v.last_name, v.email, v.phone, v.whatsapp,
  v.gender, v.date_of_birth::date, v.marital_status, v.occupation, v.address, v.city,
  v.department, v.ministry, v.cell_group, v.membership_status, v.membership_date::date,
  v.baptism_date::date, v.is_verified, v.marketplace_slug
FROM church_tenants t
CROSS JOIN (VALUES
  ('PKA-0001', 'Akosua', 'Mensah', 'akosua.mensah@gmail.com', '0244123456', '0244123456',
   'Female', '1992-03-14', 'Married', 'Fashion Designer', 'Santasi New Site', 'Kumasi',
   'Choir', 'Worship', 'Santasi Cell', 'active', '2019-03-10', '2015-06-21', true, 'akosua-mensah'),
  ('PKA-0002', 'Kwame', 'Asante', 'kwame.asante@gmail.com', '0244987654', '0244987654',
   'Male', '1988-11-02', 'Married', 'Electronics Technician', 'Bantama High Street', 'Kumasi',
   'Media', 'Media Ministry', 'Bantama Cell', 'active', '2017-08-20', '2012-04-08', true, 'kwame-asante'),
  ('PKA-0003', 'Abena', 'Boateng', 'abena.boateng@yahoo.com', '0244567890', '0244567890',
   'Female', '1995-07-22', 'Single', 'Photographer', 'Ayeduase Extension', 'Kumasi',
   'Media', 'Creative Arts', 'KNUST Cell', 'active', '2020-01-15', '2018-12-25', true, 'abena-boateng'),
  ('PKA-0004', 'Emmanuel', 'Ofori', 'emmanuel.ofori@gmail.com', '0244345678', '0244345678',
   'Male', '1990-05-09', 'Married', 'Phone Repair Technician', 'Suame Magazine', 'Kumasi',
   'Ushering', 'Hospitality', 'Suame Cell', 'active', '2018-05-06', '2014-09-14', true, 'emmanuel-ofori'),
  ('PKA-0005', 'Ama', 'Darko', 'ama.darko@outlook.com', '0244789012', '0244789012',
   'Female', '1993-12-01', 'Married', 'Caterer', 'Asokwa Estate', 'Kumasi',
   'Welfare', 'Hospitality', 'Asokwa Cell', 'active', '2019-09-01', '2016-03-27', true, 'ama-darko'),
  ('PKA-0006', 'Kofi', 'Mensah', 'kofi.mensah@gmail.com', '0244456123', '0244456123',
   'Male', '1985-01-18', 'Married', 'Building Contractor', 'Tafo Nhyiaeso', 'Kumasi',
   'Ushering', 'Men''s Fellowship', 'Tafo Cell', 'active', '2016-02-14', '2010-08-01', false, 'kofi-mensah'),
  ('PKA-0007', 'Efua', 'Addo', 'efua.addo@gmail.com', '0244678901', '0244678901',
   'Female', '1998-09-30', 'Single', 'Secondary School Teacher', 'Patasi', 'Kumasi',
   'Youth', 'Children''s Ministry', 'Patasi Cell', 'active', '2021-04-18', '2019-05-12', false, 'efua-addo'),
  ('PKA-0008', 'Yaw', 'Owusu', 'yaw.owusu@gmail.com', '0244890123', '0244890123',
   'Male', '1991-06-25', 'Single', 'Graphic Designer', 'Ahodwo', 'Kumasi',
   'Youth', 'Creative Arts', 'Ahodwo Cell', 'active', '2020-11-08', '2017-07-30', true, 'yaw-owusu')
) AS v(
  member_number, first_name, last_name, email, phone, whatsapp,
  gender, date_of_birth, marital_status, occupation, address, city,
  department, ministry, cell_group, membership_status, membership_date,
  baptism_date, is_verified, marketplace_slug
)
WHERE t.slug = 'pka'
ON CONFLICT (church_id, email) DO UPDATE SET
  member_number = EXCLUDED.member_number,
  phone = EXCLUDED.phone,
  whatsapp = EXCLUDED.whatsapp,
  department = EXCLUDED.department,
  is_verified = EXCLUDED.is_verified,
  marketplace_slug = EXCLUDED.marketplace_slug,
  updated_at = NOW();

-- ============================================================
-- DEPARTMENTS (PKA)
-- ============================================================

INSERT INTO church_departments (church_id, name, description, leader_member_id)
SELECT t.id, d.name, d.description, m.id
FROM church_tenants t
CROSS JOIN (VALUES
  ('Choir', 'Leads corporate worship and special music for services and events'),
  ('Youth', 'Discipleship, mentoring, and activities for teens and young adults'),
  ('Ushering', 'Welcomes congregants and maintains order during services'),
  ('Media', 'Sound, live streaming, photography, and digital communications'),
  ('Welfare', 'Care for members in need — hospital visits, bereavement, and support')
) AS d(name, description)
LEFT JOIN church_members m ON m.church_id = t.id AND (
  (d.name = 'Choir' AND m.marketplace_slug = 'akosua-mensah') OR
  (d.name = 'Youth' AND m.marketplace_slug = 'efua-addo') OR
  (d.name = 'Ushering' AND m.marketplace_slug = 'emmanuel-ofori') OR
  (d.name = 'Media' AND m.marketplace_slug = 'kwame-asante') OR
  (d.name = 'Welfare' AND m.marketplace_slug = 'ama-darko')
)
WHERE t.slug = 'pka'
  AND NOT EXISTS (
    SELECT 1 FROM church_departments cd
    WHERE cd.church_id = t.id AND cd.name = d.name
  );

-- ============================================================
-- ATTENDANCE — last 8 Sundays (ending 2026-07-26)
-- ============================================================

INSERT INTO church_attendance (
  church_id, service_type, service_date,
  total_count, men_count, women_count, children_count, visitors_count,
  notes, recorded_by
)
SELECT
  t.id,
  'Sunday Service',
  a.service_date::date,
  a.men + a.women + a.children + a.visitors,
  a.men, a.women, a.children, a.visitors,
  a.notes,
  u.id
FROM church_tenants t
JOIN church_users u ON u.church_id = t.id AND u.email = 'pastor@pka.com'
CROSS JOIN (VALUES
  ('2026-06-07', 78, 95, 42, 8,  'Spirit-filled service; guest choir from Suame'),
  ('2026-06-14', 82, 101, 38, 12, 'Father''s Day celebration — strong turnout'),
  ('2026-06-21', 75, 88, 40, 6,  'Mid-rainy season; slightly lower attendance'),
  ('2026-06-28', 90, 110, 48, 15, 'Month-end thanksgiving — packed sanctuary'),
  ('2026-07-05', 85, 98, 45, 10, 'First Sunday of July; Holy Communion'),
  ('2026-07-12', 88, 105, 50, 11, 'Youth-led worship segment'),
  ('2026-07-19', 92, 112, 52, 14, 'Outreach report Sunday'),
  ('2026-07-26', 95, 118, 55, 18, 'Combined service with visiting pastors')
) AS a(service_date, men, women, children, visitors, notes)
WHERE t.slug = 'pka'
  AND NOT EXISTS (
    SELECT 1 FROM church_attendance ca
    WHERE ca.church_id = t.id
      AND ca.service_date = a.service_date::date
      AND ca.service_type = 'Sunday Service'
  );

-- Member check-ins for the most recent Sunday
INSERT INTO church_member_attendance (church_id, attendance_id, member_id, checked_in_at)
SELECT t.id, ca.id, m.id, ca.service_date + TIME '08:45'
FROM church_tenants t
JOIN church_attendance ca ON ca.church_id = t.id
  AND ca.service_date = '2026-07-26'
  AND ca.service_type = 'Sunday Service'
JOIN church_members m ON m.church_id = t.id
WHERE t.slug = 'pka'
  AND m.member_number IN ('PKA-0001','PKA-0002','PKA-0003','PKA-0004','PKA-0005','PKA-0007','PKA-0008')
ON CONFLICT (attendance_id, member_id) DO NOTHING;

-- ============================================================
-- GIVING RECORDS
-- ============================================================

INSERT INTO church_giving (
  church_id, member_id, giving_type, amount, currency, payment_method,
  mobile_money_ref, service_date, notes, recorded_by, receipt_number
)
SELECT
  t.id,
  m.id,
  g.giving_type,
  g.amount,
  'GHS',
  g.payment_method,
  g.mobile_money_ref,
  g.service_date::date,
  g.notes,
  u.id,
  g.receipt_number
FROM church_tenants t
JOIN church_users u ON u.church_id = t.id AND u.email = 'finance@pka.com'
CROSS JOIN (VALUES
  ('akosua-mensah', 'Tithe', 200.00, 'MTN Mobile Money', 'MTN48291033', '2026-07-26', 'July tithe', 'CNV-20260726-0001'),
  ('kwame-asante', 'Tithe', 350.00, 'Cash', NULL::text, '2026-07-26', NULL::text, 'CNV-20260726-0002'),
  ('abena-boateng', 'Offering', 50.00, 'Vodafone Cash', 'VOD77120345', '2026-07-26', NULL::text, 'CNV-20260726-0003'),
  ('emmanuel-ofori', 'Tithe', 180.00, 'MTN Mobile Money', 'MTN55910288', '2026-07-26', NULL::text, 'CNV-20260726-0004'),
  ('ama-darko', 'Thanksgiving', 500.00, 'Bank Transfer', 'GTB-TRX-88921', '2026-07-26', 'Business breakthrough thanksgiving', 'CNV-20260726-0005'),
  ('yaw-owusu', 'Offering', 30.00, 'Cash', NULL::text, '2026-07-26', NULL::text, 'CNV-20260726-0006'),
  ('akosua-mensah', 'Building Fund', 100.00, 'AirtelTigo Money', 'ATG334 Remittance', '2026-07-19', 'Auditorium expansion', 'CNV-20260719-0001'),
  ('kofi-mensah', 'Tithe', 400.00, 'Bank Transfer', 'GCB-882910', '2026-07-19', NULL::text, 'CNV-20260719-0002'),
  ('efua-addo', 'Offering', 20.00, 'Cash', NULL::text, '2026-07-19', NULL::text, 'CNV-20260719-0003'),
  ('kwame-asante', 'Mission Fund', 150.00, 'MTN Mobile Money', 'MTN66120411', '2026-07-12', 'Northern outreach', 'CNV-20260712-0001'),
  ('abena-boateng', 'Tithe', 220.00, 'Vodafone Cash', 'VOD88211900', '2026-07-12', NULL::text, 'CNV-20260712-0002'),
  ('ama-darko', 'Donation', 300.00, 'Cash', NULL::text, '2026-07-05', 'Welfare support gift', 'CNV-20260705-0001'),
  ('emmanuel-ofori', 'Offering', 40.00, 'MTN Mobile Money', 'MTN44120987', '2026-07-05', NULL::text, 'CNV-20260705-0002'),
  ('yaw-owusu', 'Tithe', 100.00, 'Cash', NULL::text, '2026-06-28', NULL::text, 'CNV-20260628-0001'),
  ('akosua-mensah', 'Offering', 50.00, 'MTN Mobile Money', 'MTN99120334', '2026-06-28', NULL::text, 'CNV-20260628-0002')
) AS g(member_slug, giving_type, amount, payment_method, mobile_money_ref, service_date, notes, receipt_number)
JOIN church_members m ON m.church_id = t.id AND m.marketplace_slug = g.member_slug
WHERE t.slug = 'pka'
ON CONFLICT (receipt_number) DO NOTHING;

-- ============================================================
-- EXPENSES
-- ============================================================

INSERT INTO church_expenses (
  church_id, category, description, amount, currency, payment_method,
  expense_date, approved_by, recorded_by
)
SELECT
  t.id,
  e.category,
  e.description,
  e.amount,
  'GHS',
  e.payment_method,
  e.expense_date::date,
  pastor.id,
  finance.id
FROM church_tenants t
JOIN church_users pastor ON pastor.church_id = t.id AND pastor.email = 'pastor@pka.com'
JOIN church_users finance ON finance.church_id = t.id AND finance.email = 'finance@pka.com'
CROSS JOIN (VALUES
  ('Utilities', 'ECG electricity bill — June 2026', 850.00, 'Bank Transfer', '2026-07-02'),
  ('Utilities', 'Ghana Water Company — Q2 bill', 320.00, 'Cash', '2026-07-03'),
  ('Transport', 'Fuel for pastoral visitation van', 450.00, 'Cash', '2026-07-08'),
  ('Stationery', 'Printing of Sunday bulletins and envelopes', 180.00, 'Cash', '2026-07-10'),
  ('Maintenance', 'Sound system mixer repair (Suame)', 600.00, 'MTN Mobile Money', '2026-07-14'),
  ('Salaries', 'Part-time caretaker stipend — July', 800.00, 'Bank Transfer', '2026-07-20'),
  ('Events', 'Youth camp deposit — Aburi', 1200.00, 'Bank Transfer', '2026-07-22'),
  ('Other', 'MoMo charges and bank fees', 45.00, 'Cash', '2026-07-25')
) AS e(category, description, amount, payment_method, expense_date)
WHERE t.slug = 'pka'
  AND NOT EXISTS (
    SELECT 1 FROM church_expenses ce
    WHERE ce.church_id = t.id
      AND ce.description = e.description
      AND ce.expense_date = e.expense_date::date
  );

-- ============================================================
-- EVENTS (upcoming)
-- ============================================================

INSERT INTO church_events (
  church_id, title, description, event_type,
  start_datetime, end_datetime, location, is_public, created_by
)
SELECT
  t.id,
  e.title,
  e.description,
  e.event_type,
  e.start_datetime::timestamp,
  e.end_datetime::timestamp,
  e.location,
  true,
  u.id
FROM church_tenants t
JOIN church_users u ON u.church_id = t.id AND u.email = 'pastor@pka.com'
CROSS JOIN (VALUES
  (
    'All-Night Prayer Vigil',
    'Join us for a night of worship, intercession, and prophetic declaration for Kumasi and our members'' businesses.',
    'Service',
    '2026-08-01 21:00:00',
    '2026-08-02 05:00:00',
    'Main Auditorium, Adum'
  ),
  (
    'Youth Leadership Summit',
    'A one-day summit for youth leaders across Ashanti Region — workshops on faith, career, and entrepreneurship.',
    'Youth',
    '2026-08-09 09:00:00',
    '2026-08-09 16:00:00',
    'Youth Hall, Pentecost Assembly Kumasi'
  ),
  (
    'Community Outreach — Bantama Market',
    'Medical screening, food packs, and gospel sharing at Bantama Market. Volunteers needed from Welfare and Ushering.',
    'Outreach',
    '2026-08-16 07:00:00',
    '2026-08-16 13:00:00',
    'Bantama Market Square'
  ),
  (
    'Marriage Enrichment Weekend',
    'Couples retreat covering communication, finances, and spiritual intimacy. Facilitated by Pastor Kwesi and Mama Akosua.',
    'Conference',
    '2026-08-22 08:30:00',
    '2026-08-23 15:00:00',
    'Miklin Hotel, Kumasi'
  ),
  (
    'Worship Night: Songs of Zion',
    'An evening of praise led by the Choir Department featuring Ghanaian gospel classics and new songs.',
    'Social',
    '2026-09-05 18:00:00',
    '2026-09-05 21:00:00',
    'Main Auditorium, Adum'
  )
) AS e(title, description, event_type, start_datetime, end_datetime, location)
WHERE t.slug = 'pka'
  AND NOT EXISTS (
    SELECT 1 FROM church_events ce
    WHERE ce.church_id = t.id AND ce.title = e.title
  );

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================

INSERT INTO church_announcements (
  church_id, title, body, audience, department_id, is_pinned, publish_date, created_by
)
SELECT
  t.id,
  a.title,
  a.body,
  a.audience,
  CASE WHEN a.dept_name IS NOT NULL THEN d.id ELSE NULL END,
  a.is_pinned,
  a.publish_date::date,
  u.id
FROM church_tenants t
JOIN church_users u ON u.church_id = t.id AND u.email = 'pastor@pka.com'
CROSS JOIN (VALUES
  (
    'Welcome to ChristNerve!',
    'Beloved saints, we are now using ChristNerve to manage membership, giving, and our member marketplace. Update your details with the church office and list your business so the congregation can support you.',
    'all', NULL::text, true, '2026-07-20'
  ),
  (
    'Choir Rehearsal — This Saturday',
    'All choir members should report for rehearsal this Saturday at 4:00 PM sharp. We will prepare for Worship Night: Songs of Zion.',
    'department', 'Choir', true, '2026-07-24'
  ),
  (
    'Building Fund Update',
    'Praise God — we have raised GHS 48,500 toward the auditorium expansion. Target remains GHS 120,000. Please continue to give via MoMo or cash at the finance desk.',
    'all', NULL::text, true, '2026-07-19'
  ),
  (
    'Youth Camp Registration Open',
    'Registration is open for the Aburi Youth Camp (August). Fee is GHS 150. See Sister Efua Addo or any Youth Department leader.',
    'members', NULL::text, false, '2026-07-18'
  ),
  (
    'Blood Donation Drive',
    'In partnership with Komfo Anokye Teaching Hospital, we will host a blood donation drive on 30 July after the second service. Please eat well and come hydrated.',
    'all', NULL::text, false, '2026-07-22'
  )
) AS a(title, body, audience, dept_name, is_pinned, publish_date)
LEFT JOIN church_departments d ON d.church_id = t.id AND d.name = a.dept_name
WHERE t.slug = 'pka'
  AND NOT EXISTS (
    SELECT 1 FROM church_announcements ca
    WHERE ca.church_id = t.id AND ca.title = a.title
  );

-- ============================================================
-- MARKET LISTINGS
-- ============================================================

INSERT INTO market_listings (
  church_id, member_id, category_id, title, description,
  price_min, price_max, price_label, location, whatsapp, phone,
  is_active, is_featured, views_count, slug
)
SELECT
  t.id,
  m.id,
  c.id,
  l.title,
  l.description,
  l.price_min,
  l.price_max,
  l.price_label,
  l.location,
  m.whatsapp,
  m.phone,
  true,
  l.is_featured,
  l.views_count,
  l.slug
FROM church_tenants t
CROSS JOIN (VALUES
  (
    'akosua-mensah', 'fashion',
    'Akosua''s Kente Collection',
    'Handwoven and machine-assisted Kente stoles, dress fabrics, and custom wedding packages. Pieces sourced from Bonwire and woven to order. Perfect for naming ceremonies, weddings, and church anniversaries.',
    80.00, 350.00, 'GHS 80 – 350', 'Santasi, Kumasi', true, 142,
    'akosua-kente-collection-1'
  ),
  (
    'emmanuel-ofori', 'electronics',
    'Emmanuel''s Phone Repairs',
    'Screen replacements, battery swaps, software unlocks, and charging-port repairs for Android and iPhone. Same-day service for most jobs at Suame Magazine. Genuine and quality aftermarket parts available.',
    50.00, NULL::numeric, 'From GHS 50', 'Suame, Kumasi', true, 218,
    'emmanuel-phone-repairs-4'
  ),
  (
    'abena-boateng', 'photography',
    'Abena Photography',
    'Wedding, engagement, naming ceremony, and corporate event photography across Ashanti Region. Natural light portraits and full-day packages. Soft edits delivered within 7–14 days.',
    500.00, NULL::numeric, 'From GHS 500', 'Ayeduase, Kumasi', true, 96,
    'abena-photography-3'
  ),
  (
    'kwame-asante', 'food',
    'Fresh Produce by Kwame',
    'Farm-fresh garden eggs, tomatoes, kontomire, plantain, and seasonal fruits delivered weekly to Adum and Bantama. Bulk orders for chop bars and catering welcome.',
    5.00, 30.00, 'GHS 5 – 30', 'Bantama, Kumasi', true, 175,
    'fresh-produce-by-kwame-2'
  ),
  (
    'ama-darko', 'catering',
    'Ama''s Homestyle Catering',
    'Jollof, waakye, banku & tilapia, and full buffet packages for funerals, weddings, and church programmes. Hygienic kitchen in Asokwa. Tasting sessions available on request.',
    25.00, 80.00, 'GHS 25 – 80 / plate', 'Asokwa, Kumasi', true, 88,
    'ama-homestyle-catering-5'
  ),
  (
    'yaw-owusu', 'design',
    'Yaw Creative — Church & Brand Design',
    'Flyers, Sunday programme covers, logos, and social media creatives for churches and small businesses. Fast turnaround. Soft copies and print-ready files included.',
    80.00, 400.00, 'GHS 80 – 400', 'Ahodwo, Kumasi', false, 54,
    'yaw-creative-design-8'
  ),
  (
    'kofi-mensah', 'construction',
    'Kofi Mensah Building Works',
    'Residential renovations, tiling, roofing, and small commercial fit-outs in Kumasi and surrounding towns. Free site inspection within Greater Kumasi.',
    500.00, NULL::numeric, 'From GHS 500 (quote)', 'Tafo, Kumasi', false, 41,
    'kofi-building-works-6'
  ),
  (
    'efua-addo', 'education',
    'Efua''s BECE & WASSCE Tutoring',
    'Home and group tutoring for JHS and SHS students — Maths, English, and Integrated Science. Evening and weekend slots in Patasi and Adum.',
    40.00, 80.00, 'GHS 40 – 80 / session', 'Patasi, Kumasi', false, 67,
    'efua-tutoring-7'
  )
) AS l(
  member_slug, category_slug, title, description,
  price_min, price_max, price_label, location, is_featured, views_count, slug
)
JOIN church_members m ON m.church_id = t.id AND m.marketplace_slug = l.member_slug
JOIN market_categories c ON c.slug = l.category_slug
WHERE t.slug = 'pka'
ON CONFLICT (slug) DO UPDATE SET
  member_id = EXCLUDED.member_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max,
  price_label = EXCLUDED.price_label,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- ============================================================
-- LISTING IMAGES (Unsplash)
-- ============================================================

INSERT INTO market_listing_images (listing_id, image_url, is_primary, display_order)
SELECT ml.id, img.image_url, img.is_primary, img.display_order
FROM market_listings ml
JOIN (VALUES
  ('akosua-kente-collection-1', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', true, 0),
  ('akosua-kente-collection-1', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', false, 1),
  ('emmanuel-phone-repairs-4', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80', true, 0),
  ('abena-photography-3', 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=600&q=80', true, 0),
  ('fresh-produce-by-kwame-2', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80', true, 0),
  ('ama-homestyle-catering-5', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80', true, 0),
  ('ama-homestyle-catering-5', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80', false, 1),
  ('yaw-creative-design-8', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', true, 0),
  ('kofi-building-works-6', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', true, 0),
  ('efua-tutoring-7', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', true, 0),
  ('yaw-creative-design-8', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80', false, 1)
) AS img(listing_slug, image_url, is_primary, display_order)
  ON ml.slug = img.listing_slug
WHERE NOT EXISTS (
  SELECT 1 FROM market_listing_images mi
  WHERE mi.listing_id = ml.id AND mi.image_url = img.image_url
);

-- ============================================================
-- MARKET REVIEWS
-- ============================================================

INSERT INTO market_reviews (listing_id, reviewer_member_id, rating, comment)
SELECT
  ml.id,
  reviewer.id,
  r.rating,
  r.comment
FROM (VALUES
  ('akosua-kente-collection-1', 'ama-darko', 5, 'Beautiful Kente for my sister''s wedding. Delivered on time and the colours were exactly as described.'),
  ('akosua-kente-collection-1', 'efua-addo', 5, 'Akosua is gifted. Bought a stole for church anniversary — everyone asked where I got it.'),
  ('emmanuel-phone-repairs-4', 'kwame-asante', 5, 'Fixed my screen in under two hours at Suame. Fair price and honest advice.'),
  ('emmanuel-phone-repairs-4', 'yaw-owusu', 4, 'Good work on my charging port. Slight delay because of parts, but quality was solid.'),
  ('abena-photography-3', 'akosua-mensah', 5, 'Abena captured our naming ceremony perfectly. Soft edits, no stress.'),
  ('fresh-produce-by-kwame-2', 'ama-darko', 5, 'I buy tomatoes and garden eggs weekly for catering. Always fresh.'),
  ('ama-homestyle-catering-5', 'kofi-mensah', 5, 'Catered our family thanksgiving — jollof was excellent and service was orderly.'),
  ('efua-tutoring-7', 'abena-boateng', 4, 'My niece''s Maths improved after a month with Efua. Patient and well organised.')
) AS r(listing_slug, reviewer_slug, rating, comment)
JOIN market_listings ml ON ml.slug = r.listing_slug
JOIN church_members seller ON seller.id = ml.member_id
JOIN church_members reviewer ON reviewer.marketplace_slug = r.reviewer_slug
  AND reviewer.church_id = seller.church_id
ON CONFLICT (listing_id, reviewer_member_id) DO NOTHING;

-- ============================================================
-- Done
-- ============================================================
-- Demo login (PKA):
--   pastor@pka.com / password123  (role: pastor)
--   finance@pka.com / password123 (role: finance)
--   admin@pka.com / password123   (role: admin)
-- Super admin: configured via SUPERADMIN_* env vars (not seeded here)
