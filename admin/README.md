# Admin-Werkzeuge

Laufen **nur lokal** und brauchen `.secrets/firebase-admin.json` (gitignored, nie hochladen).
Alle Skripte fragen vor schreibenden Aktionen nach; `--yes` überspringt die Rückfrage.

| Befehl | Zweck |
|---|---|
| `node admin/backup.mjs` | Vollbackup der Datenbank nach `backups/` |
| `node admin/deploy-rules.mjs` | `database.rules.json` live schalten (sichert die alten Rules vorher) |
| `node admin/deploy-rules.mjs --show-current` | Nur anzeigen, was gerade live ist |
| `node admin/create-teacher.mjs <login> <passwort> "<Name>"` | Lehrer-Account + Admin-Recht |
| `node admin/set-admin.mjs <login> [--off]` | Admin-Recht vergeben/entziehen |
| `node admin/create-accounts.mjs <liste.csv> [--dry]` | Schüler-Accounts aus Klassenliste anlegen |
| `node admin/list-accounts.mjs [klasse]` | Übersicht der angelegten Accounts |
| `node admin/archive-users.mjs <schuljahr>` | Alten `users`-Baum nach `archive/` verschieben |
| `node admin/delete-accounts.mjs <login> …` | Accounts vollständig löschen (Auth + Daten + Leaderboard) |
| `node admin/cleanup-orphans.mjs [--loeschen]` | Auth-Accounts ohne Datenknoten finden/entfernen |
| `node admin/anonymize-names.mjs [--dry]` | Anzeigenamen ueberall auf den Login-Namen ziehen |

## Anzeigenamen

In Firebase steht als `name` **nur der Login** (`PaulB`) — in der Begruessung, der
Lehreruebersicht, der Rangliste und der Battle Arena taucht nichts anderes auf.
Der Klarname bleibt ausschliesslich in den Zugangsdaten-Listen unter `backups/`.
`create-accounts.mjs` macht das automatisch; `anonymize-names.mjs` zieht Altbestaende nach.

## Klassenliste (CSV)

Kopfzeile mit `klasse,vorname,nachname`, Trennzeichen Komma oder Semikolon:

```csv
klasse;vorname;nachname
5a;Lena;Müller
5a;Tim;Schäfer
```

Immer erst `--dry` laufen lassen: zeigt Login-Namen, Klassenverteilung und Beispielpasswort,
ohne etwas zu schreiben.

Login-Namen entstehen als `<klasse>.<nachname>.<initial>` (Umlaute aufgelöst), bei Namensgleichheit
mit angehängter Ziffer. Passwörter sind sprechbar (`wolke-anker-42`), damit auch Fünftklässler sie
abtippen können.

Nach dem Lauf liegen in `backups/`:
- `zugangsdaten-<stamp>.csv` — zum Weiterverarbeiten
- `zugangsdaten-<stamp>.html` — im Browser öffnen und drucken, eine Seite pro Klasse

**Die Passwörter stehen nur in dieser Datei im Klartext.** In der Datenbank liegen sie nicht;
Firebase speichert nur einen Hash. Passwort vergessen → `create-accounts.mjs` erneut für die
betroffene Klasse laufen lassen (setzt neue Passwörter) oder in der Firebase Console zurücksetzen.
