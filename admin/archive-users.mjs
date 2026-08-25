// Verschiebt den kompletten bisherigen users-Baum nach archive/<schuljahr>/users.
// Danach ist users/ leer und wird ausschliesslich ueber create-accounts.mjs neu befuellt.
// Die alten Firebase-Auth-Accounts (Fake-Mails <userKey>@lmg-vokabel.app) werden
// mit --auth-loeschen zusaetzlich entfernt.
//
// Aufruf: node admin/archive-users.mjs <schuljahr> [--auth-loeschen] [--yes]
// Beispiel: node admin/archive-users.mjs 2025-26
import { db, auth, ROOT, confirm } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'fs';

const schuljahr = process.argv[2];
if (!schuljahr || !/^\d{4}-\d{2}$/.test(schuljahr)) {
  console.error('Aufruf: node admin/archive-users.mjs <schuljahr, z.B. 2025-26> [--auth-loeschen] [--yes]');
  process.exit(1);
}

const users = (await db.ref('users').once('value')).val() || {};
const anzahl = Object.keys(users).length;
if (!anzahl) { console.log('users/ ist bereits leer.'); process.exit(0); }

// Lokale Sicherung zuerst - unabhaengig von der Datenbank.
mkdirSync(`${ROOT}/backups`, { recursive: true });
const datei = `${ROOT}/backups/users-vor-archivierung-${schuljahr}.json`;
writeFileSync(datei, JSON.stringify(users, null, 1));
console.log(`${anzahl} Accounts lokal gesichert: ${datei}`);

if (!await confirm(`users/ nach archive/${schuljahr}/users verschieben und users/ leeren?`)) {
  console.log('Abgebrochen.'); process.exit(0);
}

await db.ref(`archive/${schuljahr}/users`).set(users);
await db.ref(`archive/${schuljahr}/meta`).set({ archiviertAm: new Date().toISOString(), anzahl });
const kontrolle = (await db.ref(`archive/${schuljahr}/users`).once('value')).val();
if (!kontrolle || Object.keys(kontrolle).length !== anzahl) {
  console.error('Archiv unvollstaendig - users/ wird NICHT geleert.'); process.exit(1);
}
await db.ref('users').remove();
console.log(`Archiviert nach archive/${schuljahr}/users, users/ ist jetzt leer.`);

if (process.argv.includes('--auth-loeschen')) {
  if (await confirm('Auch alle alten Firebase-Auth-Accounts loeschen?')) {
    let geloescht = 0, token;
    do {
      const seite = await auth.listUsers(1000, token);
      const uids = seite.users.map(u => u.uid);
      if (uids.length) { const r = await auth.deleteUsers(uids); geloescht += r.successCount; }
      token = seite.pageToken;
    } while (token);
    console.log(`${geloescht} Auth-Accounts geloescht.`);
    console.log('WICHTIG: Deinen eigenen Lehrer-Account jetzt neu anlegen (create-teacher.mjs).');
  }
}
process.exit(0);
