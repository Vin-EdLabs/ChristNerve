const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:password@localhost:5432/christnerve',
  });
  await c.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '../../database/migrate-demo-market-20.sql'),
    'utf8'
  );
  await c.query(sql);
  const r = await c.query(
    `SELECT COUNT(*)::int AS n
     FROM market_listings ml
     JOIN church_tenants t ON t.id = ml.church_id
     WHERE t.slug = 'pka' AND ml.is_active`
  );
  console.log('active listings:', r.rows[0].n);
  const sample = await c.query(
    `SELECT ml.title, ml.slug
     FROM market_listings ml
     JOIN church_tenants t ON t.id = ml.church_id
     WHERE t.slug = 'pka' AND ml.slug LIKE 'demo-%'
     ORDER BY ml.title`
  );
  console.log('demo items:', sample.rows.length);
  sample.rows.forEach((row) => console.log(' -', row.title));
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
