const fs = require('fs');
const sa = JSON.parse(fs.readFileSync('secrets/firebase-adminsdk.json', 'utf8'));
const pk = sa.private_key.replace(/\n/g, '\\n');
const block = [
  '# Firebase Admin (FCM) — credentials in env (no JSON file needed)',
  `FIREBASE_PROJECT_ID=${sa.project_id}`,
  `FIREBASE_CLIENT_EMAIL=${sa.client_email}`,
  `FIREBASE_PRIVATE_KEY="${pk}"`,
  '',
].join('\n');

let env = fs.readFileSync('.env', 'utf8');
if (/# Firebase Admin[\s\S]*$/m.test(env)) {
  env = env.replace(/# Firebase Admin[\s\S]*$/m, block);
} else {
  env = `${env.trimEnd()}\n\n${block}`;
}
fs.writeFileSync('.env', env);
console.log('Updated .env with Firebase Admin for', sa.client_email);
