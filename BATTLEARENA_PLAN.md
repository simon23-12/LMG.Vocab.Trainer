# Battlearena – Planung & Execution Plan

Kahoot-Style Live-Vokabelquiz für den LMG Vokabeltrainer. Lehrkraft öffnet einen Raum,
Schüler joinen per Code, es werden Runden gespielt, am Ende Siegerehrung.

---

## 1. Architektur-Grundsatzentscheidungen (festgezurrt)

| Thema | Entscheidung | Begründung |
|---|---|---|
| Echtzeit-Backend | **Firebase Realtime Database (RTDB)** | Bereits im Projekt, Echtzeit eingebaut, kein neuer Dienst |
| Vercel/Blob | **Unberührt** | Nur statisches Hosting; Spielzustand läuft Browser ↔ Firebase. Kein Blob, keine Functions → kein Free-Tier-Risiko |
| Wer rechnet | **Host (Lehrer-Browser) ist autoritativ** | Eine Quelle der Wahrheit; Schüler liefern nur Antworten. Cheating verpufft, da Host Scores überschreibt |
| Server | **Keiner** | Lehrer-Browser ist die "Spieluhr" |
| Spielmodus | **Freitext, 1 Vokabel/Runde, 10 Runden, 20s** | Freitext = echter Trainingseffekt (MC zu einfach). 1 Vokabel erstmal für Einfachheit |
| Richtung | **Deutsch → Englisch** | Schüler sieht `German`, tippt Englisch |
| Bewertung | Bestehende `checkAnswer`-Logik gespiegelt | Tippfehler-Halbpunkte + Synonyme + Zeit-Bonus |
| Datei | **Eigene `battlearena.html`** | Bestehender Code bleibt 100% unberührt |
| Eingriff Bestand | **Nur 2 Buttons** | Join-Button in `display.html` (Schüler), Launch-Button in `teacher-dashboard.html` (Lehrer) |

### Sicherheit
- Raum ist **ephemer & harmlos** (existiert nur Minuten, unter Aufsicht, nur Spielpunkte) → `/rooms` darf offen sein.
- **Kein Firebase Auth** im Projekt → Identität läuft App-seitig über `localStorage.lmg_currentUser`. Keine `auth.uid`-Rules möglich/nötig.
- Lösung & Synonyme bleiben **nur beim Host** (nicht in der DB) → kein Spicken.

### Aufräumen (Räume löschen)
- **`onDisconnect().remove()`** auf `/rooms/{code}` → Normalfall: Lehrer schließt Tab → Raum sofort weg.
- **`createdAt` + Lazy Cleanup**: beim Raum-Erstellen alle Räume mit `createdAt` älter als ~30 Min löschen (passiv, kein Server/Cron). `createdAt` als "letzte Aktivität" mitführen, damit kein laufendes Spiel gekillt wird.
- RTDB hat **kein natives TTL** → kein Selbstzerstörungs-Timer, sondern Schwellwert-Vergleich.

---

## 2. Technische Anschlusspunkte (verifiziert)

### Firebase Config (aus `display.html:1541`)
```js
const firebaseConfig = {
  apiKey: "AIzaSyBRPlWh1slILKg8DWQDOEWXSFsnUK3j1vw",
  authDomain: "testdatabase-4daf4.firebaseapp.com",
  databaseURL: "https://testdatabase-4daf4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testdatabase-4daf4",
  storageBucket: "testdatabase-4daf4.firebasestorage.app",
  messagingSenderId: "743231387214",
  appId: "1:743231387214:web:166169b25f72616280351f"
};
```
- SDK: `firebase-app-compat.js` + `firebase-database-compat.js` + `firebase-app-check-compat.js` (v10.12.2, gstatic)
- App Check: reCAPTCHA v3, Site Key `6LcyqzEsAAAAADdyoXYe8Nz0RNXg0JF--msTJuSY` → in try/catch wrappen (lokales Testen)

### Identität (`localStorage.lmg_currentUser`)
```
{ name, jahrgang, class, userKey, ... }
```
- Schüler-`id` = `userKey` (Fallback: zufällige ID + Namensabfrage)
- Host (Lehrer) braucht keine `userKey` – nur Anzeigename + wählt Jahrgang/Seiten manuell

### Vokabeln (GitHub)
- Base URL: `https://raw.githubusercontent.com/simon23-12/LMG.Vocab.Trainer/main/vocab/english/`
- Dateiname: `voc{jahrgang}_4.json` (z.B. `voc7_4.json`)
- Fetch: `{ headers: {'Accept':'application/json; charset=UTF-8'} }`, JSON kann Array ODER Object sein → `Object.values()` wenn Object
- **Datenshape pro Eintrag:**
```json
{ "English": "...", "German": "...", "Page": "227", "synonyms": ["...", "..."] }
```
- **Jedes** Wort hat eine eigene `synonyms`-Liste → **das ist die primäre Synonymquelle**.

### Bewertungslogik (in `display.html`, zu spiegeln als pure Funktion)
- `checkAnswer(userAnswer, vocab)` → `display.html:2159` (ruft aktuell `handleAnswerResult` für UI auf → muss zu `return {verdict}` umgebaut werden)
- `findTransposition(a,b)` → `display.html:2466` (Buchstabendreher → halbe Punkte)
- `getLevenshteinDistance(a,b)` → `display.html:2487` (Tippfehler)
- `const synonyms = {…}` → `display.html:1578` (~55 Allerweltswörter, **sekundärer** Fallback)

**Logik-Stufen von `checkAnswer` (Reihenfolge):**
1. Normalisierung: lowercase/trim, Satzzeichen am Ende weg, Kontraktionen → Langform, Abkürzungen (sb/sth) expandieren, Klammern-Inhalte optional weg
2. Exakte Übereinstimmung → **correct**
3. Komma-Toleranz (nur Kommas unterschiedlich) → **half** (`comma`)
4. Substring beidseitig (User ≥4 Zeichen in Lösung enthalten o.u.) → **correct**
5. Verb-Variationen (`to`/`(to)` egal) → **correct**
6. `vocab.synonyms` (primär) + hardcoded `synonyms`-Dict (sekundär) → **correct** (`isSynonym`)
7. Nonsense (4+ gleiche Buchstaben) → **wrong**
8. Buchstabendreher (gleiche Länge ≥3, genau 2 vertauschte) → **half** (`transposition`)
9. Levenshtein 1–2 → **wrong** (Tippfehler, kein Synonym)
10. sonst → **wrong**

→ In der Arena: `correct` = volle Punkte, `half` = halbe, `wrong` = 0; jeweils + Zeit-Bonus.

### Navigationsfluss (verifiziert)
- `index.html` = Login. Schüler → `display.html?class=...`; Lehrer → `teacher-dashboard.html`
- **Schülerbereich = `display.html`** → hier Join-Button
- **Lehrerbereich = `teacher-dashboard.html`** → hier Launch-Button

---

## 3. Datenstruktur in RTDB

```
/rooms/{code}
  ├─ status         "lobby" | "running" | "finished"
  ├─ createdAt      <serverTimestamp>   // Cleanup-Schwelle / letzte Aktivität
  ├─ host           { name }
  ├─ config         { jahrgang, pages:[...], numRounds, roundSeconds }
  ├─ currentRound
  │    ├─ nr, total
  │    ├─ phase        "question" | "reveal"
  │    ├─ prompt       <German>          // KEINE Lösung im Klartext!
  │    ├─ startTime, deadline            // Servertime (ms)
  │    ├─ answer       <English>         // erst in phase "reveal" gesetzt
  │    └─ results      [ {id,name,points,verdict,totalScore} ]  // sortiert
  └─ players/{id}
       ├─ name, score
       └─ answers/{rundenNr}: { given:"<getippt>", answeredAt }
```

**Schreibrechte-Logik (App-seitig, nicht via Rules):**
- Host schreibt: `status`, `currentRound`, alle `score`, löscht Raum
- Schüler schreibt: nur eigenen `players/{id}`-Zweig (Name + `answers`)
- Host-Lösung/Synonyme bleiben im Host-RAM (`rounds[]`), nie in DB

**Servertime:** `db.ref('.info/serverTimeOffset')` → `estServerNow = Date.now() + offset`.
Timer wird client-seitig aus `deadline` berechnet → kein Drift.

**Punkteformel (Kahoot-Style):**
```
if wrong → 0
dur = deadline - startTime
frac = max(0, (deadline - answeredAt)) / dur     // 1 = instant, 0 = letzte Sekunde
pts = 500 + round(500 * frac)
if half → pts = round(pts / 2)
```

---

## 4. Ablauf einer Partie

**Phase 0 – Raum erzeugen (Host):** Jahrgang + Seiten + Rundenzahl/Zeit wählen → Vokabeln von GitHub laden → Code generieren → `/rooms/{code}` (status `lobby`) anlegen → `onDisconnect().remove()` + Lazy-Cleanup alter Räume.

**Phase 1 – Lobby:** Code groß am Beamer; Host hört auf `players` → Live-Liste. Schüler joinen mit Code (+ Name aus localStorage). Host klickt „Start" → `status:running`, Rundenliste (N zufällige Vokabeln aus gewählten Seiten) wird im Host-RAM erzeugt.

**Phase 2 – Runde (×10):** Host schreibt `currentRound` (German-Prompt, `startTime`, `deadline`, phase `question`). Schüler: Prompt + Eingabe + lokaler Timer; bei Submit `players/{id}/answers/{nr}` schreiben, Eingabe sperren. Host setzt `setTimeout(roundSeconds + grace)`.

**Phase 3 – Auswertung (Host nach deadline):** Host liest alle `answers/{nr}`, bewertet mit `evaluateAnswer` gegen `rounds[i]`, rechnet Punkte, `score` per Multi-Path-Update, schreibt `currentRound.answer` (Reveal) + `currentRound.results` (sortiert), `phase:reveal`. Alle sehen Lösung + Zwischen-Leaderboard. „Nächste Runde".

**Phase 4 – Siegerehrung:** Nach Runde 10 → `status:finished` + finales Leaderboard. Podium (Top 3 + Liste). „Raum schließen" → `roomRef.remove()`.

### Edge-Cases (wo die Arbeit steckt)
- Schüler reload mitten im Spiel → `currentRound`/`status` lesen, dort einsteigen; Score persistiert in DB (**deshalb Player-Node NICHT bei onDisconnect löschen**)
- Keine Antwort → kein `answers`-Eintrag = 0 Punkte; Host wartet nicht (hartes `deadline`)
- Host verliert Verbindung → `onDisconnect` löscht Raum, Spiel vorbei (akzeptabel)
- Doppel-Join / gleicher Name → `id` eindeutig (userKey/Geräte-ID, nicht Anzeigename)
- Spät-Joiner während `running` → mit 0 Punkten einsteigen lassen

---

## 5. Execution Plan (Bau-Reihenfolge)

- [ ] **Schritt 1 – Scaffold `battlearena.html`:** Firebase-Init (Config + App Check in try/catch), Rollen-Routing (`?role=host|student` + Landing-Screen), Servertime-Offset-Listener. Basis-CSS (Schul-Look: Lila/Blau-Gradient).
- [ ] **Schritt 2 – Shared Logik:** pure `evaluateAnswer(userAnswer, vocab)` → `{verdict:'correct'|'half'|'wrong', reason, isSynonym}` (aus `checkAnswer` gespiegelt) + `findTransposition` + `getLevenshteinDistance` + `synonyms`-Dict (alle 1:1 kopiert, nur `handleAnswerResult`-Calls → `return`). `computePoints()`.
- [ ] **Schritt 3 – Host Setup + Raum:** Jahrgang-Auswahl, Vokabel-Load von GitHub, Seiten-Checkboxen (unique `Page`, numerisch sortiert), Rundenzahl/Zeit, Host-Name → `createRoom()` (Code, `/rooms` set, `onDisconnect`, Lazy-Cleanup).
- [ ] **Schritt 4 – Host Lobby + Game-Loop:** Live-Player-Liste, „Start" → `rounds[]` (Shuffle aus gewählten Seiten) → `startRound` / `endRound` (Auswertung, Multi-Path-Score-Update, Reveal) / `nextRound` → `finishGame` (Podium, Close).
- [ ] **Schritt 5 – Student Flow:** Join-Screen (Code + Name aus localStorage), Lobby-Warten, Runde (Prompt + Timer + Submit + Lock), Reveal/Leaderboard, Podium. Reload-fest.
- [ ] **Schritt 6 – Buttons im Bestand:** Join-Button in `display.html` (Schülerbereich) → `battlearena.html?role=student`; Launch-Button in `teacher-dashboard.html` → `battlearena.html?role=host`. **Nur additive Buttons, keine bestehende Logik anfassen.**
- [ ] **Schritt 7 – Firebase Rules + Test:** `/rooms`-Knoten zu den Rules ergänzen (`.read:true, .write:true`); End-to-End-Smoke-Test (Host + 2 Schüler-Tabs).

### Firebase Rules Ergänzung
```json
"rooms": {
  ".read": true,
  ".write": true
}
```

---

## 6. Offene Mini-Entscheidungen (Defaults gesetzt, anpassbar)
- Rundenzahl 10, Zeit 20s, 1 Vokabel/Runde → alles konfigurierbar im Host-Setup
- Cleanup-Schwelle 30 Min (großzügig wegen Doppelstunden)
- Punkte: 500 Basis + bis 500 Speed-Bonus, halbe Punkte bei Tippfehler/Komma/Dreher
- Spät-Joiner während laufender Runde: erlaubt mit 0 Punkten

---

## 7. Token-Effizienz-Hinweise für die Umsetzung (aus CLAUDE.md)
- `display.html` ~3600 Z., `montigame.html` ~2000 Z. → **nie ganz lesen**, gezielt grepen
- Beim Spiegeln der Logik: die relevanten Zeilenbereiche (1578–1635, 2159–2520) sind bekannt
- Bestehende Dateien: **nur die 2 Buttons** additiv einfügen, sonst nichts ändern
