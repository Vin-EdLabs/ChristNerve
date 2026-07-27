const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:password@localhost:5432/christnerve',
  });
  await c.connect();
  const r = await c.query(`
    SELECT ml.slug, ml.title,
      (SELECT COUNT(*)::int FROM market_listing_images i WHERE i.listing_id = ml.id) AS img_count,
      (SELECT i.image_url FROM market_listing_images i WHERE i.listing_id = ml.id ORDER BY i.is_primary DESC, i.display_order LIMIT 1) AS primary_url
    FROM market_listings ml
    JOIN church_tenants t ON t.id = ml.church_id
    WHERE t.slug = 'pka' AND ml.is_active
    ORDER BY ml.title
  `);
  for (const row of r.rows) {
    console.log(`${row.img_count} | ${row.slug} | ${row.primary_url || 'NO IMAGE'}`);
  }
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
