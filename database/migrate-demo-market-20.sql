-- ============================================================
-- Demo marketplace: ~20 attractive product listings for PKA
-- Shirts, books, food, drinks, and more
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
  -- Fashion / shirts
  (
    'akosua-mensah', 'fashion',
    'ChristNerve Polo Shirts',
    'Soft cotton church polo shirts in navy, white, and charcoal. Embroidered logo options for departments and cell groups. Adult and youth sizes S–3XL.',
    75.00, 120.00, 'GHS 75 – 120', 'Santasi, Kumasi', true, 210,
    'demo-christnerve-polo-shirts'
  ),
  (
    'akosua-mensah', 'fashion',
    'Sunday Best Men''s Shirts',
    'Crisp long-sleeve dress shirts perfect for ushers and choir. Breathable fabric, easy-care finish. White, sky blue, and soft grey in stock.',
    90.00, 150.00, 'GHS 90 – 150', 'Santasi, Kumasi', true, 168,
    'demo-sunday-best-mens-shirts'
  ),
  (
    'akosua-mensah', 'fashion',
    'Ladies Praise Wear Tops',
    'Modest, elegant tops for worship and conferences. Flowy chiffon and soft jersey blends. Custom colours for women''s ministry events.',
    65.00, 140.00, 'GHS 65 – 140', 'Santasi, Kumasi', false, 95,
    'demo-ladies-praise-wear-tops'
  ),
  (
    'akosua-mensah', 'fashion',
    'Kids Ministry T-Shirts',
    'Bright, durable kids tees with fun scripture prints. Ideal for children''s church, camps, and outreach. Ages 2–14.',
    35.00, 55.00, 'GHS 35 – 55', 'Santasi, Kumasi', false, 132,
    'demo-kids-ministry-tshirts'
  ),

  -- Books / education
  (
    'efua-addo', 'education',
    'Daily Devotional Book Bundle',
    'A curated set of morning devotionals and prayer journals for individuals and families. Softcover and hardcover options available.',
    40.00, 95.00, 'GHS 40 – 95', 'Patasi, Kumasi', true, 187,
    'demo-daily-devotional-bundle'
  ),
  (
    'efua-addo', 'education',
    'Bible Study Workbooks',
    'Small-group study guides covering Gospels, Psalms, and discipleship foundations. Perfect for cell groups and new believers classes.',
    25.00, 60.00, 'GHS 25 – 60', 'Patasi, Kumasi', true, 154,
    'demo-bible-study-workbooks'
  ),
  (
    'efua-addo', 'education',
    'Children''s Bible Story Books',
    'Colourful illustrated Bible stories for ages 3–10. Large print, durable covers — great gifts for Sunday school prizes.',
    20.00, 45.00, 'GHS 20 – 45', 'Patasi, Kumasi', false, 121,
    'demo-childrens-bible-stories'
  ),
  (
    'yaw-owusu', 'education',
    'Worship Songbook & Chord Charts',
    'Printed songbooks with lyrics and guitar/piano chords for popular worship songs used in Ghanaian churches.',
    50.00, 80.00, 'GHS 50 – 80', 'Ahodwo, Kumasi', false, 76,
    'demo-worship-songbook'
  ),

  -- Food
  (
    'kwame-asante', 'food',
    'Fresh Farm Produce Box',
    'Weekly box of garden eggs, tomatoes, kontomire, plantain, and seasonal fruits. Delivered to Adum, Bantama, and KNUST area.',
    40.00, 90.00, 'GHS 40 – 90 / box', 'Bantama, Kumasi', true, 240,
    'demo-fresh-farm-produce-box'
  ),
  (
    'ama-darko', 'food',
    'Homemade Jollof Rice Packs',
    'Party-size jollof with chicken or fish. Hygienic kitchen packaging for office lunch, fellowship meetings, and family gatherings.',
    30.00, 55.00, 'GHS 30 – 55 / pack', 'Asokwa, Kumasi', true, 305,
    'demo-homemade-jollof-packs'
  ),
  (
    'ama-darko', 'food',
    'Waakye & Shito Combo',
    'Authentic waakye with spicy homemade shito, boiled egg, and salad. Weekend specials — order by Friday evening.',
    25.00, 40.00, 'GHS 25 – 40', 'Asokwa, Kumasi', false, 198,
    'demo-waakye-shito-combo'
  ),
  (
    'ama-darko', 'catering',
    'Church Fellowship Snack Platters',
    'Assorted meat pies, spring rolls, sausage rolls, and mini sandwiches for after-service fellowship and committee meetings.',
    120.00, 350.00, 'GHS 120 – 350', 'Asokwa, Kumasi', true, 142,
    'demo-fellowship-snack-platters'
  ),

  -- Drinks
  (
    'ama-darko', 'food',
    'Fresh Fruit Juice Station',
    'Pineapple, watermelon, orange, and ginger drinks — freshly blended for programmes. Bottled takeaway or on-site dispensers.',
    8.00, 15.00, 'GHS 8 – 15 / cup', 'Asokwa, Kumasi', true, 267,
    'demo-fresh-fruit-juice'
  ),
  (
    'kwame-asante', 'food',
    'Sobolo & Ginger Drink Packs',
    'Refreshing sobolo (hibiscus) and spicy ginger drinks in sealed bottles. Ideal for youth events and outreach.',
    10.00, 18.00, 'GHS 10 – 18', 'Bantama, Kumasi', false, 176,
    'demo-sobolo-ginger-packs'
  ),
  (
    'kwame-asante', 'food',
    'Premium Palm Wine & Soft Drinks',
    'Chilled soft drinks crate and traditional palm wine for celebrations (naming, thanksgiving). Pre-order required.',
    50.00, 200.00, 'GHS 50 – 200', 'Bantama, Kumasi', false, 88,
    'demo-drinks-crate-pack'
  ),

  -- Beauty / other nice items
  (
    'abena-boateng', 'beauty',
    'Natural Shea Body Care Set',
    'Pure shea butter, body cream, and lip balm set. Unscented and lightly scented options. Lovely gift for mothers and visitors.',
    45.00, 95.00, 'GHS 45 – 95', 'Ayeduase, Kumasi', true, 113,
    'demo-shea-body-care-set'
  ),
  (
    'abena-boateng', 'beauty',
    'Hair Care Oils & Bonnets',
    'Nourishing hair oils, satin bonnets, and edge control for natural and relaxed hair. Popular with the women''s fellowship.',
    20.00, 70.00, 'GHS 20 – 70', 'Ayeduase, Kumasi', false, 99,
    'demo-hair-care-oils-bonnets'
  ),

  -- Electronics / other
  (
    'emmanuel-ofori', 'electronics',
    'Bluetooth Speakers for Home Worship',
    'Portable Bluetooth speakers great for home cell meetings and personal worship. USB charge, clear bass, one-year local warranty.',
    150.00, 320.00, 'GHS 150 – 320', 'Suame, Kumasi', true, 84,
    'demo-bluetooth-speakers'
  ),
  (
    'emmanuel-ofori', 'electronics',
    'Phone Accessories Bundle',
    'Quality chargers, earphones, tempered glass, and power banks. Same-day pickup at Suame Magazine.',
    15.00, 120.00, 'GHS 15 – 120', 'Suame, Kumasi', false, 201,
    'demo-phone-accessories-bundle'
  ),

  -- Photography / misc
  (
    'abena-boateng', 'photography',
    'Family Portrait Mini Sessions',
    '30-minute outdoor or church-yard family portraits. Soft edits, digital gallery, and print options for Christmas and Easter.',
    250.00, 450.00, 'GHS 250 – 450', 'Ayeduase, Kumasi', true, 72,
    'demo-family-portrait-sessions'
  ),
  (
    'yaw-owusu', 'design',
    'Custom Church Tote Bags',
    'Canvas tote bags printed with your church name or event theme. Great for conferences, women''s retreats, and book clubs.',
    35.00, 55.00, 'GHS 35 – 55', 'Ahodwo, Kumasi', false, 64,
    'demo-custom-church-tote-bags'
  ),
  (
    'kofi-mensah', 'other',
    'Handmade Wooden Cross Decor',
    'Beautiful handcrafted wooden crosses and wall plaques for homes and offices. Custom engraving of favourite verses available.',
    40.00, 180.00, 'GHS 40 – 180', 'Tafo, Kumasi', false, 58,
    'demo-wooden-cross-decor'
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
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max,
  price_label = EXCLUDED.price_label,
  location = EXCLUDED.location,
  is_featured = EXCLUDED.is_featured,
  views_count = EXCLUDED.views_count,
  is_active = true,
  updated_at = NOW();

-- Images (reliable Unsplash product photos)
INSERT INTO market_listing_images (listing_id, image_url, is_primary, display_order)
SELECT ml.id, img.image_url, img.is_primary, img.display_order
FROM market_listings ml
JOIN (VALUES
  ('demo-christnerve-polo-shirts', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-sunday-best-mens-shirts', 'https://images.unsplash.com/photo-1596755094514-f87e34085b85?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-ladies-praise-wear-tops', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-kids-ministry-tshirts', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-daily-devotional-bundle', 'https://images.unsplash.com/photo-1504052434569-70ca80d6ac81?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-bible-study-workbooks', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-childrens-bible-stories', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-worship-songbook', 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-fresh-farm-produce-box', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-homemade-jollof-packs', 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-waakye-shito-combo', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-fellowship-snack-platters', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-fresh-fruit-juice', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-sobolo-ginger-packs', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-drinks-crate-pack', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-shea-body-care-set', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-hair-care-oils-bonnets', 'https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-bluetooth-speakers', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-phone-accessories-bundle', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-family-portrait-sessions', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-custom-church-tote-bags', 'https://images.unsplash.com/photo-1590874103328-eac38a67437f?auto=format&fit=crop&w=800&q=80', true, 0),
  ('demo-wooden-cross-decor', 'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&w=800&q=80', true, 0)
) AS img(listing_slug, image_url, is_primary, display_order)
  ON ml.slug = img.listing_slug
WHERE NOT EXISTS (
  SELECT 1 FROM market_listing_images mi WHERE mi.listing_id = ml.id
);

-- Refresh primary images if rows already existed with older URLs
UPDATE market_listing_images i
SET image_url = v.image_url
FROM market_listings ml
JOIN (VALUES
  ('demo-christnerve-polo-shirts', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'),
  ('demo-sunday-best-mens-shirts', 'https://images.unsplash.com/photo-1596755094514-f87e34085b85?auto=format&fit=crop&w=800&q=80'),
  ('demo-ladies-praise-wear-tops', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80'),
  ('demo-kids-ministry-tshirts', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80'),
  ('demo-daily-devotional-bundle', 'https://images.unsplash.com/photo-1504052434569-70ca80d6ac81?auto=format&fit=crop&w=800&q=80'),
  ('demo-bible-study-workbooks', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80'),
  ('demo-childrens-bible-stories', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'),
  ('demo-worship-songbook', 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80'),
  ('demo-fresh-farm-produce-box', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80'),
  ('demo-homemade-jollof-packs', 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80'),
  ('demo-waakye-shito-combo', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'),
  ('demo-fellowship-snack-platters', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'),
  ('demo-fresh-fruit-juice', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=800&q=80'),
  ('demo-sobolo-ginger-packs', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80'),
  ('demo-drinks-crate-pack', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80'),
  ('demo-shea-body-care-set', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80'),
  ('demo-hair-care-oils-bonnets', 'https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=800&q=80'),
  ('demo-bluetooth-speakers', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80'),
  ('demo-phone-accessories-bundle', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'),
  ('demo-family-portrait-sessions', 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80'),
  ('demo-custom-church-tote-bags', 'https://images.unsplash.com/photo-1590874103328-eac38a67437f?auto=format&fit=crop&w=800&q=80'),
  ('demo-wooden-cross-decor', 'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&w=800&q=80')
) AS v(listing_slug, image_url) ON ml.slug = v.listing_slug
WHERE i.listing_id = ml.id AND i.is_primary = true;
