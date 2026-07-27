/**
 * One-shot local DB bootstrap for ChristNerve.
 * Creates the database if missing, then applies schema.sql + seed.sql.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL is not set');
  }

  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, '') || 'christnerve';

  const adminUrl = new URL(base);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName]
  );

  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log('created database', dbName);
  } else {
    console.log('database exists', dbName);
  }
  await admin.end();

  const db = new Client({ connectionString: base });
  await db.connect();

  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const seedPath = path.join(__dirname, '..', '..', 'database', 'seed.sql');

  await db.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('schema applied');

  await db.query(fs.readFileSync(seedPath, 'utf8'));
  console.log('seed applied');

  const churches = await db.query(
    'SELECT name, slug FROM church_tenants ORDER BY id'
  );
  console.log(
    'churches:',
    churches.rows.map((r) => r.slug).join(', ')
  );

  await db.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
