// Ersetzt ueberall den Klarnamen durch den Login-Namen.
//
// Hintergrund: Frueher stand in users/<uid>.name "Paul Becker". Dieses Feld ist die
// Anzeigequelle fuer die Begruessung, die Lehreruebersicht, die Rangliste und die
// Battle Arena - der volle Name eines Kindes war damit fuer Mitschueler sichtbar.
// Angezeigt werden soll nur noch der Login (PaulB). Der Klarname existiert danach
// nur noch in den lokalen Zugangsdaten-Listen unter backups/.
//
// Angefasst werden: users/<uid>.name, leaderboard/<klasse>/<uid>.name und der
// displayName im Firebase-Auth-Eintrag. Laeuft beliebig oft, aendert nur, was abweicht.
//
// Aufruf: node admin/anonymize-names.mjs [--dry] [--yes]
import { db, auth, confirm } from './lib.mjs';

const dry = process.argv.includes('--dry');

const users = (await db.ref('users').once('value')).val() || {};
const uids = Object.keys(users);
const offen = uids.filter(uid => {
  const u = users[uid];
  return u && u.loginName && u.name !== u.loginName;
});

console.log(`${uids.length} Accounts, ${offen.length} mit abweichendem Anzeigenamen.`);
for (const uid of offen.slice(0, 5)) console.log(`  "${users[uid].name}" -> "${users[uid].loginName}"`);
if (offen.length > 5) console.log(`  … und ${offen.length - 5} weitere`);

// Rangliste: eigener Baum, eigene Kopie des Namens.
const lb = (await db.ref('leaderboard').once('value')).val() || {};
const lbFix = [];
for (const [klasse, eintraege] of Object.entries(lb)) {
  for (const [uid, e] of Object.entries(eintraege || {})) {
    const login = users[uid]?.loginName;
    if (login && e && e.name !== login) lbFix.push({ pfad: `leaderboard/${klasse}/${uid}/name`, login });
  }
}
console.log(`${lbFix.length} Ranglisten-Eintraege mit Klarnamen.`);

if (dry) { console.log('\n--dry: nichts geschrieben.'); process.exit(0); }
if (!offen.length && !lbFix.length) { console.log('Nichts zu tun.'); process.exit(0); }
if (!await confirm('\nAnzeigenamen jetzt auf den Login-Namen umstellen?')) { console.log('Abgebrochen.'); process.exit(0); }

// Datenbank in Bloecken - ein einzelnes update() mit 600 Pfaden ist der RTDB zu gross.
const updates = {};
for (const uid of offen) updates[`users/${uid}/name`] = users[uid].loginName;
for (const f of lbFix) updates[f.pfad] = f.login;
const pfade = Object.keys(updates);
for (let i = 0; i < pfade.length; i += 200) {
  const block = {};
  for (const p of pfade.slice(i, i + 200)) block[p] = updates[p];
  await db.ref().update(block);
  console.log(`  Datenbank: ${Math.min(i + 200, pfade.length)}/${pfade.length}`);
}

// Auth-displayName - taucht in der Firebase Console und in Exporten auf.
let authFix = 0, authFehler = 0;
for (const uid of uids) {
  const login = users[uid]?.loginName;
  if (!login) continue;
  try {
    const u = await auth.getUser(uid);
    if (u.displayName === login) continue;
    await auth.updateUser(uid, { displayName: login });
    authFix++;
  } catch (e) { authFehler++; console.error(`  Fehler ${login}: ${e.message}`); }
}

console.log(`\nDatenbank: ${pfade.length} Felder gesetzt. Auth-displayName: ${authFix} geaendert${authFehler ? `, ${authFehler} Fehler` : ''}.`);
process.exit(0);
