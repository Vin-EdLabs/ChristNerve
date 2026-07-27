require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'database', 'migrate-pwa.sql'),
    'utf8'
  );
  await db.query(sql);
  console.log('PWA columns ready (brand_color, short_name)');
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
