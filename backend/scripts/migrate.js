/**
 * Production-safe DB migrate + demo market seed.
 * Runs from backend: npm run migrate  |  npm run build
 *
 * Ownership: if you see "must be owner of table", run once as postgres:
 *   sudo -u postgres psql -d christnerve -f database/migrate-fix-ownership.sql
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
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

function databaseDir() {
  const candidates = [
    path.join(__dirname, '../../database'),
    path.join(__dirname, '../database'),
    path.join(process.cwd(), '../database'),
    path.join(process.cwd(), 'database'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function isOwnerError(err) {
  const msg = String(err && err.message ? err.message : err);
  const code = err && err.code;
  return code === '42501' || /must be owner of/i.test(msg);
}

async function runFile(client, file) {
  if (!fs.existsSync(file)) {
    console.log('  skip (missing):', path.basename(file));
    return { ok: true, skipped: true };
  }
  console.log('==>', path.basename(file));
  const sql = fs.readFileSync(file, 'utf8');
  await client.query(sql);
  return { ok: true };
}

async function main() {
  const backendRoot = path.resolve(__dirname, '..');
  loadEnvFile(path.join(backendRoot, '.env'));

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[migrate] DATABASE_URL missing — skip');
    process.exit(0);
  }

  const dbDir = databaseDir();
  const seedDemo =
    process.env.SEED_DEMO === '1' ||
    process.env.CHRISTNERVE_SEED_DEMO === '1';

  const files = [
    'migrate-hotfix-visit-columns.sql',
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
    'migrate-church-life.sql',
    'migrate-demo-market-20.sql',
  ];

  if (seedDemo) {
    files.splice(files.length - 1, 0, 'seed.sql');
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('[migrate] connected');
  console.log('[migrate] database dir:', dbDir);
  console.log('[migrate] seed demo:', seedDemo);

  let ownerErrors = 0;
  let hardFail = null;

  for (const name of files) {
    try {
      await runFile(client, path.join(dbDir, name));
    } catch (err) {
      console.error(`[migrate] FAILED ${name}:`, err.message || err);
      if (isOwnerError(err)) {
        ownerErrors += 1;
        console.error(
          '[migrate] HINT: run as postgres → sudo -u postgres psql -d christnerve -f database/migrate-fix-ownership.sql'
        );
        continue;
      }
      // Keep going for most files; remember first hard failure on demo market
      if (name === 'migrate-demo-market-20.sql' || name === 'seed.sql') {
        hardFail = err;
      }
    }
  }

  const pka = await client.query(
    `SELECT id, slug, name FROM church_tenants WHERE slug = 'pka'`
  );
  console.log('[migrate] PKA:', pka.rows[0] || 'NOT FOUND');

  const listings = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM market_listings ml
     JOIN church_tenants t ON t.id = ml.church_id
     WHERE t.slug = 'pka' AND ml.is_active`
  );
  console.log('[migrate] active PKA listings:', listings.rows[0]?.n ?? 0);

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'church_tenants'
       AND column_name = ANY($1::text[])
     ORDER BY 1`,
    [
      [
        'visit_welcome',
        'visit_hero_url',
        'youtube_url',
        'brand_color',
        'short_name',
      ],
    ]
  );
  console.log(
    '[migrate] columns OK:',
    cols.rows.map((r) => r.column_name).join(', ')
  );

  await client.end();

  if (ownerErrors > 0) {
    console.error(
      `[migrate] ${ownerErrors} migration(s) skipped due to table ownership. Fix ownership then re-run: SEED_DEMO=1 npm run migrate`
    );
    process.exit(1);
  }

  if (hardFail) {
    console.error('[migrate] demo seed failed:', hardFail.message || hardFail);
    process.exit(1);
  }

  console.log('[migrate] done');
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
