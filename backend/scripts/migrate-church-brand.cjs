require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'database', 'migrate-church-brand.sql'),
    'utf8'
  );
  await db.query(sql);
  console.log('Church brand + username columns ready');
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
