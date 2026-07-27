/**
 * Optional helper: generate a bcrypt hash for seed/manual inserts.
 * Prefer seed.sql's pgcrypto crypt() — this is only if you need a static hash.
 *
 * Usage: node database/hash.js [password]
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'password123';

bcrypt.hash(password, 10).then((hash) => {
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nSQL example:');
  console.log(`password_hash = '${hash}'`);
}).catch((err) => {
  console.error(err);
  console.error('\nInstall bcryptjs first: npm install bcryptjs');
  process.exit(1);
});
