// Vollbackup der RTDB nach backups/ (gitignored).
import { db, ROOT } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'fs';

const val = (await db.ref('/').once('value')).val();
mkdirSync(`${ROOT}/backups`, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = `${ROOT}/backups/rtdb-${stamp}.json`;
writeFileSync(file, JSON.stringify(val, null, 1));
const mb = (JSON.stringify(val).length / 1048576).toFixed(2);
console.log(`Backup geschrieben: ${file} (${mb} MB)`);
for (const k of Object.keys(val || {})) {
  const v = val[k];
  console.log(`  ${k}: ${v && typeof v === 'object' ? Object.keys(v).length + ' Eintraege' : JSON.stringify(v)}`);
}
process.exit(0);
