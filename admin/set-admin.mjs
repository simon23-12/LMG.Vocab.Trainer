// Vergibt/entzieht das Admin-Claim (Lehrer-Zugang: users lesen, Accounts schreiben).
// Aufruf: node admin/set-admin.mjs <loginName|email> [--off]
import { auth, emailFor } from './lib.mjs';

const arg = process.argv[2];
if (!arg) { console.error('Aufruf: node admin/set-admin.mjs <loginName|email> [--off]'); process.exit(1); }
const email = arg.includes('@') ? arg : emailFor(arg);
const off = process.argv.includes('--off');

const user = await auth.getUserByEmail(email).catch(() => null);
if (!user) { console.error(`Kein Auth-Account fuer ${email}. Erst mit create-teacher.mjs anlegen.`); process.exit(1); }

await auth.setCustomUserClaims(user.uid, off ? {} : { admin: true });
console.log(`${email} (${user.uid}): admin = ${!off}`);
console.log('Hinweis: Der Client muss sich einmal neu anmelden, damit das Claim im Token landet.');
process.exit(0);
