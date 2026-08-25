// Loescht Accounts vollstaendig: Firebase-Auth-Eintrag, users/<uid> und den
// Leaderboard-Eintrag der Klasse. Fuer Testaccounts, Schulwechsel, Tippfehler.
//
// Aufruf: node admin/delete-accounts.mjs <login> [<login> ...] [--yes]
// Beispiel: node admin/delete-accounts.mjs Jonas LeaH LeaS
import { db, auth, emailFor, confirm } from './lib.mjs';

const logins = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!logins.length) {
  console.error('Aufruf: node admin/delete-accounts.mjs <login> [<login> ...] [--yes]');
  process.exit(1);
}

// Erst sammeln und anzeigen, was genau verschwinden wuerde.
const treffer = [];
for (const login of logins) {
  const user = await auth.getUserByEmail(emailFor(login)).catch(() => null);
  if (!user) { console.warn(`  kein Account: ${login}`); continue; }
  const daten = (await db.ref('users/' + user.uid).once('value')).val() || {};
  treffer.push({ login, uid: user.uid, name: daten.name || '(ohne Namen)', klasse: daten.class || '?' });
}
if (!treffer.length) { console.log('Nichts zu loeschen.'); process.exit(0); }

console.log('\nFolgende Accounts werden vollstaendig geloescht:');
for (const t of treffer) console.log(`  ${t.klasse.padEnd(4)} ${t.name.padEnd(22)} ${t.login.padEnd(14)} ${t.uid}`);
console.log('\nFortschritt, Awards und Streaks dieser Schueler gehen dabei verloren.');

if (!await confirm('Wirklich loeschen?')) { console.log('Abgebrochen.'); process.exit(0); }

for (const t of treffer) {
  await db.ref('users/' + t.uid).remove();
  await db.ref(`leaderboard/${String(t.klasse).toLowerCase()}/${t.uid}`).remove();
  await auth.deleteUser(t.uid);
  console.log(`  geloescht: ${t.login}`);
}
console.log(`\n${treffer.length} Accounts entfernt.`);
process.exit(0);
