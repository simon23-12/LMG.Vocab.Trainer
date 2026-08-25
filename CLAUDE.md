# LMG Vokabeltrainer

**Typ:** PWA (HTML/CSS/JS), kein Build-Prozess
**Zweck:** Englisch/Latein Vokabeltrainer für Leibniz Montessori Gymnasium Düsseldorf

## Struktur
- [index.html](index.html) - Hauptseite Vokabeltrainer
- [irrverbtrainer.html](irrverbtrainer.html) - Unregelmäßige Verben
- [montigame.html](montigame.html) - Gamification
- [teacher-dashboard.html](teacher-dashboard.html) - Lehrer-Dashboard
- [display.html](display.html) - Präsentationsmodus
- [battlearena.html](battlearena.html) - Kahoot-Style Live-Vokabelquiz (Firebase RTDB)
- [vocab/](vocab/) - JSON-Vokabeldaten (english/, latin/)
- [grammar/](grammar/) - JSON-Grammatikdaten (irrverbs)
- [awards/](awards/) - Award-System Assets
- [service-worker.js](service-worker.js) - Offline-Funktionalität & Cache
- [pwa-install.js](pwa-install.js) - SW-Registrierung & stilles Auto-Reload bei Updates

## Tech
- Vanilla JS, keine Frameworks
- LocalStorage für Fortschritt
- CSS Variables für Dark Mode
- Monolithische HTML-Dateien (Inline CSS/JS)

## ⚠️ PFLICHT: Cache-Version bumpen (sonst sehen User Änderungen nicht!)
Die App cacht aggressiv (Service Worker, "Cache First"). Damit Änderungen live ankommen
und der **stille Auto-Reload** bei allen Usern auslöst, MUSS bei JEDER Code-Änderung an
einer ausgelieferten Datei (HTML, `pwa-install.js`, `service-worker.js`, CSS/JS) die
Version hochgezählt werden.

**Regel für Claude:** Nach jedem Edit an einer solchen Datei **automatisch** in
[service-worker.js](service-worker.js) die `VERSION`-Konstante um 1 erhöhen
(`'v3'` → `'v4'` → …). Eine Stelle, eine Zahl. Nicht vergessen, nicht nachfragen –
einfach miterledigen. (Reine Daten-Edits in `vocab/*.json` brauchen keinen Bump, da
Vokabeln "network-first" geladen werden.)

## Auth & Datenbank (ab Schuljahr 2026/27)

**Keine Selbstregistrierung mehr.** Accounts legt ausschließlich die Lehrkraft an:
`node admin/create-accounts.mjs <klassenliste.csv>` (siehe [admin/README.md](admin/README.md)).

- Anmeldung läuft über **Firebase Authentication** (synthetische Mail `<login>@lmg-vokabel.app`).
- Datenknoten heißt `users/<uid>` — die uid aus Firebase Auth, **nicht** mehr `name_base64(pw)`.
- Lehrer-Recht ist ein **Custom Claim** (`admin: true`), gesetzt per `admin/set-admin.mjs`.
  Kein Passwortvergleich im Client, kein sessionStorage-Flag.
- [auth-guard.js](auth-guard.js) stellt `lmgRequireAuth()` / `lmgLogout()` bereit; jede Seite mit
  Datenbankzugriff ruft den Guard nach `firebase.initializeApp(...)` auf.
- Security Rules stehen in [database.rules.json](database.rules.json) und werden mit
  `node admin/deploy-rules.mjs` deployt. **Rules-Änderung immer zusammen mit dem passenden
  Client-Code deployen**, sonst bricht die App für alle.
- Ranglisten lesen `leaderboard/<klasse>/<uid>` (jeder schreibt nur den eigenen Eintrag),
  **nicht** mehr den kompletten `users`-Baum.
- `.secrets/` und `backups/` sind gitignored und dürfen nie ins Repo.

## Token-Effizienz Regeln
1. **NIE ganze Dateien lesen** - [index.html](index.html) ~800 Zeilen, [montigame.html](montigame.html) ~2000 Zeilen
2. **Grep mit -A/-B verwenden** für Kontext statt Read
3. **Nur betroffene Funktionen editieren**, niemals ganze <script>/<style> Blöcke
4. **JSON-Dateien ignorieren** außer explizit verlangt (vocab/*.json sind nur Daten)
5. **Keine Exploration** - Struktur ist jetzt bekannt
6. **Task-Tool vermeiden** - direktes Grep/Edit bevorzugen
7. **Bei Änderungen**: Grep → minimaler Edit → fertig
8. **Kein "Verstehen" nötig** - direkt zur Problemstelle

## Typische Tasks
- Vokabel/Grammatik-JSON hinzufügen → direktes Edit
- UI-Änderung → Grep nach CSS-Selektor/Funktion → punktueller Edit
- Bug-Fix → Grep nach Funktion → Edit nur die Zeilen
- Feature → frag erst WELCHE Datei, dann minimaler Edit

**WICHTIG:** Dieses Projekt hat große monolithische Dateien. Token-Budget schonen!
