require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'database', 'migrate-member-auth.sql'),
    'utf8'
  );
  await db.query(sql);
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM church_members WHERE password_hash IS NOT NULL`
  );
  console.log('members with login:', r.rows[0].n);
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
