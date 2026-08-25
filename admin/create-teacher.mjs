// Legt einen Lehrer-/Admin-Account an (Firebase Auth + Admin-Claim).
// Aufruf: node admin/create-teacher.mjs <loginName> <passwort> "<Anzeigename>"
import { auth, emailFor, ROOT } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { randomInt } from 'crypto';

// Ohne <passwort> wird eines erzeugt und in backups/ abgelegt (gitignored),
// damit es nicht in der Shell-History steht.
//
// Sprechbar statt Zeichensalat: Der Lehrer-Zugang wird im Kollegium weitergegeben,
// muss also diktierbar sein. Zwei Woerter plus Zahl sind kurz genug dafuer und
// trotzdem deutlich schwerer zu raten als ein einzelnes Wort.
const WOERTER = [
  'anker', 'biene', 'blume', 'bruecke', 'delfin', 'eule', 'feder', 'fuchs', 'garten',
  'hafen', 'insel', 'kanu', 'kerze', 'komet', 'krone', 'lampe', 'loewe', 'magnet',
  'melone', 'mond', 'nebel', 'otter', 'palme', 'pinsel', 'planet', 'rakete', 'regen',
  'robbe', 'segel', 'stern', 'tiger', 'tulpe', 'turm', 'vulkan', 'wolke', 'zebra'
];
const erzeuge = () =>
  `${WOERTER[randomInt(WOERTER.length)]}-${WOERTER[randomInt(WOERTER.length)]}-${randomInt(10, 100)}`;

const [loginName, passwortArg, anzeigename] = process.argv.slice(2);
if (!loginName) {
  console.error('Aufruf: node admin/create-teacher.mjs <loginName> [passwort] "<Anzeigename>"');
  process.exit(1);
}
const passwort = passwortArg || erzeuge();
if (passwort.length < 10) { console.error('Passwort bitte mindestens 10 Zeichen.'); process.exit(1); }

const email = emailFor(loginName);
let user = await auth.getUserByEmail(email).catch(() => null);
if (user) {
  await auth.updateUser(user.uid, { password: passwort, displayName: anzeigename || loginName });
  console.log(`Bestehender Account ${email} aktualisiert.`);
} else {
  user = await auth.createUser({ email, password: passwort, displayName: anzeigename || loginName });
  console.log(`Account ${email} angelegt.`);
}
await auth.setCustomUserClaims(user.uid, { admin: true });
console.log(`uid: ${user.uid} | admin: true`);

if (!passwortArg) {
  mkdirSync(`${ROOT}/backups`, { recursive: true });
  const datei = `${ROOT}/backups/lehrer-zugang-${loginName}.txt`;
  writeFileSync(datei,
    `Vokabeltrainer - Lehrer-Zugang\n\n` +
    `Adresse:  https://lmgvocab.vercel.app\n` +
    `Login:    ${loginName}\n` +
    `Passwort: ${passwort}\n\n` +
    `Angelegt: ${new Date().toLocaleString('de-DE')}\n` +
    `Diese Datei liegt in backups/ und ist per .gitignore vom Repo ausgeschlossen.\n` +
    `Passwort aendern: node admin/create-teacher.mjs ${loginName} "<neues Passwort>"\n`);
  console.log(`\nPasswort erzeugt und abgelegt in: backups/lehrer-zugang-${loginName}.txt`);
} else {
  console.log(`Login im Vokabeltrainer: Name "${loginName}", Passwort wie vergeben.`);
}
process.exit(0);
