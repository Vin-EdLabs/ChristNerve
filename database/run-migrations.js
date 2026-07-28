/**
 * Cross-platform migration runner (Windows/Mac/Linux).
 * Usage:
 *   cd backend && node ../database/run-migrations.js
 *   SEED_DEMO=1 node ../database/run-migrations.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  loadEnvFile(path.join(root, 'backend', '.env'));

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  const files = [
    'migrate-member-auth.sql',
    'migrate-member-login.sql',
    'migrate-church-brand.sql',
    'migrate-pwa.sql',
    'migrate-member-staff-depts-visit.sql',
    'migrate-visit-join.sql',
    'migrate-notifications.sql',
    'migrate-audit.sql',
    'migrate-live-reactions.sql',
    'migrate-market-chat.sql',
    'migrate-market-chat-listing.sql',
    'migrate-pastoral-care.sql',
    'migrate-demo-market-20.sql',
  ];

  if (process.env.SEED_DEMO === '1') {
    files.push('seed.sql');
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('Connected. Running migrations…');

  for (const name of files) {
    const file = path.join(__dirname, name);
    if (!fs.existsSync(file)) {
      console.log('skip (missing):', name);
      continue;
    }
    console.log('==>', name);
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
  }

  const check = await client.query(
    `SELECT slug, name FROM church_tenants WHERE slug = 'pka'`
  );
  console.log('PKA tenant:', check.rows[0] || 'NOT FOUND — run seed.sql');

  const listings = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM market_listings ml
     JOIN church_tenants t ON t.id = ml.church_id
     WHERE t.slug = 'pka' AND ml.is_active`
  );
  console.log('Active PKA listings:', listings.rows[0]?.n ?? 0);

  // Verify columns used by /api/public/church/:slug
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'church_tenants'
         AND column_name = ANY($1::text[])
     ORDER BY column_name`,
    [['visit_hero_url', 'youtube_url', 'visit_welcome', 'brand_color', 'short_name']]
  );
  console.log(
    'Required columns present:',
    cols.rows.map((r) => r.column_name).join(', ') || '(none — migration failed?)'
  );

  const gallery = await client.query(
    `SELECT to_regclass('public.church_gallery_images') AS t`
  );
  console.log('church_gallery_images:', gallery.rows[0]?.t || 'MISSING');

  await client.end();
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
