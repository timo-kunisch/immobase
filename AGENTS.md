# Mietverwaltung – Projekt-Anweisungen für KI-Agenten

Diese Datei ist die zentrale, dauerhafte Kontextquelle für dieses Repository. Jede KI (und jeder
Mensch), der hier arbeitet, soll sie **zuerst** lesen. Sie ersetzt keine README.md (die richtet sich
an Menschen/Setup-Anleitung), sondern ergänzt sie um verbindliche Arbeitsregeln, Architektur und
Konventionen.

## 1. Projektzweck

„ImmoBase" ist eine **offline lauffähige Electron-Desktop-App** (Windows, macOS, Linux) zur
Verwaltung von **Mietobjekten** – Liegenschaften, Mieteinheiten, Mieter, Mietverträge,
Instandhaltungs-Tickets, Finanzen (Kaution/Mieteingänge), Nebenkostenabrechnung und Dokumente (DMS).
Additive Erweiterung um die **WEG-Verwaltung** (Wohnungseigentümergemeinschaften nach deutschem WEG
i. d. F. nach der Reform 2020): Eigentümer, Miteigentumsanteile, Wirtschaftsplan, Jahresabrechnung,
Hausgeld, Erhaltungsrücklage, Eigentümerversammlungen/Beschluss-Sammlung. Beide Bereiche sind additiv
nebeneinander modelliert (eine Liegenschaft KANN, muss aber nicht, eine WEG sein) und beeinflussen
sich nur über die explizite, opt-in nutzbare BetrKV-Brücke für vermietete Eigentumswohnungen.

## 2. Tech-Stack & Architektur

- **Next.js 16** (App Router, TypeScript, Turbopack für `dev`/`build`) als **eingebetteter lokaler
  Server**: Der Electron-Main-Prozess startet den Next.js-Standalone-Build **in-process** auf
  `127.0.0.1` mit dynamischem Port (bevorzugt zuletzt verwendeter Port aus `settings.json`, sonst
  Port `0`; tatsächlicher Port wird nach `listen()` aus `server.address()` gelesen). Das
  BrowserWindow lädt diese lokale URL. Es gibt **keinen** separaten Renderer-Build (kein separater
  HTTP-Server, kein Vite-Renderer).
  - Quellcode liegt unter `src/` (Pfad-Alias `@/*` → `./src/*`).
  - `src/proxy.ts` ist nur der günstige, optimistische Cookie-Check (kein DB-Zugriff). Der
    Token-Check für den Host-Modus liegt im HTTP-Proxy des Main-Prozesses
    (`electron/main/server.ts`), weil nur dort die Peer-IP verfügbar ist.
  - Dynamische Request-APIs (`cookies()`, `headers()`, `params`, `searchParams`) sind **async**.
  - Datenbank-Zugriffe erfolgen direkt in async Server Components; Seiten mit DB-Zugriff haben
    `export const dynamic = "force-dynamic";`.
- **SQLite über `better-sqlite3`** (synchron, KEIN ORM): `src/data/` ist der
  **Repository-Layer** – Domänen-Operationen (`createX`, `listY`), **kein SQL außerhalb dieses
  Ordners**.
  - `src/data/db.ts` – Lazy-Singleton (kein Top-Level-Open beim Import, damit `next build` keine
    native Bindung lädt). Pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`.
  - `src/data/migrate.ts` + `src/data/migrations/*.ts` – versionierte Migrationen über
    `PRAGMA user_version` (je mit `up` **und** `down`). Automatisches Migrieren beim ersten
    `getDb()` (pro Schritt eine Transaktion, Auto-Backup `data.db.pre-migrate-*` davor, Rollback bei
    Fehler). DB neuer als App → `DatabaseTooNewError` (klare Meldung statt Absturz).
    `src/data/schema.sql` ist die generierte Referenz (`npm run schema:dump` nach Schema-Änderung;
    Konsistenz-Test `src/data/schema.test.ts`).
  - Echte Transaktionen (`db.transaction(...)`) für zusammenhängende Mehr-Schreib-Operationen
    (z. B. `finalizeBillingPeriod`, `finalizeEconomicPlan`, `finalizeAnnualStatement`,
    `generateDueTransactions`, Beschluss-Nummernvergabe).
  - better-sqlite3 liefert Booleans als `0/1` und die JSON-Spalte `protocols.photo_paths` als TEXT –
    Mapping ausschließlich im Repository (`src/data/helpers.ts`: `boolToInt`/`intToBool`/
    `jsonStringify`/`jsonParseArray`).
  - Geldbeträge als **Decimal-String** in `TEXT` (`src/lib/money.ts`), Datumswerte ISO-8601-`TEXT`,
    Enums als `TEXT` mit TS-Union-Typen (Gültigkeit anwendungsseitig).
- **Dateiablage** unter `<userData>/files/`: ausschließlich über `src/lib/storage.ts`
  (einzige Datei mit direktem Dateisystem-Zugriff für Uploads). Original-Dateiname/MIME-Type in
  Sidecar-Dateien (`<name>.meta.json`). Auslieferung nur über den geschützten Route Handler
  `src/app/api/uploads/[...path]/route.ts` (autoritativ `requireUser()`-geprüft).
- **Datenverschlüsselung at rest** (AES-256-GCM, gerätegebundener Master-Schlüssel):
  `src/lib/file-crypto.ts` (Container-Format: Magic `IMMOBASE-FILE-ENC:v1` + Nonce + Ciphertext +
  Auth-Tag am Dateiende, streaming) verschlüsselt alle NEU abgelegten Dateien in `files/`; der
  Lesepfad erkennt das Magic und entschlüsselt transparent (ältere Klartext-Bestände bleiben
  lesbar). Bestandsmigration idempotent + pro Datei atomar via `encryptPlaintextFilesInTree()`:
  automatisch beim Server-Start (`src/instrumentation.ts`), nach jedem Backup-Import und manuell
  in den Einstellungen. Geheimnisse in `app_settings` (`smtp.pass`, `letterxpress.apikey`) sind
  FELD-verschlüsselt (`"enc:v1:"`-Präfix, transparent in `src/data/app-settings.ts`; nicht
  entschlüsselbarer Wert = `undefined`, fail-closed). **Backups bleiben portierbar**: Der Export
  entschlüsselt Dateien gestreamt ins ZIP (Manifest-Prüfsummen über dem Klartext) und Secrets in
  der DB-Snapshot-Kopie; der Import verschlüsselt mit dem lokalen Schlüssel wieder.
- **Master-Schlüssel** (`src/lib/data-key.ts`, 32 Bytes): Die Desktop-App
  (`electron/main/data-key.ts`) legt ihn mit dem OS-Schlüsselbund verschlüsselt in `settings.json`
  ab (`safe:`-Präfix, Electron safeStorage; `plain:`-Fallback ohne Schlüsselbund, z. B. Linux ohne
  Secret Service) und übergibt ihn an den eingebetteten Server via `IMMOBASE_DATA_KEY`. Fallback
  ohne Electron (Browser-Dev/Tests): Schlüsseldatei `<dataDir>/.data-key` (0600). Die Marker-Datei
  `.data-key.managed` verhindert, dass ein Server ohne übergebenen Schlüssel still einen neuen
  erzeugt. Wiederherstellungsschlüssel (base64) in der Admin-UI einsehbar (Einstellungen →
  Lokale Datenverschlüsselung).
- **Datenbank-Verschlüsselung at rest** (Container, `src/data/db-vault.ts`): Im Ruhezustand liegt
  die SQLite-DB als `data.db.enc` (gleiches AES-256-GCM-Container-Format wie Dateien) vor.
  `getDb()` entschlüsselt synchron vor dem Öffnen (atomar Temp+rename; Fehler = harter Abbruch,
  niemals still mit leerer DB starten); beim Prozessende versiegelt `sealDatabaseForShutdown()`
  (WAL-Checkpoint → close → Container atomar schreiben → Klartext inkl. WAL/SHM löschen),
  registriert über `exit`/`SIGINT`/`SIGTERM`-Hooks in `src/data/db.ts` (in vitest deaktiviert).
  Alle Schritte sind atomar, Crash-Fälle (beide Dateien vorhanden/Tmp-Reste) werden beim
  Entsperren konsistent aufgelöst. **Einschränkung bewusst akzeptiert:** Zur Laufzeit und nach
  einem nicht sauberen Beenden (Kill/Stromausfall) liegt die DB im Klartext vor - SQLCipher kam
  nicht infrage (kein gepflegter better-sqlite3-kompatibler Fork: `@journeyapps/sqlcipher` v6 =
  node-sqlite3-Basis ohne Windows-Support; `better-sqlite3-sqlcipher` = 2019/OpenSSL 1.0.2).
  Auto-Backups sind ebenfalls Container: `data.db.pre-migrate-*.enc` (migrate.ts) und
  `backups/pre-import-*.zip.enc` (backup.ts; Import erkennt sie am Magic).
  Verzeichnisse/`data.db`/`settings.json` sind auf 0700/0600 gehärtet.
- **E-Mail** über `nodemailer` (SMTP), konfiguriert in der App unter Einstellungen →
  Online-Integrationen (Tabelle `app_settings`, Zugriff nur über `src/data/app-settings.ts`; Fallback
  Umgebungsvariablen für Dev/Tests). Ohne SMTP: Protokollierung in `<userData>/logs/outbox.log`
  (Klartext-Log – enthält E-Mail-Inhalte, bei Bedarf leeren). **E-Mail-abhängige Funktionen sind
  ohne Konfiguration deaktiviert** (`isSmtpConfigured()`): Kontakt-Dialog (UI-Hinweis +
  Server-Check), Freigabe-Benachrichtigung im Admin-Bereich (wird übersprungen, Admin erhält
  Hinweis im Aktionsergebnis).
- **Postversand von PDFs** über die externe **LetterXpress API v3** (`src/lib/letterxpress.ts`) –
  **optionale Online-Funktion, nicht Teil des Offline-Kernpfads**: ohne Zugangsdaten sind die
  Versand-Buttons deaktiviert (`isLetterXpressConfigured()`) **und** `sendPdfByPostForSource()`
  (`src/lib/postal-shipments.ts`, zentraler Durchgang aller Versand-Actions) bricht serverseitig
  früh ab (ohne FAILED-Protokoll-Eintrag); Zugangsdaten in `app_settings`.
- **Backup/Restore**: `src/data/backup.ts` (ZIP: `manifest.json` mit SHA-256 je Datei + `data.db`
  via `db.backup()` + `files/`; `archiver`/`yauzl` streaming, Multi-GB). Optional
  passwortverschlüsselt: `src/lib/backup-crypto.ts` (AES-256-GCM + scrypt, eigener
  `.imbak`-Container mit Magic-Header, Auth-Tag am Dateiende, streaming; Import erkennt
  Container am Magic und verlangt dann zwingend das Passwort). UI: Einstellungen →
  Datensicherung (Desktop: native Dateidialoge via IPC + POST an `/api/backup/*`; Browser-Dev:
  Download-Fallback via GET `/api/backup/export`, dort nur unverschlüsselt). Die automatische
  Vor-Import-Sicherung wird mit dem lokalen Datenschlüssel verschlüsselt abgelegt
  (`backups/pre-import-*.zip.enc`, Container-Format; der Import erkennt sie am Magic).
- **Electron-Shell** unter `electron/` (electron-vite, nur main+preload, TS strict):
  - `main/index.ts` – Lifecycle, `requestSingleInstanceLock()`, Netzlaufwerk-Abbruch-Check,
    Modus-Orchestrierung (local/host/client), IPC, Fenster-Sicherheit (`contextIsolation: true`,
    `nodeIntegration: false`, `sandbox: true`).
  - `main/server.ts` – Next-Standalone-Bootstrap + Token-geschützter LAN-Proxy (Host-Modus).
  - `main/network-check.ts` – Netzlaufwerk-Erkennung (Windows UNC/gemappt via PowerShell, macOS
    `/Volumes`+`mount`, Linux `/proc/mounts`). **Die SQLite-DB liegt niemals auf einem
    Netzlaufwerk** – bei Befund wird der Start mit Erklärung abgebrochen.
  - `main/discovery.ts` – mDNS via `bonjour-service` (`_immobase._tcp`), manueller Fallback.
  - `main/settings.ts` – `settings.json` (Modus, Ports, Tokens) im userData-Verzeichnis.
  - `main/updater.ts` – `electron-updater` (GitHub-Releases); offline still fehlschlagend. Der
    Update-Status (`UpdateState`) geht per IPC (`iv:update-state`) an den Renderer; das UI blendet
    bei gefundenem/geladenem Update eine Hinweisleiste ein
    (`src/components/layout/update-banner.tsx`, Fehler bleiben bewusst ohne UI) und kann die
    Installation sofort auslösen (`iv:install-update` → `quitAndInstall()`).
  - `preload/index.ts` – schmale `contextBridge`-API (`window.iv`), Vertragstypen in
    `src/lib/desktop-bridge.ts`.
  - `shell/connect.html` – Setup-/Verbindungs-Seite (Moduswahl, Client-Verbindung, Discovery-Liste,
    Reconnect mit Backoff, „Zurück zur App“ ohne Moduswechsel/Server-Neustart via
    `iv:shell-back-to-app`).
- **Server Actions** für alle CRUD-Operationen. Muster: `useActionState` in Client-Dialogen +
  `"use server"`-Funktionen in `src/app/<modul>/actions.ts` + `revalidatePath`. **Jede** Server
  Action prüft selbst `requireUser()`/`requireAdmin()` (Defense-in-Depth).
- **Authentifizierung** (eigenes System): E-Mail+Passwort, DB-Sessions über httpOnly-Cookie
  (`session_token`), Rollen `ADMIN`/`USER`. Details: Abschnitt 3.
- **`pdfkit`** (PDF-Erzeugung, `src/lib/pdf/`) über den Importpfad `"pdfkit/js/pdfkit.standalone"`
  (inline Font-Metriken – kein `fs.readFileSync` zur Laufzeit).
- **`archiver`** (ZIP-Export) und **`yauzl`** (ZIP-Import) statt `fflate` (Streaming statt
  In-Memory, Multi-GB-tauglich).

## 3. Authentifizierung (Details)

- **Routen-Struktur** (Next.js Route-Groups, ändern NICHTS an den URLs):
  - `src/app/(auth)/` – öffentliche Seiten ohne Sidebar: `/login`, `/register`, `/verify-email`,
    `/forgot-password`, `/reset-password`.
  - `src/app/(setup)/` – öffentliche Ersteinrichtung `/setup` (Setup-Wizard, eigenes breiteres
    Layout, kein Sidebar): nur erreichbar, solange **noch kein Benutzerkonto existiert**
    (`countUsers() === 0`); danach leitet die Seite zu `/login` um und jede Setup-Action sperrt
    sich über `ensureSetupAllowed()`. Umgekehrt leiten `/login` und `/register` bei leerer
    Nutzertabelle zu `/setup` um.
  - `src/app/(app)/` – geschützter App-Bereich (Dashboard + alle Fachmodule + `/admin/users` +
    `/einstellungen`) mit Sidebar. `src/app/(app)/layout.tsx` ruft `requireUser()` auf.
  - `src/app/(app)/admin/` und `src/app/(app)/einstellungen/` haben je ein zusätzliches
    `layout.tsx`, das `requireAdmin()` aufruft.
- **Zwei-Schichten-Schutz:**
  1. `src/proxy.ts`: **nur** optimistischer Cookie-Check (kein DB-Zugriff).
  2. `src/lib/auth/dal.ts`: `getCurrentUser()` (React `cache()`-memoized), `requireUser()`,
     `requireAdmin()` – autoritative Prüfung (DB, Ablauf, `isApproved`, `emailVerified`, Rolle).
     Wird in Layouts **und** in jeder Server Action aufgerufen.
- **Bootstrapping** (`src/lib/auth/bootstrap.ts`, genutzt von Setup-Wizard und Registrierung): Der
  **erste** Nutzer wird automatisch `ADMIN` + `isApproved=true`. Alle weiteren: `USER` +
  `isApproved=false`, bis ein Admin sie unter `/admin/users` freischaltet. Der Normalpfad für das
  erste Konto ist der **Setup-Wizard** `/setup` (Willkommen → Absenderdaten → Online-Integrationen →
  Administratorkonto; die beiden mittleren Schritte sind überspringbar, das Konto wird bewusst als
  letzter Schritt angelegt, damit der `countUsers() === 0`-Guard für alle Setup-Actions gilt). Ohne
  SMTP meldet die letzte Setup-Action den Nutzer direkt an (Session + Redirect auf `/`); mit SMTP
  gilt der klassische Verifizierungslink-Flow über `/login`.
- **Login-Bedingungen** (beide erforderlich): `emailVerified != null` UND `isApproved == true`.
  Die E-Mail-Verifizierung ist an `isSmtpConfigured()` (`src/lib/email/mailer.ts`) gekoppelt: **Ohne
  SMTP-Konfiguration** (Normalfall der offline laufenden Desktop-App) kann eine Verifizierungs-Mail
  niemanden erreichen – Registrierung markiert die Adresse daher sofort als bestätigt und der Login
  bestätigt sie nach erfolgreicher Passwortprüfung automatisch nach (Self-Healing für Bestands-
  konten). **Mit SMTP** gilt der klassische Verifizierungslink-Flow. Passwort-Reset-Links landen
  ohne SMTP weiterhin nur in `logs/outbox.log` (Hinweis im UI der Forgot-Password-Seite).
- **WICHTIGE Falle bei `"use server"`-Dateien:** nur async Funktionen exportieren (+
  `export type`). Keine Objekt-/Wert-Exporte. Daher liegen `LoginState`/`initialLoginState`
  (`src/lib/auth/login-state.ts`) und `TemplatePreviewState`/`initialPreviewState`
  (`src/app/(app)/vorlagen/preview-state.ts`) in separaten Dateien ohne `"use server"`.
- **Datenbank-Sessions** (`src/lib/auth/session.ts`): Das Cookie enthält nur einen zufälligen Token;
  serverseitiger Widerruf über `destroyAllSessionsForUser()` (Freigabe-Entzug, Passwort-Reset).
- **Cookie-`Secure`-Flag**: folgt der `APP_URL` (nur `https://` → `secure`), damit der Host-Modus
  über `http://<lan-ip>` funktioniert.
- **Passwort-Hashing:** `bcryptjs` (12 Runden); Login vergleicht immer (Dummy-Hash bei unbekannter
  E-Mail – Timing-Schutz).

## 4. Verzeichnisstruktur

```
electron/
  main/                     # Main-Prozess (index/server/settings/network-check/discovery/updater/log/data-key)
  preload/index.ts          # contextBridge-API (window.iv)
  shell/connect.html        # Setup-/Verbindungsseite (plain HTML/JS, kein Build)
  tsconfig.json             # strict TS für die Shell (npx tsc -p electron/tsconfig.json)
src/
  app/
    (app)/                  # Geschützter Bereich, mit Sidebar (requireUser() im Layout)
      <modul>/
        page.tsx            # Server Component, lädt Daten via Repository-Layer
        actions.ts          # "use server"-Funktionen (CRUD), je requireUser()/requireAdmin()
      weg/                  # WEG-Verwaltung - flache Top-Level-Module (siehe Abschnitt 7.1)
      actions/dashboard.ts  # Dashboard-Orchestrierung (kein "use server" - reines Lesen)
    (auth)/                 # Öffentliche Auth-Seiten, ohne Sidebar
    (setup)/setup/          # Ersteinrichtungs-Wizard (nur solange countUsers() === 0)
    api/uploads/[...path]/  # Geschützter Route Handler für Dateiauslieferung
    api/backup/export|import/  # Backup-Routen (requireAdmin())
    layout.tsx              # Root-Layout (Fonts, TooltipProvider)
    globals.css             # Tailwind v4 + shadcn-Theme + tr:target-Highlight
  components/
    ui/                     # shadcn/ui-Basiskomponenten (via `npx shadcn add`)
    <modul>/                # Modul-spezifische Dialoge/Formulare (Client Components)
    layout/                 # AppSidebar, SiteHeader, ContactAdminDialog
  data/                     # REPOSITORY-LAYER - EINZIGER Ort mit SQL
    db.ts                   # better-sqlite3 Lazy-Singleton + Pragmas + Shutdown-Versiegelung
    db-vault.ts             # Container-Verschlüsselung der DB at rest (unlock/lock)
    migrate.ts              # user_version-Migrationen (up/down, Auto-Backup, Rollback)
    migrations/             # versionierte Migrationsschritte (TS-Module mit SQL-Strings)
    schema.sql              # generierte Referenz (npm run schema:dump)
    backup.ts               # Export/Import (ZIP, Manifest, SHA-256, db.backup)
    app-settings.ts         # Key/Value-App-Konfiguration (SMTP, LetterXpress, URL-Overrides)
    <domain>.ts             # Repositories (createX/listY/...)
  lib/
    auth/                   # dal.ts, session.ts, tokens.ts, password.ts, validation.ts, bootstrap.ts, actions.ts
    email/mailer.ts         # nodemailer/Outbox-Log
    pdf/                    # document.ts (Briefe), billing-statement.ts (Abrechnungen)
    storage.ts              # Dateisystem-Ablage (files/)
    data-key.ts             # Master-Schlüssel (Env aus Electron / Schlüsseldatei-Fallback)
    file-crypto.ts          # AES-256-GCM-Dateiverschlüsselung at rest + Bestandsmigration
    letterxpress.ts         # LetterXpress-API (optionaler Postversand)
    postal-shipments.ts     # Postversand-Orchestrierung (Quelle -> PDF -> LetterXpress -> DB)
    backup-crypto.ts        # Passwort-Verschlüsselung für Backups (AES-256-GCM + scrypt, .imbak)
    billing.ts              # Nebenkostenabrechnungs-Berechnung (reine Funktionen)
    hoa-*.ts                # WEG-Berechnungslogik (reine Funktionen, vitest-getestet)
    money.ts, date-range.ts, rent-history.ts, lease-status.ts, hoa-ownership.ts
    templates.ts            # Platzhalter-System für Dokumentvorlagen
    desktop-bridge.ts       # Typen für window.iv (Electron-Brücke)
    format.ts, action-state.ts, form-data.ts, id.ts, utils.ts
  proxy.ts                  # Auth-Guard (optimistischer Cookie-Check)
  instrumentation.ts        # Server-Start-Hook: Bestandsmigration der Datenverschlüsselung
scripts/dump-schema.mjs     # Regeneriert src/data/schema.sql aus den Migrationen
electron.vite.config.ts     # electron-vite (nur main+preload)
electron-builder.yml        # Packaging (NSIS/ZIP/AppImage, extraResources, publish)
.github/workflows/release.yml
```

## 5. Entwicklungs- und Deployment-Kommandos

```bash
npm install                 # Dependencies installieren (Node-ABI-Prebuild für better-sqlite3)
npm run dev                 # next dev (Browser-Entwicklung, Daten in ./data-dev)
npm run electron:dev        # Electron + next dev (Desktop-Entwicklung)
npm run rebuild:electron    # better-sqlite3 gegen Electron-ABI bauen (für electron:dev/dist)
npm run rebuild:node        # zurück auf Node-ABI (für test/dev/build)
npm run build               # next build (Standalone-Output .next/standalone)
npm run lint                # eslint .
npm run test                # vitest run
npm run schema:dump         # src/data/schema.sql aus Migrationen neu erzeugen
npm run pack                # vollständiger Build + electron-builder --dir (ungepackter Smoke-Test)
npm run dist                # vollständiger Build + Pakete (NSIS/ZIP/AppImage) für die aktuelle Plattform
npx tsc -p electron/tsconfig.json   # Typcheck der Electron-Sourcen (electron-vite transpiliert nur!)
```

**Vor dem Abschluss jeder Aufgabe:** `npm run lint`, `npm run test`, `npm run build` sowie
`npx tsc -p electron/tsconfig.json` lokal verifizieren. Für einen echten Desktop-Smoke-Test
zusätzlich `npm run pack`.

**Nach jeder Schema-Änderung:** neue Migration als `src/data/migrations/NNNN_name.ts` anhängen
(`up` + `down`, Version lückenlos), `migrations/index.ts` ergänzen, `npm run schema:dump`
ausführen (src/data/schema.test.ts prüft die Konsistenz). Bestehende Migrationen nie editieren.

## 6. Datenmodell-Übersicht

Gegliedert in folgende fachliche Bereiche (siehe `src/data/migrations/0001_init.ts` bzw.
`src/data/schema.sql` für die vollständigen Definitionen und `src/data/types.ts` für die TS-Typen):

- **Stammdaten:** `properties`, `units` (inkl. optionalem `coOwnershipShare` für WEGs), `tenants`
- **Verträge:** `leases`, `rent_adjustments`
- **Zählerstände:** `meters`, `meter_readings` (Datenmodell vorhanden, **noch keine eigene UI**)
- **Kaution:** `deposits`
- **Übergabeprotokolle:** `protocols` (Datenmodell vorhanden, **noch keine eigene UI**)
- **Tickets:** `tickets`
- **Dokumente (DMS):** `documents`
- **Finanzen:** `transactions`
- **Nebenkostenabrechnung:** `billing_periods`, `cost_items`, `consumption_values`,
  `tenant_statements`, `tenant_statement_lines`
- **Dokumentvorlagen:** `document_templates`, `generated_documents`
- **WEG-Verwaltung:** siehe Abschnitt 6.1
- **Postversand:** `postal_shipments` (polymorph über `sourceType`/`sourceId`)
- **Einstellungen:** `company_settings` (Singleton, feste `id = "singleton"`), `app_settings`
  (technische Key/Value-Konfiguration: SMTP, LetterXpress, URL-Overrides – keine Fachdaten;
  Geheimnisse wie `smtp.pass`/`letterxpress.apikey` sind feldverschlüsselt, transparent über
  `src/data/app-settings.ts`)
- **Authentifizierung:** `users`, `sessions`, `verification_tokens`, `password_reset_tokens`

### 6.1 WEG-Verwaltung (Wohnungseigentümergemeinschaften)

Additive Erweiterung um WEG-Verwaltung nach deutschem WEG i. d. F. nach der Reform 2020.
Naming-Konvention: `hoa`/`Hoa` im Code, UI deutsch.

- **Stammdaten:** `hoas` (1:1 an `properties`, `totalShares` = Nenner der Miteigentumsanteile),
  `owners`, `unit_ownerships` (zeitversioniert, inkl. optionalem `coOwnerId`)
- **Frei definierbare Verteilerschlüssel:** `hoa_custom_allocation_keys`,
  `hoa_custom_allocation_key_weights`
- **Wirtschaftsplan:** `economic_plans`, `economic_plan_unit_shares` (eingefroren nach Finalisierung)
- **Jahresabrechnung:** `annual_statements`, `annual_statement_unit_results` (inkl.
  Abrechnungsspitze), `annual_statement_unit_result_lines`
- **Kostenpositionen (Plan + Abrechnung gemeinsam):** `hoa_cost_items` (Diskriminator `context` =
  `"PLAN"`/`"STATEMENT"`), `hoa_cost_item_consumption_values`
- **Hausgeld:** `housing_charges`
- **Erhaltungsrücklage:** `reserve_fund_bookings` (Vermögensbericht wird berechnet, nicht
  gespeichert)
- **Eigentümerversammlungen/Beschluss-Sammlung:** `owner_meetings`, `owner_meeting_agenda_items`,
  `owner_resolutions` (fortlaufende Nummerierung nach § 24 Abs. 6 WEG, `contestedUntil` aus der
  Anfechtungsfrist nach § 45 WEG berechnet)

**Getroffene Annahmen** (Details als Kommentare im jeweiligen Code):

1. Eine Liegenschaft KANN eine WEG sein (1:1) – eine Einheit kann gleichzeitig WEG-zugeordnet UND
   vermietet sein (Regelfall bei vermieteten Eigentumswohnungen, Grundlage der BetrKV-Brücke).
2. Der Miteigentumsanteil (MEA) liegt auf `units.coOwnershipShare` (nicht versioniert).
3. Eigentumsverhältnisse sind zeitversioniert (taggenaue Umlage bei unterjährigem
   Eigentümerwechsel).
4. Miteigentümer als `coOwnerId` ohne anteilige Hausgeld-Aufteilung.
5. `company_settings`-Singleton dient auch als Verwalter-Absender für WEG-Korrespondenz.
6. Verteilerschlüssel fest (`MEA`, `LIVING_SPACE`, `UNITS`, `CONSUMPTION`, `DIRECT`) oder frei
   (`CUSTOM`).
7. Wirtschaftsplan und Jahresabrechnung teilen `hoa_cost_items` mit Diskriminator `context`.
8. `hoaCostItems.isApportionable` nur für `context = "STATEMENT"` fachlich relevant
   (BetrKV-Brücke, `src/lib/hoa-betrkv-bridge.ts`; Übertrag je Position als `DIRECT`-Position in
   Höhe des berechneten WEG-Anteils).
9. Vermögensbericht (§ 28 Abs. 4 WEG) vereinfacht (Rücklagenstand + offene Hausgeldforderungen).

## 7. Code-Konventionen

- **Deutsche Sprache** für UI-Texte, Kommentare und Commit-Kommunikation.
- **Tabs** statt Spaces (an bestehenden Dateien orientieren).
- **Server Actions:** Rückgabetyp `ActionState` (`src/lib/action-state.ts`) für die meisten
  Formular-Actions; eigene State-Typen in separaten Dateien ohne `"use server"` (Muster:
  `login-state.ts`, `preview-state.ts`). **Jede** Server Action beginnt mit `await requireUser()`
  bzw. `await requireAdmin()`.
- **Datenbankzugriff:** Ausschließlich über Repositories unter `src/data/` (direktes
  better-sqlite3). Repositories sind **synchron** – bestehende `await`-Aufrufe sind harmlos,
  Repo-Funktionen selbst nie `async` machen. SELECTs mit Spalten-Aliassen in camelCase
  (`zip_code AS zipCode`), sodass Zeilen direkt den Typen aus `src/data/types.ts` entsprechen.
  `create*` setzt `id` (`newId()`) + `created_at`/`updated_at` (`now()`) und gibt das Objekt
  zurück. Cross-Domänen-Bedarfe per SQL-JOIN im eigenen Repository lösen.
- **ESLint-Konfiguration** (`eslint.config.mjs`): direkter Flat-Config-Import aus
  `eslint-config-next` (kein `FlatCompat`). Regel `react-hooks/set-state-in-effect` ist projektweit
  deaktiviert (Dialoge synchronisieren bewusst UI-State mit `useActionState` im `useEffect` –
  gültiges Muster; in neuen Dialog-Komponenten fortführen).
- **Neue shadcn/ui-Komponenten:** `npx shadcn add <component>` (Konfiguration `components.json`).
- **Cross-Modul-Verlinkung:** Query-Param-Filter (`?propertyId=`/`?unitId=`/`?hoaId=`) +
  Anchor-Links (`id="<typ>-<id>"`, Hervorhebung via `tr:target` in `globals.css`) +
  `CountLinkBadge` – Muster aus den Listen-Seiten fortführen.

## 8. Electron-spezifische Regeln

- **Keine Node-/Electron-APIs im Renderer** außer über `window.iv` (Preload/contextBridge). Neues
  Shell-Feature → neuen IPC-Kanal in `electron/main/index.ts` + Brücke in
  `electron/preload/index.ts` + Typ in `src/lib/desktop-bridge.ts`.
- **Datenpfade** ausschließlich über `src/data/paths.ts` (Server-Seite, liest `APP_DATA_DIR`) bzw.
  `app.getPath("userData")` (Main-Prozess). Niemals Pfade hartcodieren.
- **Der Main-Prozess greift NICHT auf die SQLite-DB zu** (Single-Owner: der Next-Server hält die
  Verbindung). Main macht nur Dateidialoge/Netzwerk/Modus-Orchestrierung; Backup-Logik läuft in
  `/api/backup/*`-Routen (Server), vom Renderer per fetch ausgelöst.
- **Netzlaufwerk-Check** beim Start nie umgehen/abschwächen (Datenkorruptionsrisiko).
- `electron-vite` typecheckt nicht – für die Shell immer `npx tsc -p electron/tsconfig.json`
  mitlaufen lassen.
- **Packaging-Falle (electron-builder):** Beim Verzeichnis-Kopieren via `extraResources` wird ein
  **direkt im `from`-Verzeichnis liegendes `node_modules` hart herausgefiltert**
  (`createFilter` in app-builder-lib, nicht per Pattern übersteuerbar). Deshalb hat der getracete
  Standalone-`node_modules`-Baum (next, react, …) in `electron-builder.yml` einen **eigenen
  Eintrag** (`from: .next/standalone/node_modules`) – ohne ihn schlägt `require("next")` im Paket
  mit „Cannot find module 'next'" fehl. Nach Änderungen am Packaging immer `npm run pack` und den
  Inhalt von `dist/mac-*/ImmoBase.app/Contents/Resources/standalone/node_modules` prüfen.
- **Tracing-Falle (Turbopack-Standalone):** Bei Routen mit Dateisystem-/Stream-Zugriff
  (`src/lib/storage.ts`, `src/data/backup.ts`, PDF-Erzeugung) über-traced Turbopack das
  **komplette Projektverzeichnis** in `.next/standalone` – inkl. `dist/`, sodass jeder Build die
  Artefakte aller Vorbuilds rekursiv einbettet (mehrere GB pro Paket). Deshalb stehen in
  `next.config.ts` unter `outputFileTracingExcludes` neben `better-sqlite3` auch alle
  Projektverzeichnisse (`dist`, `dist-electron`, `electron`, `scripts`, `src`, `public`, `build`,
  `.github`) – die Laufzeit braucht nur die kompilierten Chunks; statische Assets kommen via
  `extraResources` ins Paket. Nach Änderungen daran Standalone-Größe (`du -sh .next/standalone`,
  ~30 MB) und Boot-Test (`node .next/standalone/server.js`, better-sqlite3-Symlink beachten)
  prüfen.

## 9. Bekannte, bewusst offene Punkte

- **Datenbank-Verschlüsselung gilt nur im Ruhezustand** (Container `data.db.enc`, siehe Abschnitt
  2): Während die App läuft und nach einem nicht sauberen Beenden (Prozess-Kill/Stromausfall)
  liegt die DB im Klartext vor. Echte Transparentverschlüsselung zur Laufzeit (SQLCipher) kam
  nicht infrage (kein gepflegter better-sqlite3-kompatibler Fork, s. o.). Für diese Zustände wird
  zusätzlich die Festplattenverschlüsselung des Systems (FileVault/BitLocker/LUKS) empfohlen.
  Direkter CLI-Zugriff (`sqlite3 data.db`) ist daher nur möglich, während die App läuft (bzw.
  nach manueller Entschlüsselung des Containers).
- **Host-Modus (LAN) ohne TLS**: Das Zugangs-Token schützt die Authentisierung, nicht die
  Vertraulichkeit der Übertragung im LAN. In nicht vertrauenswürdigen Netzen nur über
  verschlüsselte Strecke (z. B. VPN) betreiben.
- **Linux ohne Secret Service**: Dort liegt der Master-Schlüssel nur base64-kodiert in
  `settings.json` (`plain:`-Fallback, Datei 0600) – Schutz dann nur über Dateirechte.
- **Keine eigene UI** für Zählerstände (`meters`/`meter_readings`) und Übergabeprotokolle
  (`protocols`) – Tabellen sind vollständig angelegt, aber es gibt noch keine Seiten/Actions dafür.
- Kein Rollen-Wechsel (`USER` ↔ `ADMIN`) in der Admin-UI, nur der Freigabe-Toggle (`isApproved`).
  Bei Bedarf direkt in der DB (z. B. per `sqlite3 data.dev`/`data.db`).
- **Tests:** Vitest für gezielte Unit-/Integrationstests von Server-Code: `src/data/*.test.ts`
  (Migrationen vor/zurück, Backup-Roundtrip inkl. Prüfsummen, Repository-CRUD/Transaktionen),
  `src/lib/letterxpress.test.ts`, `src/lib/postal-shipments.test.ts` (Mocks),
  `src/lib/auth/bootstrap.test.ts` (Konto-Bootstrapping, Mailer gemockt) und
  `src/lib/hoa-*.test.ts` (reine WEG-Berechnungen inkl. End-to-End-Durchstich). Es gibt weiterhin
  **keine** Tests für Server Actions, React-Komponenten oder E2E-Abdeckung.
- **Import „Zusammenführen"** ist zeilenbasiert (`INSERT OR IGNORE`, lokaler Bestand gewinnt) –
  kein Sync-Protokoll für parallele Mehrgeräte-Bearbeitung.
- Update-Feed über GitHub-Releases (öffentlich); private Feeds würden eine Anpassung des
  electron-updater-Providers erfordern.

> **Hinweis für Agenten:** Diesen Abschnitt bei größeren Meilensteinen (neue Module,
> Architektur-/Infrastrukturwechsel) eigenständig aktualisieren – alten Stand durch den neuen
> ersetzen statt endlos anzuhängen.
