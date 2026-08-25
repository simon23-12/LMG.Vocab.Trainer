// Spielt database.rules.json in die Live-Datenbank ein.
// Vorher: aktuelle Rules werden nach backups/rules-<stamp>.json gesichert.
import { credentials, DB_URL, ROOT, confirm } from './lib.mjs';
import { GoogleAuth } from 'google-auth-library';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const gauth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/firebase.database', 'https://www.googleapis.com/auth/userinfo.email']
});
const token = (await (await gauth.getClient()).getAccessToken()).token;
const url = `${DB_URL}/.settings/rules.json?access_token=${token}`;

const current = await (await fetch(url)).text();
mkdirSync(`${ROOT}/backups`, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
writeFileSync(`${ROOT}/backups/rules-${stamp}.json`, current);
console.log(`Alte Rules gesichert: backups/rules-${stamp}.json`);

if (process.argv.includes('--show-current')) { console.log(current); process.exit(0); }

const neu = readFileSync(`${ROOT}/database.rules.json`, 'utf8');
JSON.parse(neu);

if (!await confirm('Neue Rules jetzt LIVE schalten?')) { console.log('Abgebrochen.'); process.exit(0); }

const res = await fetch(url, { method: 'PUT', body: neu });
if (!res.ok) { console.error('FEHLGESCHLAGEN:', res.status, await res.text()); process.exit(1); }
console.log('Rules sind live.');
process.exit(0);
