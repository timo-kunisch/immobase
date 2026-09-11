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
  Lokale Datenverschlüsselung) und im Setup-Wizard als Pflicht-Schritt zur Sicherung.
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
  Integrationen & KI (Tabelle `app_settings`, Zugriff nur über `src/data/app-settings.ts`; Fallback
  Umgebungsvariablen für Dev/Tests). **Ohne SMTP-Konfiguration sind sämtliche E-Mail-Funktionen
  deaktiviert** (`isSmtpConfigured()`, `src/lib/email/mailer.ts`): `sendMail` wird zum No-Op (kein
  Versand, kein Fallback-Log), der Passwort-Reset sperrt sich mit
  UI-/Server-Hinweis, die Freigabe-Benachrichtigung im Admin-Bereich wird übersprungen (Admin erhält
  Hinweis im Aktionsergebnis) und die E-Mail-Verifizierung gilt als automatisch erfüllt (siehe
  Abschnitt 3).
- **Ticket-Postfach (IMAP-Empfang, „Mini-Zendesk")** – **optionale Online-Funktion**: Der Admin
  hinterlegt einen IMAP-Server unter Einstellungen → Integrationen & KI (`imap.host/.port/.secure/.user/
  .mailbox` Klartext, `imap.pass` feldverschlüsselt in `SECRET_SETTING_KEYS`; Env-Fallbacks
  `IMAP_HOST` etc.; `src/lib/email/imap.ts`, `isImapConfigured()`). Das Modul `/postfach` ist in
  der Sidebar immer sichtbar, aber ohne IMAP-Konfiguration deaktiviert (Hinweis als Tooltip):
  `src/lib/email/imap-sync.ts` ruft neue Nachrichten per
  `imapflow` ab (inkrementell über UID, Stand in `imap_sync_state`; UIDVALIDITY-Wechsel =
  Neuabgleich), parst sie mit `mailparser` und legt sie als `INBOUND`-Einträge in
  `ticket_messages` ab (Dedup über partiellen Unique-Index Ordner+UID). Antworten auf bekannte
  Ticket-E-Mails werden automatisch dem Ticket zugeordnet: primär über
  In-Reply-To/References-Header (`findLinkedTicketIdByMessageIds`), als Fallback über die
  Ticket-Kennung im Betreff (`[#a3f8b2c1]`, erste 8 UUID-Hex-Zeichen; `src/lib/ticket-ref.ts`
  + `findTicketIdByRef()` im Tickets-Repository, nur eindeutige Treffer); alles andere bleibt
  im Postfach und kann dort gelesen (Öffnen-Dialog), **in ein Ticket
  umgewandelt** oder **an ein Ticket angeheftet** (oder gelöscht = nur lokale Kopie) werden. Ein
  Scheduler (Start in `src/app/(app)/layout.tsx` wie der Dropbox-Scheduler; 5-Minuten-Intervall,
  `unref`'d, parallele Läufe abgelehnt) ruft automatisch ab; zusätzlich manueller „Jetzt abrufen"-
  Button. Der komplette Verlauf (E-Mails eingehend/ausgehend + interne Notizen, eine Tabelle
  `ticket_messages` mit Diskriminator `direction`) ist auf der Ticket-Detailseite `/tickets/[id]`
  sichtbar. **Eingehende E-Mails lassen sich im Verlauf wieder entknüpfen** (zurück ins
  Postfach) **oder einem anderen Ticket neu zuordnen** (`unlinkMessageFromTicket()`/
  `linkMessageToTicket()` + Actions auf der Ticket-Detailseite). **E-Mail-Antworten aus dem
  Ticket** (`src/lib/ticket-mailer.ts`, geteilt von Action +
  MCP) setzen eigene Message-ID + Threading-Header, **hängen die Ticket-Kennung an den Betreff**
  (`ensureTicketSubjectTag()`, idempotent) und legen den OUTBOUND-Eintrag ab - nur wenn
  SMTP konfiguriert ist, sonst sperrt sich das Formular mit Hinweis. **Ohne IMAP/SMTP funktioniert
  das Ticket-System uneingeschränkt mit den Basis-Funktionen** (manuell anlegen, Kanban-Status,
  interne Notizen).
- **Postversand von PDFs** über die externe **LetterXpress API v3** (`src/lib/letterxpress.ts`) –
  **optionale Online-Funktion, nicht Teil des Offline-Kernpfads**: ohne Zugangsdaten sind die
  Versand-Buttons deaktiviert (`isLetterXpressConfigured()`) **und** `sendPdfByPostForSource()`
  (`src/lib/postal-shipments.ts`, zentraler Durchgang aller Versand-Actions) bricht serverseitig
  früh ab (ohne FAILED-Protokoll-Eintrag); Zugangsdaten in `app_settings`.
- **Cloud-Sicherung nach Dropbox** (`src/lib/dropbox.ts` = reiner API-Client, nur natives fetch;
  `src/lib/dropbox-backup.ts` = Orchestrierung) – ebenfalls **optionale Online-Funktion**: OAuth
  2.0 mit PKCE im Code-Flow **ohne redirect_uri** (Dropbox zeigt den Code zum Kopieren an – der
  lokale Server läuft auf dynamischem Port, ein vorregistrierter Redirect wäre unmöglich).
  Refresh-/Access-Token, PKCE-Zwischenstand und das optionale Backup-Passwort liegen
  feldverschlüsselt in `app_settings`. Ein Scheduler (Start im geschützten App-Layout
  `src/app/(app)/layout.tsx` bei der ersten authentifizierten Seitenanzeige – bewusst NICHT in
  `src/instrumentation.ts`, weil der Instrumentation-Trace nicht von den
  `outputFileTracingExcludes` erfasst wird; Prüfung alle 30 min, `unref`'d) lädt fällige
  Sicherungen hoch: gleicher Export wie die manuelle
  Datensicherung (`src/data/backup.ts`), optional passwortverschlüsselt (`.imbak`). Upload chunked
  über Upload-Sessions (8-MiB-Chunks, Wiederaufsetzen per `incorrect_offset`/`correct_offset`),
  danach Aufbewahrung (älteste `immobase-backup-*`-Dateien bis auf die letzten N löschen). Der
  Dropbox-App-Schlüssel wird in den Einstellungen hinterlegt (Fallback `DROPBOX_APP_KEY`); UI:
  Einstellungen → Dropbox-Backup.
- **MCP-Server (KI-Zugriff)** (`src/app/api/mcp/route.ts` + `src/lib/mcp/`) – **optionale,
  standardmäßig deaktivierte Online-Funktion** (Aktivierung nur durch Admins: Einstellungen →
  MCP-Server (KI-Zugriff)): MCP-Endpunkt (Model Context Protocol, „Streamable HTTP" im
  zustandslosen Request/Response-Modus, JSON-RPC 2.0; KEIN SSE, keine MCP-Sessions), über den
  KI-Clients sämtliche Fachdaten lesen/anlegen/bearbeiten/löschen können (~150 Werkzeuge:
  CRUD aller Entitäten beider Fachbereiche inkl. der fachlichen Operationen wie
  Abrechnungs-/Wirtschaftsplan-/Jahresabrechnungs-Finalisierung, Fälligstellen von Mieten und
  Hausgeld, Buchhaltungs-Kontoauszug-Import inkl. Buchung gegen Konten/Miet-Sollstellungen/
  Hausgeld-Sollstellungen beider Buchungskreise (`bank_transactions_import`/`_allocate`,
  Ziel je Zeile genau eines von accountId/transactionId/housingChargeId), Banking-Import in
  Abrechnungsperioden UND WEG-Jahresabrechnungen
  (`annual_statements_import_cost_items_from_banking`), Plausibilitätsprüfung der
  Jahresabrechnung (`annual_statements_consistency_check`), Notizen jederzeit
  (`billing_periods_set_notes`/`annual_statements_set_notes`), Dokumenten-Up-/Download als
  Base64, Nutzerfreigaben, Kalender-Gesamtansicht).
  Authentifizierung
  ausschließlich über Bearer-Token (`Authorization`-Header oder `access_token`-Query-Param;
  **kein** Session-Cookie – `src/proxy.ts` lässt `/api/mcp` daher passieren, die Token-Prüfung im
  Route Handler ist die autoritative Schranke; im Host-Modus gilt zusätzlich der LAN-Token-Check
  des Main-Prozesses). **Zwei Token-Stufen** (`src/lib/mcp/auth.ts`, timingSafeEqual;
  `resolveMcpTokenScope` löst Token → Scope auf): `mcp.token` = Admin-Token (Vollzugriff inkl.
  Administrations-Werkzeugen) und `mcp.user_token` = eingeschränktes Nutzer-Token (nur fachliche
  Werkzeuge) – beide FELD-verschlüsselt in `SECRET_SETTING_KEYS`, dazu `mcp.enabled` (Klartext).
  Der **Werkzeug-Scope** (`McpToolScope` in `src/lib/mcp/registry.ts`) spiegelt das Rollenmodell
  der App: Als `adminOnly` markierte Werkzeuge (Nutzerverwaltung `users_*`, Absenderdaten
  `company_settings_*` – alles, was in der App unter `/admin` bzw. `/einstellungen` liegt) sind im
  Scope `USER` weder in `tools/list` sichtbar noch per `tools/call` aufrufbar. Protokollschicht
  `src/lib/mcp/protocol.ts` (initialize/ping/tools/list/tools/call, Batch, Notifications → 202),
  Werkzeug-Registry `src/lib/mcp/registry.ts` (Feld-Spezifikationen → JSON-Schema +
  Laufzeit-Validierung/Normalisierung: Dezimal-Komma, ISO-Daten, Enums; CRUD-Generator
  `registerCrudTools`; fachliche Fehler als `McpToolError` → Tool-Result mit `isError: true`).
  **Batch-Funktion:** Neben JSON-RPC-Batches auf Protokollebene gibt es das Meta-Werkzeug
  `batch_execute` (`src/lib/mcp/tools-batch.ts`): führt bis zu 50 Werkzeugaufrufe sequentiell in
  einem Aufruf aus und meldet Erfolg/Fehler je Eintrag (Teilerfolg ohne Gesamt-Rollback; Abbruch
  nach dem ersten Fehler optional per `stopOnError`; Verschachtelung gesperrt; Scope-Prüfung je
  Unteraufruf über den `McpToolContext`, den `callTool` an jeden Handler durchreicht). Steht dem
  internen KI-Assistenten automatisch mit zur Verfügung.
  Werkzeuge aufgeteilt nach `tools-rental.ts`/`tools-hoa.ts`/`tools-system.ts`/`tools-batch.ts`
  (Registrierung per
  Import-Seiteneffekt, Sammel-Import `tools.ts`; `tools-system.ts` enthält neben der
  Benutzerverwaltung auch die allgemeinen Module Kalender und Wissensdatenbank). Die Werkzeuge
  spiegeln die Fachregeln der
  Server Actions (Entwurfs-Sperren, Beschluss-Nummernvergabe, Eigentümerwechsel-Versionierung,
  Aussperr-Schutz letzter Admin). Das Admin-Token hat faktisch Admin-Rechte (prominenter
  Warnhinweis in der UI-Karte `src/components/einstellungen/mcp-card.tsx`, die beide Token-Stufen
  verwaltet).
- **KI-Assistent (In-App-Chatbot)** (`src/lib/ai/` + `src/app/api/chat/route.ts` +
  `src/components/layout/chatbot-dialog.tsx`) – **optionale Online-Funktion**: Die Sprechblase im
  Sidebar-Footer (früher „Administrator kontaktieren", entfernt) öffnet einen Chat gegen einen
  frei konfigurierbaren **OpenAI-kompatiblen Chat-Completions-Endpunkt** (Einstellungen →
  KI-Assistent; `ai.base_url` + `ai.model` Klartext, `ai.apikey` FELD-verschlüsselt in
  `SECRET_SETTING_KEYS`, optional leer für lokale Server wie LM Studio/Ollama; Env-Fallbacks
  `AI_BASE_URL`/`AI_MODEL`/`AI_API_KEY`). Ohne vollständige Konfiguration ist die Sprechblase
  deaktiviert und die Route gesperrt (`isAiConfigured()`). Der Chat steht **allen angemeldeten
   Nutzern** offen (Route prüft `getCurrentUser()` mit JSON-401 statt Redirect); die **Rolle aus
   der Session bestimmt den Werkzeug-Scope** (`userRole` → `McpToolScope`): Administratoren
   erhalten alle Werkzeuge, normale Nutzer nur die fachlichen (keine `adminOnly`-Werkzeuge wie
   Nutzerverwaltung/Absenderdaten – exakt die Funktionen, die ihnen auch in der App-Oberfläche
   offenstehen). **Assistenten-Antworten werden als Markdown gerendert**
   (`src/components/layout/markdown-content.tsx`: `react-markdown` + `remark-gfm` für Tabellen +
   `remark-breaks` für Chat-übliche Zeilenumbrüche, Tailwind-Styling über die `components`-Prop;
   bewusst **kein** `rehype-raw`, d. h. rohes HTML aus Modell-Ausgaben wird escaped = kein XSS;
   Markdown-Bilder werden nicht geladen, externe Links öffnen über `target="_blank"` im
   System-Browser); Nutzer-Nachrichten bleiben reiner Text.
   `src/lib/ai/chat.ts` bietet die MCP-Werkzeuge scope-gefiltert als
   OpenAI-Function-Tools an und führt angeforderte Aufrufe **in-process** über die Registry aus
   (Tool-Loop, max. 25 Runden, Tool-Ergebnisse auf 40k Zeichen gekürzt, fachliche Fehler als
   Tool-Ergebnis ans Modell). Der System-Prompt steuert das Modell bei mehreren unabhängigen
   Aufrufen zum Bündeln (parallele Werkzeug-Anforderung in einer Antwort oder das Meta-Werkzeug
   `batch_execute`); Batch-Einzelaufrufe werden in der UI-Aufrufliste flach mit eigenem
   Erfolgsstatus ausgewiesen (`summarizeToolExecution`). Das Runden-Limit ist **kein harter Abbruch**: Ab 5 verbleibenden
   Runden erhält das Modell eine Budget-Frühwarnung; bei Erschöpfung folgt eine Schlussrunde
   **ohne** Werkzeugangebot, in der es Zwischenstand und offene Reste zusammenfasst (Fortsetzung
   per „weiter"), bei leerer Antwort greift eine lokal erzeugte Bilanz der ausgeführten Aufrufe. Endpunkt-Zugriff `src/lib/ai/client.ts` (nur natives fetch,
  nicht-streamend): Vorübergehende Fehler werden mit einfachem Backoff wiederholt (max. 3 Versuche,
  Retry-After-Header wird beachtet – Muster wie `fetchWithRetry` in `src/lib/dropbox.ts`):
  Netzwerkfehler, eigenes Timeout (180 s/Aufruf) sowie die Status 408/429/500/502/503/504/524 –
  insbesondere **524 („A Timeout Occurred") bei Endpunkten hinter Cloudflare**: Da die Anfragen
  nicht-streamend sind, sendet der Ursprungsserver bis zum Abschluss der Generierung keinerlei
  Daten; dauert sie zu lange, bricht Cloudflare nach ~100 s mit 524 ab (ein erneuter Versuch geht
  dann häufig durch). Bleibt auch der letzte Versuch ein 504/524, trägt die Fehlermeldung einen
   Timeout-Hinweis. **Datei-Anhänge** (z. B. Excel-Tabellen mit Mietern, PDF-Abrechnungen) werden
   clientseitig als Base64 mitgesendet und serverseitig aufbereitet (`src/lib/ai/attachments.ts`,
   geteilte Konstanten in `attachment-types.ts` – client-sicher, kein Node-Import): **PDF** via
   `pdfjs-dist` (**4.x gepinnt** – ab 5.x wird `DOMMatrix` als Browser-Global beim Modul-Import
   zwingend erwartet, das fehlt im eingebetteten Node der Electron-Shell → Route lädt nicht mehr,
   HTTP 500. Import daher auch lazy in `attachments.ts`, sodass ein pdfjs-Ladefehler nur
   PDF-Anhänge betrifft, nicht den Chat). Text je Seite; **Seiten ohne nennenswerte Textebene
   (Scans) werden automatisch per OCR nachverarbeitet** (`src/lib/ai/ocr.ts`, lazy geladen):
   pdfjs rastert die Seite (2,5-fache Skalierung, weißer Hintergrund) über `@napi-rs/canvas`
   (N-API, ABI-stabil → kein Electron-Rebuild nötig; Version an pdfjs' optionalDependency
   `^0.1.65` ausgerichtet – 1.x segfaultet mit pdfjs 4.10), das PNG läuft durch `tesseract.js`
   (WASM, OEM.LSTM_ONLY, worker_thread) mit dem **gebündelten deutschen Sprachmodell**
   (`@tesseract.js-data/deu`, Variante `4.0.0_best_int`, per langPath lokal – vollständig offline;
   Pfadauflösung per Verzeichnis-Hochlauf ab `import.meta.url`, weil Turbopack `require.resolve`
   zur Build-Zeit ersetzt). OCR-Seiten sind im Text als „per OCR erkannt" markiert, mit
   Hinweis-Präambel für das Modell; Schwellwert „keine Textebene" < 20 Zeichen, max. 20
   OCR-Seiten/Dokument (Kürzungshinweis). Fällt die OCR-Engine aus (z. B. fehlende
   Plattform-Binary), greift das bisherige Verhalten: Fehlermeldung statt Absturz.
   Packaging-Falle tesseract.js 7.0.0: `worker-script/node/getCore.js` prüft den
   `lstmOnly`-Boolean gegen die OEM-Enum-Werte (immer false) und require()t daher IMMER die
   Nicht-LSTM-Core-Variante (`tesseract-core[-simd|-relaxedsimd]`) – der Standalone-Trace in
   `next.config.ts` muss genau diese (nicht die `-lstm`-)Varianten enthalten.
   **Excel** (.xlsx/.xlsm) via `exceljs` → Semikolon-CSV je Tabellenblatt,
  **Word/PowerPoint/OpenDocument** (.docx/.pptx/.odt/.ods/.odp) via `jszip` (Textextraktion aus
  dem XML-Inhalt; ODS-Zellen als Semikolon-Näherung), **Bilder** (.png/.jpg/.gif/.webp) als
  Vision-Input (OpenAI-`image_url`-Content-Parts mit Data-URL – setzt ein multimodales Modell
  voraus) sowie **Text-/Code-Dateien** (.csv/.tsv/.txt/.md/.json/.xml/.yaml/.sql/.ts/.py u. a.)
  direkt. Legacy-Formate (.xls/.doc/.ppt) werden mit Konvertierungs-Hinweis abgelehnt.
   Obergrenzen: 10 MB/Datei, 5 Anhänge/Nachricht, 500 Zeilen/Blatt, 200 PDF-Seiten, 60k
   Zeichen/Datei (je mit Kürzungshinweis im Text). Hinweis: `exceljs` statt `xlsx`, weil das
   npm-Paket `xlsx` ungepatchte High-Vulnerabilities hat (SheetJS patcht nur noch die eigene
   CDN-Distribution). **Der Gesprächsverlauf ist persistent** (Tabelle `chat_messages` pro
   Nutzer, Repository `src/data/chat-messages.ts`, Route `src/app/api/chat/history/route.ts`
   mit GET/DELETE): Er bleibt über Dialog-Schließen, Seiten-Neuladen und App-Neustarts
   erhalten, bis er im Dialog manuell gelöscht wird (Papierkorb-Button). Der Client sendet
   daher nur die neue Nachricht an `/api/chat`; die Route lädt den gespeicherten Verlauf,
   reicht ihn vollständig an den Endpunkt weiter (bewusst keine serverseitige Kappung) und
   persistiert Nutzerfrage + Assistenten-Antwort nach erfolgreichem Durchlauf (eine
   Transaktion). **Fehlgeschlagene Durchläufe** werden ebenfalls persistiert – Nutzerfrage +
   Fehlermeldung mit Rolle `error`, im Dialog als farblich markierte Fehler-Nachricht an
   derselben Stelle; dem Modell werden sie als markierte Assistenten-Notiz mitgesendet.
   Von Datei-Anhängen werden nur die **Metadaten** (Name + Größe, JSON-Spalte
   `chat_messages.attachments`) mit der Nutzer-Nachricht gespeichert und im Verlauf als Chips
   angezeigt (`AttachmentChipList`) – der Datei-Inhalt wird bewusst nicht gespeichert.
   Größen-Grenzen (Summe der
   Nachrichten-Zeichen): Ab 100.000 Zeichen (`CHAT_HISTORY_WARNING_CHARS` im Dialog) blendet
   die UI eine Warnung zum steigenden Token-Verbrauch ein und empfiehlt das Löschen; bei
    250.000 Zeichen (`CHAT_HISTORY_HARD_LIMIT_CHARS` in `src/lib/ai/chat-limits.ts`, geteilt)
    greift die **harte Grenze** – die Chat-Route lehnt weitere Nachrichten mit HTTP 413 ab und
    der Dialog sperrt die Eingabe, bis der Verlauf gelöscht wird. **Schließen während einer
    laufenden Anfrage** ist möglich: Der `ChatbotDialog` hängt im Sidebar-Footer des
    persistenten App-Layouts, Anfrage (fetch) und Zustand laufen im Hintergrund weiter; wird
    die Antwort bei geschlossenem Dialog fertig (oder schlägt sie fehl), erscheint eine
    In-App-Benachrichtigung (Karte unten rechts, `replyNotice`) plus Hinweispunkt auf dem
    Sprechblasen-Button – quittiert durch Öffnen des Chats, Wegklicken oder die nächste
    Nachricht. **Prompt-Vorlagen** (Buch-Button im Eingabebereich, Panel
    `src/components/layout/prompt-templates-panel.tsx`): Wiederverwendbare Textbausteine, die
    per Klick ins Eingabefeld übernommen werden (bei vorhandenem Text angehängt). Es gibt
    lokalisierte **Vorlagen ab Werk** (Konstanten in `src/lib/ai/prompt-templates.ts` –
    client-sicher, Titel/Text als i18n-Schlüssel `chat.templates.defaults.*`; nicht editierbar;
    die erste ist der Datei-Import: Datei anhängen, das Modell extrahiert und pflegt die Daten
    über die MCP-Werkzeuge ein) und **eigene Vorlagen pro Nutzer** (Tabelle `prompt_templates`,
    Repository `src/data/prompt-templates.ts` – strikt user_id-scoped, Route
    `src/app/api/chat/prompt-templates/route.ts` mit GET/POST/PUT/DELETE; Limits in
    `src/lib/ai/prompt-templates.ts`: Titel 100 / Text 4000 Zeichen, max. 50 je Nutzer).
- **Globale Suche (Command-Palette)**: Suche über ALLE Fachdaten beider Bereiche + Navigations-/
  Einstellungsseiten, erreichbar über den Trigger im Sidebar-Kopf und **Cmd/Ctrl+K** auf jeder
  App-Seite. UI: `src/components/layout/global-search.tsx` (shadcn `command`/cmdk, Dialog,
  debounced fetch ab 2 Zeichen, Tastatur-Navigation; `shouldFilter={false}`, da die
  Daten-Treffer serverseitig ermittelt werden). Daten: Repository `src/data/search.ts`
  (`searchDatabase(query, {limitPerType, includeUsers})`) lädt je Entität minimale
  Anzeigespalten und filtert per JS-Heuhaufen (`toLowerCase`) - bewusst KEIN SQL-LIKE, weil
  SQLite LIKE/lower() nur ASCII falten („münchen" fände „München" nicht); einzig der DMS-OCR-
  Volltext läuft per SQL LIKE (kann groß sein, wird nicht in JS geladen). Append-lastige
  Tabellen werden auf die jüngsten 2000 Zeilen begrenzt. Route `/api/search` (GET `?q=`,
  JSON-401-Muster wie `/api/chat`); Benutzerkonten (E-Mails) durchsucht NUR die Rolle ADMIN
  (`includeUsers`). Entitäten ohne Detailseite verweisen auf Listen-Anker (`#property-<id>` …),
  Dokumente auf `/dokumente?q=<dateiname>`, Einstellungen auf Hash-Deep-Links
  (`/einstellungen#datensicherung` …). Statischer Seiten-Katalog client-seitig:
  `src/lib/search-pages.ts` (i18n-Schlüssel + Suchbegriffe), geteilte Typen/Konstanten:
  `src/lib/search-types.ts`.
- **Backup/Restore**: `src/data/backup.ts` (ZIP: `manifest.json` mit SHA-256 je Datei + `data.db`
  via `db.backup()` + `files/`; `archiver`/`yauzl` streaming, Multi-GB). Optional
  passwortverschlüsselt: `src/lib/backup-crypto.ts` (AES-256-GCM + scrypt, eigener
  `.imbak`-Container mit Magic-Header, Auth-Tag am Dateiende, streaming; Import erkennt
  Container am Magic und verlangt dann zwingend das Passwort). UI: Einstellungen →
  Datensicherung (Desktop: native Dateidialoge via IPC + POST an `/api/backup/*`; Browser-Dev:
  Download-Fallback via GET `/api/backup/export`, dort nur unverschlüsselt). Die automatische
  Vor-Import-Sicherung wird mit dem lokalen Datenschlüssel verschlüsselt abgelegt
  (`backups/pre-import-*.zip.enc`, Container-Format; der Import erkennt sie am Magic).
- **Zurücksetzen** (Einstellungen → Sicherheit, nur Admins, je mit Tipp-Bestätigung): Zwei
  Varianten in `src/data/reset.ts`:
  - **Inhalte zurücksetzen** (`resetApplicationContent`, Phrase `INHALTE`): leert alle
    Fachdaten-Tabellen (dynamisch via `sqlite_master`, inkl. KI-Chat-Verlauf, eigener
    Prompt-Vorlagen, Aktivitätsprotokoll und IMAP-Abgleichstand - die auslösende Action
    protokolliert den Reset danach als einzigen Log-Eintrag) sowie `files/` komplett
    (Outbox-Log/Import-Temps wie beim Voll-Reset); `VACUUM` gibt den Speicherplatz zurück.
    Erhalten bleiben Benutzerkonten samt Sitzungen/Token, `app_settings`/`company_settings`
    (inkl. feldverschlüsselter Geheimnisse), `backups/` (Archive als Rettungspfad) und die
    Geräte-/Installationsdateien. Alle Nutzer bleiben angemeldet; der Client lädt die Seite
    nur neu.
  - **Inhalte und Einstellungen zurücksetzen** (`resetApplicationData`, Phrase `ZURÜCKSETZEN`):
    vollständiger Factory-Reset - löscht die DB in allen Formen (Klartext, WAL, `data.db.enc`,
    `data.db.pre-migrate-*.enc`), `files/`, `backups/`, ein evtl. vorhandenes
    `logs/outbox.log` (Altlast aus Versionen mit E-Mail-Outbox-Fallback) und verwaiste
    Import-Temp-Verzeichnisse; `settings.json`/`.data-key`/`main.log` bleiben als
    Geräte-/Installationsdateien erhalten. Danach wird die DB sofort frisch migriert angelegt,
    das Session-Cookie serverseitig entfernt und der Client lädt `/setup` vollständig neu.
- **Electron-Shell** unter `electron/` (electron-vite, nur main+preload, TS strict):
  - `main/index.ts` – Lifecycle, `requestSingleInstanceLock()`, Netzlaufwerk-Abbruch-Check,
    Modus-Orchestrierung (local/host/client), IPC, Fenster-Sicherheit (`contextIsolation: true`,
    `nodeIntegration: false`, `sandbox: true`). Fenster-Politik: App-interne `target="_blank"`-Links
    (z. B. PDF-/Dokumentenvorschau über `/api/uploads`) öffnen in einem eigenen App-Fenster
    **derselben Session** (eingeloggter Zustand bleibt erhalten, kein erneuter Login); externe
    Links weiterhin im System-Browser.
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
  - `shell/connect.html` – Verbindungs-Seite (nachträglicher Moduswechsel aus den Einstellungen,
    Client-Verbindung, Discovery-Liste, Reconnect mit Backoff, „Zurück zur App“ ohne
    Moduswechsel/Server-Neustart via `iv:shell-back-to-app`). Die **Erststart-Moduswahl** liegt
    dagegen im Setup-Wizard (`/setup`, Schritt nach der Begrüßung): Beim ersten Start
    (`settings.mode === null`) startet der Main-Prozess den eingebetteten Server im lokalen Modus
    (ohne Persistenz) und lädt direkt die App; der Wizard übergibt die Wahl per IPC `iv:set-mode`
    (idempotent, kein Server-Neustart/Reload bei unverändertem Modus; bei `client` wird der lokale
    Server gestoppt und die Shell-Seite für die Host-Verbindung gezeigt).
- **Server Actions** für alle CRUD-Operationen. Muster: `useActionState` in Client-Dialogen +
  `"use server"`-Funktionen in `src/app/<modul>/actions.ts` + `revalidatePath`. **Jede** Server
  Action prüft selbst `requireUser()`/`requireAdmin()` (Defense-in-Depth).
- **Authentifizierung** (eigenes System): E-Mail+Passwort, DB-Sessions über httpOnly-Cookie
  (`session_token`), Rollen `ADMIN`/`USER`. Details: Abschnitt 3.
- **Mehrsprachigkeit** (eigenes schlankes i18n, `src/lib/i18n/`, keine externe Bibliothek):
  Deutsch (Standard) und Englisch; Sprachwahl im Cookie `immobase_locale` (Umschalter in den
  Einstellungen und auf den Auth-Seiten). Namespaces je Modul unter `messages/de|en/`, t() via
  `getT()` (Server) bzw. `useI18n()` (Client); Konventionen: Abschnitt 7.
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
  erste Konto ist der **Setup-Wizard** `/setup` (Willkommen → Betriebsmodus → Absenderdaten →
  Online-Integrationen → Wiederherstellungsschlüssel → Administratorkonto; der Modus-Schritt gilt nur
  der Desktop-App und geht per IPC an den Main-Prozess, die Absenderdaten sind überspringbar, der
  Integrations-Schritt ist ein reiner Hinweisschritt ohne Konfiguration – er verweist nur auf die
  optionalen Online-Dienste in den Einstellungen, der Schlüssel-Schritt verlangt eine Lesebestätigung
  per Checkbox, das Konto wird bewusst als letzter Schritt angelegt, damit der
  `countUsers() === 0`-Guard für alle Setup-Actions gilt). Ohne
  SMTP meldet die letzte Setup-Action den Nutzer direkt an (Session + Redirect auf `/`); mit SMTP
  gilt der klassische Verifizierungslink-Flow über `/login`.
- **Login-Bedingungen** (beide erforderlich): `emailVerified != null` UND `isApproved == true`.
  Die E-Mail-Verifizierung ist an `isSmtpConfigured()` (`src/lib/email/mailer.ts`) gekoppelt: **Ohne
  SMTP-Konfiguration** (Normalfall der offline laufenden Desktop-App) sind alle E-Mail-Funktionen
  deaktiviert – Registrierung markiert die Adresse daher sofort als bestätigt und der Login
  bestätigt sie nach erfolgreicher Passwortprüfung automatisch nach (Self-Healing für Bestands-
  konten). **Mit SMTP** gilt der klassische Verifizierungslink-Flow. Der Passwort-Reset ist ohne
  SMTP komplett gesperrt (die Forgot-Password-Action bricht mit Hinweis ab, es wird weder ein
  Token erzeugt noch eine E-Mail versendet).
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
  shell/connect.html        # Verbindungsseite (Moduswechsel/Client-Verbindung, plain HTML/JS, kein Build)
  tsconfig.json             # strict TS für die Shell (npx tsc -p electron/tsconfig.json)
src/
  app/
    (app)/                  # Geschützter Bereich, mit Sidebar (requireUser() im Layout)
      loading.tsx           # Ladezustand aller App-Seiten (PageSkeleton, Suspense unter dem Layout)
      <modul>/
        page.tsx            # Server Component, lädt Daten via Repository-Layer
        actions.ts          # "use server"-Funktionen (CRUD), je requireUser()/requireAdmin()
      weg/                  # WEG-Verwaltung - flache Top-Level-Module (siehe Abschnitt 7.1)
      admin/logs/           # Aktivitätsprotokoll (Audit Log, nur Admins)
      actions/dashboard.ts  # Dashboard-Orchestrierung (kein "use server" - reines Lesen)
    (auth)/                 # Öffentliche Auth-Seiten, ohne Sidebar
    (setup)/setup/          # Ersteinrichtungs-Wizard (nur solange countUsers() === 0)
    api/uploads/[...path]/  # Geschützter Route Handler für Dateiauslieferung
    api/backup/export|import/  # Backup-Routen (requireAdmin())
    api/mcp/route.ts        # MCP-Endpunkt (Bearer-Token, optional aktivierbar)
    api/chat/route.ts       # KI-Assistent-Chat (Session, alle Nutzer; Rolle bestimmt Werkzeug-Scope)
    api/chat/history/route.ts  # Persistenter Chat-Verlauf (GET laden / DELETE löschen, pro Nutzer)
    api/chat/prompt-templates/route.ts  # Eigene Prompt-Vorlagen (CRUD, pro Nutzer)
    api/search/route.ts     # Globale Suche (Session, alle Nutzer; ADMIN sieht zusätzlich Benutzerkonten)
    layout.tsx              # Root-Layout (Fonts, TooltipProvider)
    globals.css             # Tailwind v4 + shadcn-Theme + tr:target-Highlight
  components/
    ui/                     # shadcn/ui-Basiskomponenten (via `npx shadcn add`) + generische
                            # DataTable (Sortieren/Filtern/Client-Pagination, s. Abschnitt 7)
    <modul>/                # Modul-spezifische Dialoge/Formulare (Client Components)
    layout/                 # AppSidebar, SiteHeader, GlobalSearch, ChatbotDialog, UpdateBanner
  data/                     # REPOSITORY-LAYER - EINZIGER Ort mit SQL
    db.ts                   # better-sqlite3 Lazy-Singleton + Pragmas + Shutdown-Versiegelung
    db-vault.ts             # Container-Verschlüsselung der DB at rest (unlock/lock)
    migrate.ts              # user_version-Migrationen (up/down, Auto-Backup, Rollback)
    migrations/             # versionierte Migrationsschritte (TS-Module mit SQL-Strings)
    schema.sql              # generierte Referenz (npm run schema:dump)
    backup.ts               # Export/Import (ZIP, Manifest, SHA-256, db.backup)
    reset.ts                # Zurücksetzen: Inhalts-Reset + vollständiger App-Reset (nur Admins)
    audit-log.ts            # Aktivitätsprotokoll (append-only, Aufrufe via src/lib/audit.ts)
    app-settings.ts         # Key/Value-App-Konfiguration (SMTP, LetterXpress, KI-Endpunkt, URL-Overrides)
    search.ts               # Globale Suche (alle Fachdaten, JS-Heuhaufen statt SQL-LIKE)
    <domain>.ts             # Repositories (createX/listY/...)
  lib/
    auth/                   # dal.ts, session.ts, tokens.ts, password.ts, validation.ts, bootstrap.ts, actions.ts
    email/mailer.ts         # nodemailer (ohne SMTP: alle E-Mail-Funktionen deaktiviert)
    email/imap.ts           # IMAP-Konfiguration (optionales Ticket-Postfach; isImapConfigured)
    email/imap-sync.ts      # IMAP-Abruf (imapflow+mailparser), Threading-Zuordnung, Scheduler
    ticket-mailer.ts        # E-Mail-Antworten aus Tickets (SMTP; geteilt von Action + MCP)
    pdf/                    # document.ts (Briefe), statement-pdf.ts (geteiltes Abrechnungs-Layout),
                            # Hüllen billing-statement.ts (Miete) + hoa-annual-statement.ts (WEG)
    storage.ts              # Dateisystem-Ablage (files/)
    data-key.ts             # Master-Schlüssel (Env aus Electron / Schlüsseldatei-Fallback)
    file-crypto.ts          # AES-256-GCM-Dateiverschlüsselung at rest + Bestandsmigration
    letterxpress.ts         # LetterXpress-API (optionaler Postversand)
    bank-allocations.ts     # Geteilte Fachvalidierung der Buchungszeilen (Server Action + MCP)
    postal-shipments.ts     # Postversand-Orchestrierung (Quelle -> PDF -> LetterXpress -> DB)
    dropbox.ts              # Dropbox-API-Client (OAuth-PKCE, Chunked-Upload, List/Delete)
    dropbox-backup.ts       # Cloud-Sicherung: Verbindung, Scheduler, Upload, Aufbewahrung
    backup-crypto.ts        # Passwort-Verschlüsselung für Backups (AES-256-GCM + scrypt, .imbak)
    mcp/                    # MCP-Server (KI-Zugriff): auth.ts (Token-Stufen/Enabled), protocol.ts
                            # (JSON-RPC), registry.ts (Tool-Definition, Werkzeug-Scope, CRUD-Generator),
                            # tools-rental/-hoa/-system.ts (Werkzeuge), tools-batch.ts (Meta-
                            # Werkzeug batch_execute), tools.ts (Sammel-Import)
    ai/                     # KI-Assistent (In-App-Chatbot): config.ts (Endpunkt-Konfiguration),
                            # client.ts (OpenAI-kompatibler fetch-Client), attachments.ts +
                            # attachment-types.ts (Anhang-Aufbereitung: PDF/Office/Bilder/Excel/Text),
                            # ocr.ts (automatische OCR für PDF-Seiten ohne Textebene:
                            # pdfjs-Rasterung via @napi-rs/canvas + tesseract.js mit gebündeltem
                            # deutschen Sprachmodell, offline, lazy geladen),
                            # chat.ts (Tool-Loop über die MCP-Registry), tested-models.ts
                            # (interne Liste erfolgreich getesteter Modelle + unsere Empfehlungen -
                            # nicht gelistete Modelle erhalten in den Einstellungen eine dezente
                            # Warnung, keine Sperre; client-sicher)
    billing.ts              # Nebenkostenabrechnungs-Berechnung (reine Funktionen)
    i18n/                   # Mehrsprachigkeit (de/en): config.ts (Locales/Cookie), translator.ts
                            # (t()-Fabrik, typsichere Schlüssel), server.ts (getLocale/getT via
                            # Cookie, NUR Server), provider.tsx (I18nProvider/useI18n, Client),
                            # actions.ts (setLocaleAction), messages/de|en/<namespace>.ts
                            # (flache Dictionaries je Modul; Parität per typeof + messages.test.ts)
    calendar.ts             # Kalender-Aggregation (manuelle Ereignisse + automatische Termine, reine Funktionen)
    audit.ts                # logActivity() - Helfer für das Aktivitätsprotokoll (aus Server Actions)
    hoa-*.ts                # WEG-Berechnungslogik (reine Funktionen, vitest-getestet)
    money.ts, date-range.ts, rent-history.ts, lease-status.ts, hoa-ownership.ts
    templates.ts            # Platzhalter-System für Dokumentvorlagen
    desktop-bridge.ts       # Typen für window.iv (Electron-Brücke)
    format.ts, action-state.ts, form-data.ts, id.ts, utils.ts
    pagination.ts           # LIST_PAGE_SIZE + buildPageNumbers (Client-Pagination der DataTable)
    search-pages.ts         # Statischer Seiten-Katalog der globalen Suche (client-sicher)
    search-types.ts         # Geteilte Typen/Konstanten der globalen Suche (client-sicher)
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
- **Tickets:** `tickets`, `ticket_messages` (Kommunikationsverlauf: `direction` = `INBOUND`/
  `OUTBOUND`/`NOTE`; `ticket_id IS NULL` = unzugeordnete E-Mail im Postfach), `imap_sync_state`
  (IMAP-Abgleichstand je Ordner: UIDVALIDITY, letzte UID, letzter Sync-Status)
- **Dokumente (DMS):** `documents`
- **Finanzen:** `transactions` (Sollstellungen/Mieteingänge)
- **Buchhaltung:** `accounts` (Kontenrahmen je Liegenschaft, z. B. „Gebäudeversicherung"),
  `bank_transactions` (tatsächliche Bewegungen auf dem Bankkonto einer Liegenschaft, Betrag
  signed: positiv = Eingang, negativ = Ausgang), `bank_transaction_allocations` (Buchungs-
  zeilen: ordnen einen Teilbetrag genau EINEM Ziel zu – einem Konto (accountId), einer
  fälligen Miet-Sollstellung (transactionId, Buchungskreis Mietverwaltung) oder einer
  Hausgeld-Sollstellung (housingChargeId, Buchungskreis WEG); vollständige Zuordnung
  markiert die Sollstellung beider Kreise automatisch als bezahlt, Status PAID inkl.
  paid_date aus dem Buchungsdatum, gepflegt generisch im Repository
  `src/data/bank-transactions.ts` – die Kreise trennen sich: Miete-Buchungen berühren nie
  den Hausgeld-Status und umgekehrt). Die Fachvalidierung der Zuordnungen liegt geteilt in
  `src/lib/bank-allocations.ts` (Server Action + MCP identisch). Der abgeleitete
  Zuordnungsstatus einer Banktransaktion (OPEN/PARTIAL/RECONCILED) wird nicht gespeichert,
  sondern per Teilbetrags-Summe berechnet. UI: /buchhaltung (Mietverwaltung) und
  /weg/buchhaltung (WEG-Sicht mit Hausgeld-Buchungszielen) teilen sich die Dialoge.
- **Nebenkostenabrechnung:** `billing_periods`, `cost_items` (Umlageschlüssel inkl. „CUSTOM"
  über `custom_allocation_key_id`; die Kostenart-Kategorie wurde entfernt, die Bezeichnung
  trägt die fachliche Information selbst), `consumption_values`, `tenant_statements`,
  `tenant_statement_lines`, `custom_allocation_keys` + `custom_allocation_key_weights`
  (frei definierbare Umlageschlüssel je Liegenschaft, Muster der WEG-Verwaltung; Verwaltung
  im Reiter „Umlageschlüssel" von /abrechnung). Finalisierte Perioden sind nicht mehr
  bearbeitbar, ihre Löschung bleibt möglich (räumt Abrechnungs-PDFs aus der Dateiablage und
  Postversand-Protokolle mit weg, `deleteBillingPeriodWithArtifacts`). Die Vorauszahlungen
  in der Abrechnung werden nur aus TATSÄCHLICH geleisteten Zahlungen berechnet (bezahlte
  Monats-Sollstellungen, `computePaidPrepaymentsCents` in `src/lib/billing.ts`). Die
  Kostenseite kann je Entwurfs-Periode per Dialog „Aus Buchhaltung übernehmen" aus der
  Buchhaltung importiert werden (`importCostItemsFromBankingAction`): je Konto EINE
  Position in Höhe der Nettosumme seiner Buchungszeilen im Zeitraum (Erstattungen
  verrechnet, Konten mit Saldo 0 übersprungen; Buchungen gegen Sollstellungen bleiben
  ausgenommen); Summierung `listAccountBookingSumsForPeriod` (src/data/accounts.ts),
  reine Umwandlung `buildCostItemsFromAccountBookingSums` (src/lib/billing.ts), atomares
  Einfügen `createCostItems` (src/data/billing.ts).
- **Dokumentvorlagen:** `document_templates`, `generated_documents`
- **WEG-Verwaltung:** siehe Abschnitt 6.1
- **Postversand:** `postal_shipments` (polymorph über `sourceType`/`sourceId`)
- **Kalender:** `calendar_events` (nur die manuell gepflegten Ereignisse; die automatischen
  Termine – Einzug/Auszug der Mietverträge, Eigentümerversammlungen – werden zur Laufzeit aus
  den Fachdaten berechnet, `src/lib/calendar.ts`)
- **Wissensdatenbank:** `knowledge_base_articles` (einfache Text-Artikel mit optionalem
  Kategorie-Schlagwort; Suche per LIKE über Titel/Kategorie/Inhalt)
- **KI-Assistent:** `chat_messages` (persistenter Chat-Verlauf pro Nutzer – `user_id` ON
  DELETE CASCADE, `tool_calls` als JSON-TEXT nur für die UI-Anzeige, `attachments` als
  JSON-TEXT mit den Metadaten – Name + Größe – der Datei-Anhänge, Rolle `error` =
  fehlgeschlagene Anfrage als markierte Fehler-Nachricht; bleibt bis zum manuellen Löschen
  im Dialog erhalten, siehe Abschnitt 2), `prompt_templates` (eigene Prompt-Vorlagen pro
  Nutzer; die lokalisierten Vorlagen ab Werk stehen im Code, `src/lib/ai/prompt-templates.ts`)
- **Einstellungen:** `company_settings` (Singleton, feste `id = "singleton"`), `app_settings`
  (technische Key/Value-Konfiguration: SMTP, LetterXpress, KI-Endpunkt, URL-Overrides – keine Fachdaten;
  Geheimnisse wie `smtp.pass`/`letterxpress.apikey`/`ai.apikey` sind feldverschlüsselt, transparent über
  `src/data/app-settings.ts`)
- **Authentifizierung:** `users`, `sessions`, `verification_tokens`, `password_reset_tokens`
- **Aktivitätsprotokoll (Audit Log):** `audit_log_entries` (append-only; `user_email` denormalisiert,
  `user_id` ON DELETE SET NULL). Geschrieben aus Server Actions über `logActivity()`
  (`src/lib/audit.ts`, best-effort, bricht die Fachoperation nie); Einsicht nur für Admins
  unter `/admin/logs` (Filter nach Nutzer/Bereich + Pagination). Ausnahmen ohne Log-Eintrag:
  vollständiger App-Reset (löscht die Log-Tabelle mit), reine Lese-/Vorschau-Aktionen,
  MCP-Zugriffe (Token ohne Nutzerkontext). Sonderfall Inhalts-Reset: wiped die Log-Tabelle
  und protokolliert sich danach selbst als einzigen neuen Eintrag.

### 6.1 WEG-Verwaltung (Wohnungseigentümergemeinschaften)

Additive Erweiterung um WEG-Verwaltung nach deutschem WEG i. d. F. nach der Reform 2020.
Naming-Konvention: `hoa`/`Hoa` im Code, UI deutsch.

- **Stammdaten:** `hoas` (1:1 an `properties`, `totalShares` = Nenner der Miteigentumsanteile),
  `owners`, `unit_ownerships` (zeitversioniert, inkl. optionalem `coOwnerId`)
- **Frei definierbare Verteilerschlüssel:** `hoa_custom_allocation_keys`,
  `hoa_custom_allocation_key_weights`
- **Wirtschaftsplan:** `economic_plans`, `economic_plan_unit_shares` (eingefroren nach Finalisierung)
- **Jahresabrechnung:** `annual_statements`, `annual_statement_unit_results` (inkl.
  Abrechnungsspitze; `pdf_path`/`pdf_file_size`/`pdf_generated_at` = erzeugte Einzelabrechnungs-
  PDFs je Eigentümer-Zeitanteil), `annual_statement_unit_result_lines`
- **Kostenpositionen (Plan + Abrechnung gemeinsam):** `hoa_cost_items` (Diskriminator `context` =
  `"PLAN"`/`"STATEMENT"`; die Kostenart-Kategorie wurde wie in der Mietverwaltung entfernt,
  die Bezeichnung trägt die fachliche Information selbst), `hoa_cost_item_consumption_values`
- **Hausgeld:** `housing_charges` (Bezahl-Status auch automatisch über vollständige Zuordnung
  von Bankbuchungen, Buchungskreis WEG der Buchhaltung)
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
   Höhe des berechneten WEG-Anteils; die Entscheidung trifft ausschließlich das explizite Flag -
   die frühere Kostenart-Default-Matrix ist mit dem Feld entfallen).
9. Vermögensbericht (§ 28 Abs. 4 WEG) vereinfacht (Rücklagenstand + offene Hausgeldforderungen).
10. Jahresabrechnung = Spiegel der Nebenkostenabrechnung der Mietverwaltung: individuelle Periode
    je WEG, Notizen jederzeit editierbar (`annual_statements_set_notes`), Finalisierung friert die
    Einzelabrechnungen ein (nur noch löschbar via `deleteAnnualStatementWithArtifacts`, räumt
    PDFs + Postversand-Protokolle weg), PDF je Eigentümer + „PDF für alle" (geteiltes Layout
    `src/lib/pdf/statement-pdf.ts`, Hüllen `billing-statement.ts`/`hoa-annual-statement.ts`,
    Ablage `hoa-annual-statements/`, sichtbar unter /dokumente als vierte Quelle), Postversand
    über `HOA_ANNUAL_STATEMENT`. Die Vorauszahlungen stammen ausschließlich aus TATSÄCHLICH
    geleisteten Zahlungen (`calculatePaidPrepaymentsCents`, nur `PAID`-Hausgelder - manuell
    markiert oder automatisch durch vollständige Bankbuchung; offene Beträge bleiben Rückstand
    und verfälschen das Ergebnis nicht, `paidPrepaymentCount` = 0 = UI-Warnhinweis). Vor der
    Finalisierung läuft eine Plausibilitätsprüfung als Hinweis-Karte (keine Sperre):
    Summe Einzelabrechnungen vs. Kostenpositionen, Plan-/Ist-Abgleich gegen finalisierte
    Wirtschaftspläne des überlappenden Geschäftsjahrs, offene Hausgeld-Rückstände
    (`buildAnnualStatementConsistencyCheck`, `src/lib/hoa-annual-statement.ts`). Kostenpositionen
    können per Dialog „Aus Buchhaltung übernehmen" importiert werden (geteilt mit der
    Mietverwaltung: `listAccountBookingSumsForPeriod` + `buildCostItemsFromAccountBookingSums`,
    atomar `createHoaCostItems`). Buchhaltung der WEG = geteilte liegenschaftsbezogene Tabellen
    (UI /weg/buchhaltung, Konten + Banktransaktionen je WEG-Konto, Zuordnen zu Konten oder
    offenen Hausgeld-Sollstellungen).

## 7. Code-Konventionen

- **Deutsche Sprache** für Kommentare und Commit-Kommunikation. **UI-Texte** laufen über das
  eigene i18n-System (`src/lib/i18n/`, Deutsch = Standard, Englisch = Alternative; Sprachwahl im
  Cookie `immobase_locale`, Umschalter in den Einstellungen und auf den Auth-Seiten): Keine
  hartcodierten UI-Texte mehr - jeder sichtbare Text ist ein Schlüssel im passenden
  Modul-Namespace unter `src/lib/i18n/messages/de|en/<namespace>.ts` (flache Objekte, Subkeys
  mit Punkten, `{platzhalter}` für Interpolation). Server Components/Actions/Route Handler:
  `const t = await getT();` aus `@/lib/i18n/server`; Client Components: `const { t } = useI18n();`
  aus `@/lib/i18n/provider`. Neue Schlüssel IMMER in beiden Sprachen anlegen (de = Originalwortlaut,
  en = Übersetzung) - die Parität (Schlüsselmenge + Platzhalter) ist per `typeof de<Ns>` im
  en-Modul compile-zeit-erzwungen und wird zusätzlich von `src/lib/i18n/messages.test.ts`
  zur Laufzeit geprüft. Allgemeine Begriffe in `common` wiederverwenden statt duplizieren.
  Ausnahmen (bleiben bewusst deutsch bzw. unlokalisiert): Code-Kommentare, `logActivity()`-
  Audit-Texte und gespeicherte Protokoll-Einträge, E-Mail-Inhalte, generierte PDF-Inhalte
  (fachlich deutsche Dokumente), MCP-Tool-Beschreibungen, Nutzerdaten, Datums-/Zahlen-/
  Währungsformate (`src/lib/format.ts`, de-DE) sowie die Electron-Shell-Seite `connect.html`.
  Reine Server-Libs ohne Request-Kontext (z. B. `postal-shipments.ts`, `ai/*`) erhalten die
  Sprache über einen optionalen `t`-/`locale`-Parameter mit deutschem Default, damit Unit-Tests
  ohne Cookie-Kontext unverändert laufen.
- **Tabs** statt Spaces (an bestehenden Dateien orientieren).
- **Server Actions:** Rückgabetyp `ActionState` (`src/lib/action-state.ts`) für die meisten
  Formular-Actions; eigene State-Typen in separaten Dateien ohne `"use server"` (Muster:
  `login-state.ts`, `preview-state.ts`). **Jede** Server Action beginnt mit `await requireUser()`
  bzw. `await requireAdmin()`. Jede **datenverändernde** Action protokolliert ihren Erfolg
  zusätzlich über `logActivity(user, aktion, kategorie, beschreibung, entityId?)`
  (`src/lib/audit.ts`; Beschreibung = fertiger deutscher Satz mit fachlicher Bezeichnung,
  bei Löschungen die Bezeichnung vorher über das Repository ermitteln).
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
- **Select-Felder:** Dynamische Listen aus der Datenbank (Liegenschaften, Einheiten, Mieter,
  Eigentümer, Verträge, Tickets, Buchungsziele, Umlageschlüssel, ...) verwenden die
  durchsuchbare Combobox `SearchableSelect` (`src/components/ui/searchable-select.tsx`:
  Popover + cmdk; Formular-Integration über `name`/`required` per unsichtbarem nativem select
  wie bei Radix Select, kontrolliert oder über `defaultValue`; Gruppen über `option.group`,
  Zusatz-Suchbegriffe über `option.keywords`; UI-Texte über `common.searchableSelect.*`).
  Feste Enum-Listen mit wenigen Optionen (Status, Typen, Sprache) bleiben beim klassischen
  `Select`.
- **Cross-Modul-Verlinkung:** Query-Param-Filter (`?propertyId=`/`?unitId=`/`?hoaId=`) +
  Anchor-Links (`id="<typ>-<id>"`, Hervorhebung via `tr:target` in `globals.css`) +
  `CountLinkBadge` – Muster aus den Listen-Seiten fortführen.
- **Listen-Tabellen (generische DataTable):** Alle Listen-/Übersichtstabellen nutzen die
  generische Client-Komponente `DataTable` (`src/components/ui/data-table.tsx`): je Spalte
  sortierbar (Klick auf Kopf: aufsteigend → absteigend → ursprüngliche Reihenfolge; Zahlen
  numerisch, Strings per localeCompare „de", ISO-Datums-Strings korrekt, `null` zuletzt) und
  filterbar (Freitext-Substring case-insensitiv oder Select mit Optionen), optionale
  Client-Pagination (`pageSize`, Standard `LIST_PAGE_SIZE` = 50 aus `src/lib/pagination.ts`)
  inkl. Trefferzähler + „Filter zurücksetzen" und „Keine Einträge für die aktuellen Filter"-
  Leerzeile. Muster je Modul: dünne Client-Komponente `src/components/<modul>/<name>-table.tsx`
  definiert die Spalten (`DataTableColumn<T>`: `sortValue`-Accessor, `filter`, `cell`-Renderer,
  Aktionen-Spalte nie sortier-/filterbar) und rendert `DataTable`; die Server-Page lädt die
  VOLLE Zeilenmenge über den Repository-Layer und reicht sie als **serialisierbare** Props
  weiter (Maps/Lookups serverseitig in die Zeilen einbetten oder als Array-Props übergeben –
  Row-Typen ggf. abflachen; Exemplare: `properties-table.tsx`, `transactions-table.tsx`,
  `resolutions-table.tsx`). Zeilen-Anker (`rowId`) und Status-/Betrags-Konventionen
  (Status = Select-Filter mit i18n-Labels, Beträge rechtsbündig + `Number()`-Sortierung wegen
  Decimal-Strings) fortführen. Sortierung/Filterung/Pagination laufen bewusst clientseitig
  (Desktop-App, lokale SQLite-Datenmengen); serverseitige Query-Param-Filter aus
  Cross-Modul-Links bleiben als Vorfilter erhalten. Die früheren serverseitigen
  Status-Filterformulare (GET-Forms) und die Server-Pagination (`?page=`, `PaginationBar`,
  `resolvePagination`) sind entfallen – `PaginationBar` wurde entfernt;
  `src/lib/pagination.ts` liefert nur noch `LIST_PAGE_SIZE` + `buildPageNumbers` (Client-
  Pagination der DataTable), die paginierten Repository-Varianten (`listXPage`/`countX`)
  bleiben als getestete Primitive erhalten (`src/data/pagination.test.ts`).
  Seitenübergreifende Summen (Rückstands-Karten) weiterhin über eigene Aggregat-Funktionen
  (`listOpenTransactionArrearAmounts`/`listOpenHousingChargeArrearAmounts`). Bewusst KEINE
  DataTable: Ticket-Kanban, Kalender, Postfach (E-Mail-Karten) sowie kleine Dialog-Tabellen
  (Miet-/Anpassungshistorie, Buchhaltungs-Import-Vorschau).

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
  ~120 MB mit dem OCR-Stack für den KI-Chat, der allein ~55 MB beiträgt:
  @napi-rs/canvas-Binary + tesseract.js-core-WASM + deutsches Sprachmodell; vorher ~30 MB) und
  Boot-Test (`node .next/standalone/server.js`, better-sqlite3-Symlink beachten) prüfen.
  Zwei weitere Fallen in dem Zusammenhang: Turbopack wendet Datei-Ausschlüsse unterhalb von
  `node_modules/tesseract.js-core` NICHT an (die ungenutzten `*.wasm.js`-Single-File-Builds
  bleiben daher im Trace, ~11 MB totes Gewicht), und electron-builder dupliziert alle
  `dependencies` zusätzlich in `app.asar` – serverseitige OCR-Pakete sind deshalb in
  `electron-builder.yml` per `files`-Negation aus app.asar ausgeschlossen (der Main-Prozess
  require()t sie nie; der Next-Server nutzt ausschließlich den Standalone-Baum).
- **Tracing-Falle 2 (fehlendes Turbo-Runtime-Modul):** Der Standalone-Trace verfehlt
  `next/dist/compiled/next-server/app-route-turbo.runtime.prod.js` (Runtime aller App-Route-
  Handler), weil Turbopack es nicht als Dependency erkennt – Folge: JEDE Route unter `/api/*`
  liefert in der gepackten Desktop-App HTTP 500 („Cannot find module"), obwohl dev- und
  `node .next/standalone/server.js`-Betrieb funktionieren (dort steht das volle `node_modules`
  zur Verfügung). Fix: `outputFileTracingIncludes` in `next.config.ts` nimmt das Modul für
  `/api/**` explizit auf. Nach Änderungen am Tracing immer `npm run pack` und eine API-Route in
  der gepackten App testen.

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
- **OCR des KI-Chats auf macOS-x64-Paketen (Intel-Mac) nicht verfügbar**: Der macOS-Build
  erzeugt x64+arm64 aus einem einzigen Runner; das N-API-Binary von `@napi-rs/canvas` wird per
  optionalDependency nur für die Runner-Architektur installiert – im x64-Paket fehlt es daher
  (electron-builder kann reine Prebuilt-Pakete nicht pro Architektur nachbauen). Die OCR fällt
  dort kontrolliert auf die Fehlermeldung „kein extrahierbarer Text" zurück
  (OcrEngineError-Fallback); Text-PDFs und alle übrigen Anhänge funktionieren uneingeschränkt.
  Bei Bedarf könnte der Release-Workflow das x64-Paket explizit nachinstallieren.
- **Keine eigene UI** für Zählerstände (`meters`/`meter_readings`) und Übergabeprotokolle
  (`protocols`) – Tabellen sind vollständig angelegt, aber es gibt noch keine Seiten/Actions dafür.
- Kein Rollen-Wechsel (`USER` ↔ `ADMIN`) in der Admin-UI, nur der Freigabe-Toggle (`isApproved`).
  Bei Bedarf direkt in der DB (z. B. per `sqlite3 data.dev`/`data.db`).
- **Tests:** Vitest für gezielte Unit-/Integrationstests von Server-Code: `src/data/*.test.ts`
  (Migrationen vor/zurück, Backup-Roundtrip inkl. Prüfsummen, Repository-CRUD/Transaktionen
  inkl. Abrechnungs-Finalisierung, frei definierbarer Umlageschlüssel und Buchhaltung –
  Konten/Banktransaktionen/Buchungszeilen mit abgeleiteter Bezahl-Automation BEIDER
  Buchungskreise inkl. Hausgeld-Buchungen und Kreis-Trennung, Löschen finalisierter
  Perioden/Jahresabrechnungen mit Artefakt-Cleanup;
  `ticket-messages.test.ts` = Postfach/Verknüpfung/Umwandlung/Entknüpfen/Neu-Zuordnung/Dedup/
  Threading + IMAP-Sync-Stand,
  `chat-messages.test.ts` = persistenter KI-Chat-Verlauf: Reihenfolge/Nutzer-Trennung/Löschen/
  Fehler-Rolle/Anhang-Metadaten, `prompt-templates.test.ts` = eigene Prompt-Vorlagen: CRUD/Nutzer-Trennung/
  Kaskade),  `src/lib/ticket-mailer.test.ts` (Ticket-E-Mail-Versand: SMTP-Sperre, Threading, Betreff-Kennung,
  Verlauf-Ablage; Mailer gemockt), `src/lib/ticket-ref.test.ts` (Ticket-Kennung im Betreff),
  `src/lib/letterxpress.test.ts`, `src/lib/postal-shipments.test.ts` (Mocks),
  `src/lib/dropbox.test.ts`/`src/lib/dropbox-backup.test.ts` (API-Client + Orchestrierung, fetch
  gemockt), `src/lib/auth/bootstrap.test.ts` (Konto-Bootstrapping, Mailer gemockt) und
  `src/lib/billing.test.ts` (reine Abrechnungs-Berechnung: tatsächlich geleistete Vorauszahlungen
  taggenau, CUSTOM-Umlage) und
  `src/lib/hoa-annual-statement.test.ts` (reine WEG-Abrechnungs-Berechnung: nur tatsächlich
  geleistete Hausgeld-Zahlungen inkl. paidCount, MEA-Verteilung, taggenauer Eigentümerwechsel,
  Rücklagen-Zuführung als normale Position, Plausibilitätsprüfung Gesamt-/Einzelabrechnung vs.
  Wirtschaftsplan/Rückstände) und
  `src/lib/mcp/mcp.test.ts` (MCP: Token/Enabled beider Token-Stufen, JSON-RPC-Protokoll,
  Scope-Filterung ADMIN vs. USER, Werkzeug-Durchstiche inkl.
  Fachregeln, Meta-Werkzeug `batch_execute`: Teilerfolg/Fortsetzung nach Fehlern, `stopOnError`-
  Abbruch, Verschachtelungs-Sperre, Scope je Unteraufruf, Batch-Validierung, Obergrenze),
  `src/lib/ai/chat.test.ts` (KI-Assistent: Konfiguration inkl.
  Secret-Verschlüsselung, Anhang-Aufbereitung für PDF/Office/Bilder/Excel/Text, Tool-Loop gegen
  gemockten OpenAI-Endpunkt inkl. Vision-Content-Parts, rollenbasierter Werkzeug-Einschränkung und
  Batch-Ausführung mit UI-Aufschlüsselung der Einzelaufrufe) und `src/lib/ai/ocr.test.ts`
  (echter OCR-Durchstich ohne Mocks: Bild-PDF ohne Textebene → pdfjs-Rasterung → tesseract.js)
  sowie
  `src/lib/hoa-*.test.ts` (reine WEG-Berechnungen inkl. End-to-End-Durchstich),
  `src/lib/calendar.test.ts` (Kalender-Aggregation/Monatsraster) und
  `src/data/search.test.ts` (globale Suche: Umlaut-Faltung, href-Verweise, OCR-LIKE-Pfad,
  Admin-Gating der Benutzerkonten, Limit je Entitätsart). Es gibt weiterhin
  **keine** Tests für Server Actions, React-Komponenten oder E2E-Abdeckung.
- **Import „Zusammenführen"** ist zeilenbasiert (`INSERT OR IGNORE`, lokaler Bestand gewinnt) –
  kein Sync-Protokoll für parallele Mehrgeräte-Bearbeitung.
- Update-Feed über GitHub-Releases (öffentlich); private Feeds würden eine Anpassung des
  electron-updater-Providers erfordern.

> **Hinweis für Agenten:** Diesen Abschnitt bei größeren Meilensteinen (neue Module,
> Architektur-/Infrastrukturwechsel) eigenständig aktualisieren – alten Stand durch den neuen
> ersetzen statt endlos anzuhängen.
