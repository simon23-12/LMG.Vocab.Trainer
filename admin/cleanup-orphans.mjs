// Findet Auth-Accounts ohne zugehoerigen users/<uid>-Knoten ("Geister").
//
// Solche Accounts stammen aus dem alten Selbstregistrierungs-System: der Login
// legte damals nebenbei einen Firebase-Auth-Eintrag mit Fake-Mail an. Ihre Daten
// liegen im Archiv, der Auth-Eintrag aber lebt weiter - und wer sein altes
// Passwort kennt, kommt damit weiterhin an ein gueltiges Token. In die App
// kommt er nicht (dafuer muss users/<uid> existieren), aber ein Token genuegt,
// um z. B. einen Leaderboard-Eintrag zu schreiben.
//
// Aufruf: node admin/cleanup-orphans.mjs [--loeschen] [--yes]
import { db, auth, confirm } from './lib.mjs';

const users = (await db.ref('users').once('value')).val() || {};
const bekannt = new Set(Object.keys(users));

const geister = [];
let gesamt = 0, token;
do {
  const seite = await auth.listUsers(1000, token);
  for (const u of seite.users) {
    gesamt++;
    if (u.customClaims?.admin === true) continue;   // Lehrer-Zugaenge nie anfassen
    if (!bekannt.has(u.uid)) geister.push({ uid: u.uid, email: u.email });
  }
  token = seite.pageToken;
} while (token);

console.log(`${gesamt} Auth-Accounts insgesamt, ${bekannt.size} davon mit Datenknoten.`);
console.log(`${geister.length} verwaiste Accounts:`);
for (const g of geister) console.log(`  ${g.email}`);

if (!process.argv.includes('--loeschen')) {
  console.log('\nNur Anzeige. Zum Entfernen: node admin/cleanup-orphans.mjs --loeschen');
  process.exit(0);
}
if (!geister.length) process.exit(0);
if (!await confirm(`\n${geister.length} verwaiste Auth-Accounts loeschen?`)) { console.log('Abgebrochen.'); process.exit(0); }

let weg = 0;
for (let i = 0; i < geister.length; i += 1000) {
  const r = await auth.deleteUsers(geister.slice(i, i + 1000).map(g => g.uid));
  weg += r.successCount;
  for (const f of r.errors) console.error('  Fehler:', f.error.message);
}
console.log(`${weg} Accounts geloescht.`);
process.exit(0);
