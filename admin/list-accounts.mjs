// Uebersicht: wer ist angelegt, wie verteilt auf Klassen, wer war zuletzt aktiv.
// Aufruf: node admin/list-accounts.mjs [klasse]
import { db } from './lib.mjs';

const filter = (process.argv[2] || '').toLowerCase();
const users = (await db.ref('users').once('value')).val() || {};
const eintraege = Object.entries(users)
  .map(([uid, u]) => ({ uid, ...u }))
  .filter(u => !filter || (u.class || '').toLowerCase() === filter)
  .sort((a, b) => (a.class || '').localeCompare(b.class || '') || (a.name || '').localeCompare(b.name || ''));

const proKlasse = {};
for (const u of eintraege) (proKlasse[u.class || '(keine)'] ||= []).push(u);

for (const [k, list] of Object.entries(proKlasse).sort()) {
  console.log(`\n${k}  (${list.length})`);
  for (const u of list) {
    console.log(`  ${(u.name || '?').padEnd(28)} ${(u.loginName || '-').padEnd(24)} ` +
      `Vokabeln: ${String(u.lifetimeTotalVocabs || 0).padStart(6)}  zuletzt: ${u.lastActivityDate || '-'}`);
  }
}
console.log(`\nGesamt: ${eintraege.length} Accounts`);
process.exit(0);
