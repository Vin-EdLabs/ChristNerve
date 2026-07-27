const { Client } = require('pg');

/** Reliable Unsplash product photos (auto=format). */
const BY_SLUG = {
  'demo-christnerve-polo-shirts':
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
  'demo-sunday-best-mens-shirts':
    'https://images.unsplash.com/photo-1596755094514-f87e34085b85?auto=format&fit=crop&w=800&q=80',
  'demo-ladies-praise-wear-tops':
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80',
  'demo-kids-ministry-tshirts':
    'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80',
  'demo-daily-devotional-bundle':
    'https://images.unsplash.com/photo-1504052434569-70ca80d6ac81?auto=format&fit=crop&w=800&q=80',
  'demo-bible-study-workbooks':
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80',
  'demo-childrens-bible-stories':
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
  'demo-worship-songbook':
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80',
  'demo-fresh-farm-produce-box':
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'demo-homemade-jollof-packs':
    'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80',
  'demo-waakye-shito-combo':
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'demo-fellowship-snack-platters':
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  'demo-fresh-fruit-juice':
    'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=800&q=80',
  'demo-sobolo-ginger-packs':
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
  'demo-drinks-crate-pack':
    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
  'demo-shea-body-care-set':
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
  'demo-hair-care-oils-bonnets':
    'https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=800&q=80',
  'demo-bluetooth-speakers':
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80',
  'demo-phone-accessories-bundle':
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
  'demo-family-portrait-sessions':
    'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80',
  'demo-custom-church-tote-bags':
    'https://images.unsplash.com/photo-1590874103328-eac38a67437f?auto=format&fit=crop&w=800&q=80',
  'demo-wooden-cross-decor':
    'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&w=800&q=80',
  'akosua-kente-collection-1':
    'https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=800&q=80',
  'emmanuel-phone-repairs-4':
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  'abena-photography-3':
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
  'fresh-produce-by-kwame-2':
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'ama-homestyle-catering-5':
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'yaw-creative-design-8':
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80',
  'kofi-building-works-6':
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
  'efua-tutoring-7':
    'https://images.unsplash.com/photo-1456513089-0d3f3b5222f2?auto=format&fit=crop&w=800&q=80',
};

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:password@localhost:5432/christnerve',
  });
  await c.connect();

  let n = 0;
  for (const [slug, url] of Object.entries(BY_SLUG)) {
    const r = await c.query(
      `UPDATE market_listing_images i
       SET image_url = $1
       FROM market_listings ml
       WHERE i.listing_id = ml.id
         AND ml.slug = $2
         AND i.is_primary = true
       RETURNING i.id`,
      [url, slug]
    );
    if (r.rowCount) {
      n += r.rowCount;
      console.log('updated', slug);
    } else {
      // Insert if listing exists but has no image
      const ins = await c.query(
        `INSERT INTO market_listing_images (listing_id, image_url, is_primary, display_order)
         SELECT ml.id, $1, true, 0
         FROM market_listings ml
         WHERE ml.slug = $2
           AND NOT EXISTS (
             SELECT 1 FROM market_listing_images i WHERE i.listing_id = ml.id
           )
         RETURNING id`,
        [url, slug]
      );
      if (ins.rowCount) {
        n += ins.rowCount;
        console.log('inserted', slug);
      } else {
        console.log('skip', slug);
      }
    }
  }

  // Also refresh non-primary duplicates that point at bad portraits
  await c.query(
    `UPDATE market_listing_images i
     SET image_url = $1
     FROM market_listings ml
     WHERE i.listing_id = ml.id
       AND ml.slug IN ('yaw-creative-design-8', 'kofi-building-works-6', 'efua-tutoring-7', 'akosua-kente-collection-1')
       AND i.image_url LIKE '%photo-1507003211169-0a1dd7228f2d%'`,
    [
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
    ]
  );

  console.log('done, rows touched ~', n);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
