require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const listings = await c.query(`
    SELECT l.id, l.title, l.slug, l.member_id,
           m.first_name || ' ' || m.last_name AS seller
    FROM market_listings l
    JOIN church_members m ON m.id = l.member_id
    ORDER BY l.id
  `);
  console.log('LISTINGS');
  console.log(listings.rows);
  const convs = await c.query(`
    SELECT c.id, c.listing_id, c.seller_member_id, c.buyer_type, c.buyer_id,
           m.first_name || ' ' || m.last_name AS seller,
           l.title
    FROM market_conversations c
    JOIN church_members m ON m.id = c.seller_member_id
    LEFT JOIN market_listings l ON l.id = c.listing_id
    ORDER BY c.id
  `);
  console.log('CONVERSATIONS');
  console.log(convs.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
