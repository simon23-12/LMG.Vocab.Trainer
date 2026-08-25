// Legt Schueler-Accounts aus einer Klassenliste an.
//
// Eingabe: CSV mit Kopfzeile  klasse,vorname,nachname   (Semikolon oder Komma)
// Aufruf:  node admin/create-accounts.mjs listen/sek1.csv [--dry] [--yes]
//
// Pro Schueler entsteht:
//   - ein Firebase-Auth-Account  <loginName>@lmg-vokabel.app  mit generiertem Passwort
//   - ein Datenknoten users/<uid> mit name, class, loginName, created
// Ausgabe: backups/zugangsdaten-<stamp>.csv  und  eine druckbare HTML-Liste pro Klasse.
//
// Passwoerter sind bewusst sprechbar (Wort-Wort-Zahl), damit Fuenftklaessler sie abtippen koennen.
import { db, auth, emailFor, ROOT, confirm } from './lib.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomInt } from 'crypto';

// Passwoerter: 6 Zeichen (Firebase laesst weniger nicht zu), nur eindeutige
// Zeichen - ohne i/l/1 und o/0, ohne Sonderzeichen, alles klein.
const PW_ZEICHEN = 'abcdefghjkmnpqrstuvwxyz23456789';
const PW_LAENGE = 6;
const pw = () => Array.from({ length: PW_LAENGE }, () => PW_ZEICHEN[randomInt(PW_ZEICHEN.length)]).join('');

// Umlaute aufloesen, alles andere wegwerfen - der Login soll tippbar sein.
const ohneUmlaut = s => s
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
  .replace(/[^A-Za-z]/g, '');

const grossKlein = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const datei = process.argv[2];
const dry = process.argv.includes('--dry');
if (!datei) { console.error('Aufruf: node admin/create-accounts.mjs <liste.csv> [--dry] [--yes]'); process.exit(1); }

// --- CSV einlesen ---
const zeilen = readFileSync(datei, 'utf8').split(/\r?\n/).filter(z => z.trim());
const trenner = zeilen[0].includes(';') ? ';' : ',';
const kopf = zeilen[0].split(trenner).map(s => s.trim().toLowerCase());
const iK = kopf.indexOf('klasse'), iV = kopf.indexOf('vorname'), iN = kopf.indexOf('nachname');
if (iK < 0 || iV < 0 || iN < 0) {
  console.error('CSV braucht die Spalten: klasse, vorname, nachname'); process.exit(1);
}

const schueler = [];
for (const z of zeilen.slice(1)) {
  const f = z.split(trenner).map(s => s.trim());
  const klasse = f[iK]?.toLowerCase(), vorname = f[iV], nachname = f[iN];
  if (!klasse || !vorname || !nachname) { console.warn(`Uebersprungen (unvollstaendig): ${z}`); continue; }
  schueler.push({ klasse, vorname, nachname });
}

// --- Login-Namen bilden ---
//
// Schueler tippen nur ihren Vornamen. Ist der schon vergeben - in dieser Liste ODER
// bei einem bereits bestehenden Account - kommt der Anfangsbuchstabe des Nachnamens
// dazu (Lea Hoffmann -> LeaH, Lea Schneider -> LeaS). Reicht das immer noch nicht,
// waechst der Nachnamensteil buchstabenweise, zuletzt haengt eine Ziffer an.
//
// Wichtig: Login-Namen muessen projektweit eindeutig sein, nicht nur pro Klasse -
// sie werden zur Mailadresse. Deshalb pruefen wir gegen den Bestand in der Datenbank.
const belegt = new Set();
const bestand = (await db.ref('users').once('value')).val() || {};
for (const u of Object.values(bestand)) {
  if (u && u.loginName) belegt.add(String(u.loginName).toLowerCase());
}
if (belegt.size) console.log(`${belegt.size} bereits vergebene Logins werden beruecksichtigt.`);

// Erst zaehlen: kommt ein Vorname mehrfach vor, bekommen ALLE Traeger den Zusatz -
// sonst haette die erste Lea "Lea" und die zweite "LeaS", was unfair und verwirrend waere.
const haeufigkeit = {};
for (const s of schueler) {
  const v = grossKlein(ohneUmlaut(s.vorname)).toLowerCase();
  haeufigkeit[v] = (haeufigkeit[v] || 0) + 1;
}

for (const s of schueler) {
  const vorname = grossKlein(ohneUmlaut(s.vorname));
  const nachname = ohneUmlaut(s.nachname);
  const mehrfach = haeufigkeit[vorname.toLowerCase()] > 1 || belegt.has(vorname.toLowerCase());

  let name = mehrfach ? vorname + grossKlein(nachname.slice(0, 1)) : vorname;   // Lea -> LeaH
  for (let i = 2; belegt.has(name.toLowerCase()) && i <= nachname.length; i++) {
    name = vorname + grossKlein(nachname.slice(0, i));                          // LeaH -> LeaHo
  }
  let n = 2;
  while (belegt.has(name.toLowerCase())) name = vorname + (n++);                // Notnagel: Lea2

  belegt.add(name.toLowerCase());
  s.loginName = name;
  s.passwort = pw();
  s.anzeige = `${s.vorname} ${s.nachname}`;
}

const proKlasse = {};
for (const s of schueler) (proKlasse[s.klasse] ||= []).push(s);
console.log(`${schueler.length} Schueler in ${Object.keys(proKlasse).length} Klassen:`);
for (const [k, v] of Object.entries(proKlasse).sort()) console.log(`  ${k}: ${v.length}`);
console.log('');
for (const [k, list] of Object.entries(proKlasse).sort()) {
  for (const s of list) {
    console.log(`  ${k.padEnd(4)} ${s.anzeige.padEnd(24)} Login: ${s.loginName.padEnd(16)} Passwort: ${s.passwort}`);
  }
}

if (dry) { console.log('\n--dry: nichts geschrieben.'); process.exit(0); }
if (!await confirm(`\n${schueler.length} Accounts jetzt wirklich anlegen?`)) { console.log('Abgebrochen.'); process.exit(0); }

// --- Anlegen ---
let neu = 0, aktualisiert = 0, fehler = 0;
for (const s of schueler) {
  const email = emailFor(s.loginName);
  try {
    let user = await auth.getUserByEmail(email).catch(() => null);
    if (user) { await auth.updateUser(user.uid, { password: s.passwort, displayName: s.anzeige }); aktualisiert++; }
    else { user = await auth.createUser({ email, password: s.passwort, displayName: s.anzeige }); neu++; }
    s.uid = user.uid;
    await db.ref('users/' + user.uid).update({
      name: s.anzeige,
      class: s.klasse,
      loginName: s.loginName,
      created: new Date().toISOString()
    });
  } catch (e) { fehler++; s.fehler = e.message; console.error(`FEHLER ${s.loginName}: ${e.message}`); }
}
console.log(`\nNeu: ${neu} | Aktualisiert: ${aktualisiert} | Fehler: ${fehler}`);

// --- Zugangsdaten ausgeben ---
mkdirSync(`${ROOT}/backups`, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const csv = ['klasse;name;login;passwort;uid',
  ...schueler.map(s => `${s.klasse};${s.anzeige};${s.loginName};${s.passwort};${s.uid || 'FEHLER'}`)].join('\n');
writeFileSync(`${ROOT}/backups/zugangsdaten-${stamp}.csv`, csv);

const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const html = `<meta charset="utf-8"><title>Zugangsdaten</title><style>
body{font-family:system-ui,sans-serif;margin:24px}h2{page-break-before:always;margin-top:0}
h2:first-of-type{page-break-before:auto}table{border-collapse:collapse;width:100%;margin-bottom:28px}
td,th{border:1px solid #bbb;padding:7px 10px;text-align:left;font-size:14px}
th{background:#eef3fa}code{font-size:15px;font-weight:600}
@media print{body{margin:0}}</style>
<h1>Zugangsdaten Vokabeltrainer</h1>
${Object.entries(proKlasse).sort().map(([k, list]) => `<h2>Klasse ${esc(k)}</h2><table>
<tr><th>Name</th><th>Login</th><th>Passwort</th></tr>
${list.map(s => `<tr><td>${esc(s.anzeige)}</td><td><code>${esc(s.loginName)}</code></td><td><code>${esc(s.passwort)}</code></td></tr>`).join('\n')}
</table>`).join('\n')}`;
writeFileSync(`${ROOT}/backups/zugangsdaten-${stamp}.html`, html);

console.log(`\nZugangsdaten: backups/zugangsdaten-${stamp}.csv`);
console.log(`Druckliste:   backups/zugangsdaten-${stamp}.html  (im Browser oeffnen, eine Seite pro Klasse)`);
console.log('ACHTUNG: Passwoerter stehen nur hier im Klartext. In der Datenbank liegen sie nicht.');
process.exit(0);
