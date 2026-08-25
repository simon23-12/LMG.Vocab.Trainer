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

const WOERTER = [
  'apfel','anker','biene','blume','bruecke','delfin','eule','feder','fuchs','garten','gitarre','hafen',
  'igel','insel','kanu','kerze','komet','krone','lampe','loewe','magnet','melone','mond','nebel',
  'otter','palme','pinsel','planet','rakete','regen','robbe','segel','stern','tiger','tulpe','turm',
  'vulkan','wolke','wal','zebra','zitrone','zug'
];
const pw = () => `${WOERTER[randomInt(WOERTER.length)]}-${WOERTER[randomInt(WOERTER.length)]}-${randomInt(10, 100)}`;

const ohneUmlaut = s => s.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z]/g, '');

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

// --- Login-Namen bilden, Dubletten aufloesen ---
const belegt = new Set();
for (const s of schueler) {
  const basis = `${s.klasse}.${ohneUmlaut(s.nachname)}.${ohneUmlaut(s.vorname).charAt(0)}`;
  let name = basis, n = 2;
  while (belegt.has(name)) name = `${basis}${n++}`;
  belegt.add(name);
  s.loginName = name;
  s.passwort = pw();
  s.anzeige = `${s.vorname} ${s.nachname}`;
}

const proKlasse = {};
for (const s of schueler) (proKlasse[s.klasse] ||= []).push(s);
console.log(`${schueler.length} Schueler in ${Object.keys(proKlasse).length} Klassen:`);
for (const [k, v] of Object.entries(proKlasse).sort()) console.log(`  ${k}: ${v.length}`);
console.log(`\nBeispiel-Login: ${schueler[0].loginName} / ${schueler[0].passwort}`);

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
