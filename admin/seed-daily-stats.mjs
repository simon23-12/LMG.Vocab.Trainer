// Einmalige Naeherung fuer die Aktivitaets-Heatmap im Lehrer-Dashboard.
//
// Vor Einfuehrung der Tagesstatistik gab es nur eine Gesamtsumme geuebter
// Vokabeln, keine Tageshistorie. Dieses Skript verteilt diese Gesamtsumme
// ansteigend auf die zurueckliegenden Schultage, damit die Heatmap nicht bei
// null startet. Die Tage werden in stats/meta/estimatedUntil als
// "hochgerechnet" markiert und im Dashboard als runde Felder dargestellt.
//
// Aufruf: node admin/seed-daily-stats.mjs [--dry] [--force] [--yes]
import { db, confirm } from './lib.mjs';

const START = '2026-09-02';   // erster Schultag des Schuljahres
const ENDE  = '2026-09-06';   // ab dem Folgetag wird tagesgenau gezaehlt
const TOTAL = 4311;           // Gesamtzahl geuebter Vokabeln laut Dashboard

const WOCHENEND_FAKTOR = 0.2; // am Wochenende wird deutlich weniger geuebt
const RAMPE = 3;              // letzter Tag bekommt ~4x das Gewicht des ersten

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

const tag = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const key = d => d.toISOString().slice(0, 10);

// --- Tage und Gewichte ---
const tage = [];
for (let d = tag(START); d <= tag(ENDE); d = new Date(d.getTime() + 86400000)) tage.push(new Date(d));

const gewichte = tage.map((d, i) => {
  const fortschritt = tage.length > 1 ? i / (tage.length - 1) : 1;
  const wochenende = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  return (1 + RAMPE * fortschritt) * (wochenende ? WOCHENEND_FAKTOR : 1);
});

// --- Auf TOTAL skalieren, Rest nach groesstem Nachkommateil verteilen ---
const summe = gewichte.reduce((a, b) => a + b, 0);
const roh = gewichte.map(g => (g / summe) * TOTAL);
const werte = roh.map(Math.floor);
let rest = TOTAL - werte.reduce((a, b) => a + b, 0);
roh.map((v, i) => ({ i, frac: v - Math.floor(v) }))
   .sort((a, b) => b.frac - a.frac)
   .slice(0, rest)
   .forEach(({ i }) => werte[i]++);

const kontrolle = werte.reduce((a, b) => a + b, 0);
if (kontrolle !== TOTAL) { console.error(`Verteilung ergibt ${kontrolle} statt ${TOTAL}`); process.exit(1); }

console.log(`\nVerteile ${TOTAL} Vokabeln auf ${tage.length} Tage (${START} bis ${ENDE}):`);
tage.forEach((d, i) => {
  const we = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? ' (Wochenende)' : '';
  console.log(`  ${key(d)}  ${String(werte[i]).padStart(4)}${we}`);
});
console.log(`  Summe: ${kontrolle}\n`);

if (dry) { console.log('--dry: nichts geschrieben.'); process.exit(0); }

// --- Schutz vor doppeltem Lauf ---
const vorhanden = (await db.ref('stats/daily').get()).val() || {};
const kollision = tage.map(key).filter(k => vorhanden[k]);
if (kollision.length && !force) {
  console.error(`Es gibt bereits Werte fuer ${kollision.length} Tage im Zeitraum (z. B. ${kollision[0]}).`);
  console.error('Nochmal laufen lassen wuerde die Zahlen ueberschreiben. Mit --force erzwingen.');
  process.exit(1);
}

if (!await confirm(`stats/daily fuer ${tage.length} Tage schreiben?`)) { console.log('Abgebrochen.'); process.exit(0); }

const updates = {};
tage.forEach((d, i) => { updates[`daily/${key(d)}/vocabs`] = werte[i]; });
updates['meta/estimatedUntil'] = ENDE;
updates['meta/trackingSince'] = key(new Date(tag(ENDE).getTime() + 86400000));
updates['meta/seedTotal'] = TOTAL;
updates['meta/seededAt'] = new Date().toISOString();

await db.ref('stats').update(updates);
console.log(`✓ ${tage.length} Tage geschrieben, tagesgenaue Zaehlung ab ${updates['meta/trackingSince']}.`);
process.exit(0);
