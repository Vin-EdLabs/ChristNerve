require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'database', 'migrate-member-login.sql'),
    'utf8'
  );
  await db.query(sql);
  // Mark existing passworded members as credentials_set
  await db.query(
    `UPDATE church_members
     SET credentials_set = true
     WHERE password_hash IS NOT NULL AND credentials_set IS DISTINCT FROM true`
  );
  await db.query(
    `UPDATE church_members
     SET member_role = COALESCE(NULLIF(member_role, ''), 'member')
     WHERE member_role IS NULL OR member_role = ''`
  );
  console.log('member login migration done');
  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
