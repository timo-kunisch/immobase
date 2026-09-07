# PORT.md – Portierung: Cloudflare Workers → Electron-Desktop-App

Dieses Dokument beschreibt die Portierung von ImmoBase (vormals
„Immobilienverwaltung") von einer
Cloudflare-Workers-App (Next.js 16 via OpenNext, D1, R2, Email Service) zu einer
vollständig offline lauffähigen Electron-Desktop-App (Windows + macOS) mit
`better-sqlite3` (SQLite) und Dateisystem-Ablage.

Es werden **keine** Daten migriert (D1/R2 waren leer) – das Schema wird
übernommen, nicht die Inhalte.

## 1. Bestandsaufnahme (Ausgangslage)

### Bindings (wrangler.jsonc)

| Binding | Art | Verwendet in | Ersetzung |
| --- | --- | --- | --- |
| `DB` | D1 (SQLite) | `src/db/index.ts` (Drizzle ORM, `drizzle-orm/d1`) | `better-sqlite3` (synchron, direkt, **ohne ORM-Fassade**) |
| `UPLOADS_BUCKET` | R2 | `src/lib/storage.ts` | Dateisystem unter `<userData>/files/`, Metadaten in SQLite |
| `SEND_EMAIL` | Cloudflare Email Service | `src/lib/email/mailer.ts` | SMTP via `nodemailer` (optional, wenn konfiguriert); sonst Outbox-Log unter `<userData>/logs/outbox.log` |
| `IMAGES` | Cloudflare Images | indirekt (OpenNext-Adapter) | entfällt (Next.js-Bildoptimierung läuft lokal im Node-Server) |
| `ASSETS` | Static Assets | OpenNext-Adapter | entfällt (Next.js standalone liefert Assets selbst aus) |
| `WORKER_SELF_REFERENCE` | Service Binding | OpenNext-Caching | entfällt (kein ISR/SSG in Nutzung) |
| `APP_URL`, `EMAIL_FROM`, `LETTERXPRESS_MODE` | vars | mailer/letterxpress | Umgebungsvariablen bzw. App-Einstellungen (siehe unten) |
| `LETTERXPRESS_USERNAME/-API_KEY` | Secrets | `src/lib/letterxpress.ts` | App-Einstellungen (Tabelle `app_settings`), nie im Repo |

**Nicht vorhanden** (daher nichts zu portieren): KV-Namespaces, Queues,
Cron-Trigger, Durable Objects, WebSocket-Hibernation.

### Worker-only-APIs

`caches.default`, `HTMLRewriter`, `ctx.waitUntil`, `Request.cf` – **wurden im
Code nicht verwendet** (geprüft via Volltextsuche). Einzige Cloudflare-Berührungspunkte
waren `getCloudflareContext()` in exakt drei Dateien (`src/db/index.ts`,
`src/lib/storage.ts`, `src/lib/email/mailer.ts`) sowie der OpenNext-Adapter
(`open-next.config.ts`, `next.config.ts`-Hook `initOpenNextCloudflareForDev`,
`wrangler.jsonc`, `cloudflare-env.d.ts`).

### Frontend/Server-Framework

Next.js 16 (App Router, Server Components + Server Actions), React 19,
Tailwind v4 + shadcn/ui. **Der Server ist Next.js** (kein Hono/Express).

## 2. Zentrale Architektur-Entscheidung: Next.js bleibt der Server

Die Aufgabe schlug „Main startet den bestehenden Server (Hono/Express)" vor.
Der bestehende Server ist hier **Next.js** (Server Components + Server Actions
sind tief in allen ~60 Fachmodul-Dateien verwoben). Eine Umschreibung auf
Hono/Express hätte ein vollständiges Neu-Schreiben von UI und Datenzugriff
bedeutet – maximaler Änderungsumfang ohne fachlichen Gewinn. **Entscheidung:**
Next.js wird im `standalone`-Output gebaut und **in-process** vom
Electron-Main-Prozess auf `127.0.0.1` (Modus `Lokal`) bzw. `0.0.0.0`
(Modus `Host`) gestartet. Der Port wird dynamisch gebunden (Port `0` bzw.
letzter bekannter Port als Präferenz, siehe unten) und nach `listen()` aus
`server.address()` ausgelesen – kein Hardcoding. Das BrowserWindow zeigt auf
diese lokale URL.

Konsequenz für die Aufgaben-Punkte „Queues → setImmediate" / „Crons →
node-cron" / „Durable Objects": entfallen, da nicht vorhanden.

### Warum Port-Präferenz statt reinem Port 0

Transaktions-E-Mails (Passwort-Reset etc.) enthalten absolute Links
(`APP_URL`). Bei jedem Start wechselnder Port würde Links aus älteren Mails
ins Leere laufen lassen. Der Main-Prozess versucht daher zuerst den zuletzt
verwendeten Port (in `settings.json` persistiert), fällt bei Kollision auf
Port `0` (freie Wahl durch das OS) zurück und persistiert den tatsächlichen
Port. `APP_URL` wird nach dem Binden gesetzt – `src/lib/email/mailer.ts`
liest die Variable erst zum Versandzeitpunkt.

## 3. Ersetzungen im Detail

### 3.1 D1 → `better-sqlite3` mit Repository-Layer `src/data/`

- **Keine ORM-Fassade**: Drizzle wurde vollständig entfernt. Sämtlicher
  Datenzugriff liegt in Repository-Modulen unter `src/data/` mit direkter
  `better-sqlite3`-API (`prepare().run()/.get()/.all()`). Kein SQL außerhalb
  von `src/data/`.
- `src/data/db.ts`: Lazy-Singleton (kein Top-Level-Open beim Modul-Import,
  damit `next build` ohne native Bindings auskommt), Pragmas
  `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`.
- `src/data/migrate.ts`: versionierte Migrationen über `PRAGMA user_version`
  (`src/data/migrations/*.ts`, je mit `up` **und** `down`). Beim Start:
  automatisches Migrieren in **einer** Transaktion pro Migrationsschritt,
  vorher Auto-Backup der DB-Datei neben die Datenbank
  (`data.db.pre-migrate-<Zeitstempel>`), Rollback + Fehlerabbruch bei Fehler.
  Ist `user_version` **neuer** als die App kennt: klare Fehlermeldung
  („Datenbank wurde mit einer neueren Version erstellt") statt Absturz.
- `src/data/schema.sql`: Referenz-Gesamtschema (Dokumentation/Review).
- Echte Transaktionen (`db.transaction(...)`) werden jetzt an den Stellen
  genutzt, die unter D1 sequenziell ohne Atomarität arbeiten mussten
  (z. B. Finalisieren der Nebenkostenabrechnung/Wirtschaftspläne/
  Jahresabrechnungen, BetrKV-Brücke).
- Geldbeträge bleiben Decimal-Strings in `TEXT` (Konvention aus
  `src/lib/money.ts` bleibt unverändert), Datumswerte ISO-8601-`TEXT`.
- Boolean-Spalten (`integer` 0/1) und die JSON-Spalte
  `protocols.photo_paths` werden ausschließlich im Repository-Layer
  gemappt/geparst.

### 3.2 R2 → Dateisystem `<userData>/files/`

`src/lib/storage.ts` behält seine öffentliche Funktionssignatur
(`saveUploadedFile`, `saveGeneratedFile`, `deleteUploadedFile`,
`getUploadedFile`, `isValidObjectKey`), schreibt aber auf die lokale Platte
unter `files/<subdir>/<uuid>.<ext>`. Der geschützte Route Handler
`/api/uploads/[...path]` bleibt der einzige Auslieferweg. Der früher in
R2-Custom-Metadata gehaltene Original-Dateiname liegt jetzt in einer
Sidecar-Metadaten-Datei (`<uuid>.<ext>.meta.json`) neben der Datei – so
bleiben `files/` auch bei einem reinen Dateisystem-Backup selbsterklärend.

### 3.3 Cloudflare Email Service → nodemailer / Outbox-Log

`src/lib/email/mailer.ts` behält die fachlichen Funktionen
(`sendVerificationEmail` etc.). Versand über SMTP (Konfiguration
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` – in der Desktop-App
über die Einstellungen, siehe `app_settings`). Ohne SMTP-Konfiguration wird
die Mail in `<userData>/logs/outbox.log` und auf der Konsole protokolliert –
der Auth-Flow bleibt komplett offline testbar.

### 3.4 LetterXpress (Postversand) – bleibt als optionale Online-Funktion

Der Postversand ist per Definition ein externer Dienst und kann nicht offline
arbeiten. Er bleibt als **opt-in**-Funktion erhalten (Modus `test`/`live`),
ist aber **nicht Teil des Kernpfads**: Keine Zugangsdaten → deaktivierte
Schaltflächen mit Hinweis statt Fehler. Zugangsdaten werden nicht mehr als
Umgebungsvariablen/Secrets, sondern in der App-Einstellungs-Tabelle
(`app_settings`) abgelegt (nie im Repo).

### 3.5 Datenexport → Backup-ZIP nach Aufgaben-Format

Der frühere CSV-ZIP-Export (`src/lib/data-export.ts`, `fflate`) wurde durch
das spezifizierte Format ersetzt (`src/data/backup.ts`): eine ZIP mit
`manifest.json` (App-Version, `schemaVersion` = `user_version`, Zeitstempel,
SHA-256 je Datei), `data.db` (ausschließlich über die SQLite-Backup-API
`db.backup()`, nie `fs.copyFile`) und `files/`. Streaming über `archiver`
(mehrere GB-tauglich). Entpacken streaming über `yauzl`. Import validiert
Manifest + Prüfsummen, prüft `schemaVersion` (älter → migrieren, neuer →
ablehnen), legt vorher ein Backup des Ist-Zustands an und arbeitet atomar
(temp entpacken → validieren → umbenennen). Modi **Ersetzen** und
**Zusammenführen** (Konfliktstrategie siehe Kommentar in
`src/data/backup.ts`: Merge fügt fehlende Zeilen per `INSERT OR IGNORE` je
Tabelle hinzu; Dateien werden nur kopiert, wenn sie noch nicht existieren –
bestehende lokale Daten gewinnen immer).

### 3.6 Auth

Das bestehende eigene Session-System (DB-Sessions, httpOnly-Cookie,
Rollen) bleibt unverändert – es ist plattformneutral. Einzige Anpassung:
Das `Secure`-Flag des Session-Cookies folgt jetzt der konfigurierten
`APP_URL` (https → secure), damit der Host-Modus über `http://<lan-ip>`
funktioniert; Bootstrap-Fall (erster Nutzer = ADMIN) unverändert.

### 3.7 Middleware

`src/proxy.ts` bleibt (optimistischer Cookie-Check). Die Cloudflare-
bedingte `experimental-edge`-Begründung entfällt; Next.js führt die Datei im
lokalen Node-Server aus. Der zusätzliche Token-Check für den Host-Modus liegt
nicht in der Middleware, sondern im HTTP-Wrapper des Main-Prozesses (dort
steht die Peer-IP zur Verfügung, in der Middleware nicht) – siehe § 5.

## 4. Electron-Grundgerüst

- **electron-vite** (nur `main` + `preload`; der Renderer ist die Next.js-App
  auf `127.0.0.1:<port>` bzw. im Client-Modus die Host-URL – kein eigener
  Renderer-Build).
- TypeScript `strict` in allen Electron-Sourcen.
- Sicherheit: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, schmale `contextBridge`-API (`electron/preload/index.ts`).
- Daten unter `app.getPath("userData")`: `data.db`, `files/`, `logs/`,
  `settings.json`.
- `requestSingleInstanceLock()`; zweite Instanz fokussiert das bestehende
  Fenster.
- `better-sqlite3` wird beim Packaging von electron-builder gegen die
  Electron-ABI neu gebaut (`@electron/rebuild`); für lokale
  Entwicklungstests (vitest/`next dev`) genügt der Node-Prebuild. Siehe
  README (Umschalten via `npm run rebuild:electron` / `npm run rebuild:node`).
- Logging: `logs/main.log` (einfaches, gecapptes Append-Log, keine externe
  Abhängigkeit nötig).
- **Server-Start im Main-Prozess:** Der Next-Standalone-Server wird NICHT
  über das generierte `server.js` gestartet (das würde nur einen festen Port
  aus `process.env.PORT` binden und den gewählten Port nicht zurückmelden),
  sondern über die dokumentierte Programmatic-API (`require("next")` aus dem
  Standalone-Bundle + `prepare()`/`getRequestHandler()`), eingebettet in
  einen eigenen `http.createServer` mit `listen(<preferredPort> ?? 0)`.
  Die Standalone-Konfiguration kommt aus
  `.next/required-server-files.json` (`__NEXT_PRIVATE_STANDALONE_CONFIG`,
  analog zum generierten server.js).

## 5. Mehrbenutzer (Host-Modus)

- **Die SQLite-Datei liegt niemals auf einem Netzlaufwerk.** Beim Start prüft
  der Main-Prozess den Datenpfad (`electron/main/network-check.ts`):
  - Windows: UNC-Pfade (`\\...`) direkt; gemappte Laufwerksbuchstaben über
    PowerShell (`Get-CimInstance Win32_LogicalDisk`, DriveType 4 = Network).
  - macOS: Pfade unter `/Volumes/...` werden gegen die Ausgabe von `mount`
    geprüft (`smbfs`, `nfs`, `afpfs`, `osxfuse`, `webdav` → Netzwerk).
  - Linux (nur Entwicklung): Heuristik über `/proc/mounts` (cifs/nfs).
  - Befund → Dialog mit Erklärung und **Abbruch** (kein Start mit
    korrumpierbarer DB).
- Modus in `settings.json`: `local` (Default) | `host` | `client`.
- **Host-Architektur (bewusste Entscheidung):** Der Next.js-Server bindet
  IMMER nur an `127.0.0.1` (Loopback, dynamischer Port). Der Host-Modus
  startet zusätzlich einen schlanken, eigenen HTTP-Proxy auf
  `0.0.0.0:<hostPort>` (`electron/main/server.ts`), der das Zugangs-Token
  (Header `x-iv-token` oder Cookie `iv_host_token`) für alle
  Nicht-Loopback-Requests erzwingt (401) und sonst an den Loopback-Server
  weiterleitet. Vorteile: die Token-Prüfung sitzt an genau einer Stelle mit
  Zugriff auf die Peer-IP (die Next-Middleware sieht sie nicht), und die
  lokale App am Host selbst läuft ohne Token-Umweg. Das Token wird beim
  ersten Host-Start erzeugt, in `settings.json` gehalten und kann im
  Verbindungs-Dialog neu erzeugt werden.
- Client: kein lokaler Server/keine lokale DB. Das BrowserWindow lädt die
  Host-Base-URL; das Token wird via `webRequest.onBeforeSendHeaders` auf alle
  Requests an den Host injiziert (plus als Cookie für einfache Navigationen/
  Downloads). Verbindungsstatus mit Reconnect-Backoff läuft über eine lokale
  Shell-Seite (`electron/shell/connect.html`), die bei Ladefehlern
  eingeblendet wird; zusätzlich zeigt Einstellungen → Verbindung den Status
  live in der App an.
- mDNS-Discovery via `bonjour-service` (Host publiziert
  `_immobase._tcp`, Clients browsen) mit manuellem Fallback (URL + Token).

## 6. Build & Distribution

- `electron-builder`: NSIS (Windows x64), DMG (macOS x64 + arm64).
- Code-Signing/Notarisierung: Konfiguration vorbereitet, aber ohne
  Zertifikate deaktiviert (siehe README-Abschnitt „Code-Signing": zu
  beschaffende Artefakte `CSC_LINK`/`CSC_KEY_PASSWORD` (Windows),
  Apple-Certificate, `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`).
- GitHub Actions: `.github/workflows/release.yml` (Matrix windows-latest /
  macos-latest, baut beide Installer; Tags `v*` erzeugen Draft-Release).
- `electron-updater`: eingebunden (GitHub-Provider), prüft beim Start;
  offline schlägt die Prüfung still fehl (nur Log, keine UI-Störung).

## 7. Entfernte Abhängigkeiten (Cloudflare-/D1-Stack)

| Entfernt | Grund |
| --- | --- |
| `@opennextjs/cloudflare` | Zielplattform entfällt |
| `wrangler` | dito |
| `open-next.config.ts`, `wrangler.jsonc`, `cloudflare-env.d.ts` | dito |
| `drizzle-orm`, `drizzle-kit`, `drizzle.config.ts`, `migrations/`, `src/db/` | Ersetzt durch `src/data/` (direktes better-sqlite3) |
| `fflate` | Ersetzt durch `archiver`/`yauzl` (Streaming, Multi-GB) |
| Cloudflare Email Service | Ersetzt durch nodemailer/Outbox |

**Hinzu kamen:** `better-sqlite3`, `archiver` (v7 - die v8 hat eine
inkompatible, klassenbasierte API; v7 ist die stabile Factory-API), `yauzl`,
`nodemailer`, `electron`, `electron-vite`, `electron-builder`,
`electron-updater`, `@electron/rebuild`, `bonjour-service`, `concurrently`.

Details, die beim Portieren auftraten:

- `archiver` ist bewusst auf ^7 gepinnt (siehe oben).
- `better-sqlite3` wird per `outputFileTracingExcludes` NICHT in den
  Next-Standalone-Trace aufgenommen, sondern im Packaging von
  electron-builder gegen die Electron-ABI neu gebaut und nach
  `resources/node_modules/better-sqlite3` kopiert (Node-Modulauflösung per
  Walk-up). Ein im Trace mitgeschleiftes Node-ABI-Binary würde in der
  Electron-Laufzeit abstürzen.
- `formatFileSize` ist von `src/lib/storage.ts` nach `src/lib/format.ts`
  umgezogen, damit Client-Komponenten es importieren können, ohne das
  (nun `server-only` markierte) fs-basierte Storage-Modul ins Browser-Bundle
  zu ziehen.
- Das Session-Cookie-`Secure`-Flag folgt `APP_URL` (https → secure), damit
  Anmeldung im Host-Modus über `http://<lan-ip>` funktioniert.

**Externe Abhängigkeiten, die bewusst bleiben (nicht im Kernpfad):**
LetterXpress-API (Postversand, opt-in, nur bei Konfiguration + Online-Betrieb),
SMTP-Server (nur wenn konfiguriert), GitHub-Releases für Updates (nur wenn
online; offline still).

Fonts: `next/font/google` (Geist) wird **zur Build-Zeit** heruntergeladen und
lokal gebündelt – zur Laufzeit keine externen Requests.

## 8. Verzeichnisstruktur nach der Portierung (Auszug)

```
electron/
  main/           # Main-Prozess (Lifecycle, Server-Bootstrap, IPC, mDNS, Updater)
  preload/        # contextBridge-API (sandbox-sicher)
  shell/          # statische Shell-Seiten (Setup/Client-Verbindung)
src/data/         # Repository-Layer – EINZIGER Ort mit SQL
  db.ts           # better-sqlite3-Verbindung + Pragmas
  migrate.ts      # user_version-Migrationen (up/down, Auto-Backup)
  migrations/     # versionierte Migrationsschritte
  backup.ts       # Export/Import (ZIP, Manifest, SHA-256, db.backup)
  schema.sql      # Referenz-Gesamtschema
  <domain>.ts     # Repositories (createX/listY/...)
```

## 9. Bekannte, bewusste Einschränkungen

- Import-Modus „Zusammenführen" ist zeilenbasiert (`INSERT OR IGNORE`) und
  kein CRDT/Sync-Protokoll – gedacht für „alte Sicherung ergänzen", nicht für
  parallele Mehrgeräte-Bearbeitung derselben Daten.
- Der Next-Server läuft im Produktivbetrieb im Electron-Main-Prozess
  (in-process). Ein Absturz des Servers würde die App mitreißen – die
  Next.js-Standalone-Laufzeit wird daher in einem try/catch mit
  Fehlerdialog + Neustart-Angebot gestartet.
- Update-Feed: GitHub-Releases (öffentlich). Für private Feeds müsste der
  Provider angepasst werden.
