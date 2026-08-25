// Gemeinsame Basis fuer alle Admin-Skripte.
// Liest den Service-Account-Key aus .secrets/ (gitignored, NIE committen).
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DB_URL = 'https://testdatabase-4daf4-default-rtdb.europe-west1.firebasedatabase.app';
const KEY = resolve(ROOT, '.secrets/firebase-admin.json');

if (!existsSync(KEY)) {
  console.error(`\nFEHLER: Kein Service-Account-Key unter ${KEY}`);
  console.error('Firebase Console -> Projekteinstellungen -> Dienstkonten -> Neuen privaten Schluessel generieren.\n');
  process.exit(1);
}

export const credentials = JSON.parse(readFileSync(KEY, 'utf8'));
initializeApp({ credential: cert(credentials), databaseURL: DB_URL });

export const db = getDatabase();
export const auth = getAuth();

/** Sicherheitsabfrage fuer schreibende Aktionen. Ueberspringbar mit --yes. */
export async function confirm(frage) {
  if (process.argv.includes('--yes')) return true;
  process.stdout.write(`${frage} [ja/nein] `);
  const answer = await new Promise(res => {
    process.stdin.resume();
    process.stdin.once('data', d => { process.stdin.pause(); res(String(d).trim().toLowerCase()); });
  });
  return answer === 'ja' || answer === 'j';
}

/** Synthetische Login-Mail. Schueler tippen davon nur den loginName. */
export const emailFor = loginName => `${loginName}@lmg-vokabel.app`;
