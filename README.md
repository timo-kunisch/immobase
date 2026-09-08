# ImmoBase

**Desktop-App zur Miet- und WEG-Verwaltung – vollständig offline, alle Daten lokal.**
Windows · macOS · Linux · Electron · Next.js · SQLite

[![CI](https://github.com/timo-kunisch/immobase/actions/workflows/release.yml/badge.svg)](https://github.com/timo-kunisch/immobase/actions/workflows/release.yml)
[![Aktuelles Release](https://img.shields.io/github/v/release/timo-kunisch/immobase)](https://github.com/timo-kunisch/immobase/releases)

🌐 Projekt-Website: **[immobase.app](https://immobase.app)**

ImmoBase verwaltet Mietobjekte und Wohnungseigentümergemeinschaften (WEG nach
deutschem WEG-Recht) – ohne Cloud-Zwang, ohne Abo, ohne Datenweitergabe. Die
gesamte Anwendung läuft lokal auf deinem Rechner; für Mehrbenutzer-Teams gibt
es einen optionalen Host-/Client-Modus im eigenen Netzwerk.

## Funktionen

**Mietverwaltung**
- Liegenschaften, Einheiten, Mieter, Mietverträge inkl. Mietverlauf
- Instandhaltungs-Tickets, Kautionen, Mieteingänge (fällige Zahlungen automatisch)
- Nebenkostenabrechnung (BetrKV) mit Verteilerschlüsseln, Verbrauchswerten und
  versandfertigen Einzelabrechnungen als PDF
- Dokumentenmanagement (DMS) und Briefvorlagen mit Platzhaltern
- Optionaler Postversand von PDFs (LetterXpress)

**WEG-Verwaltung**
- Eigentümer und zeitversionierte Eigentumsverhältnisse, Miteigentumsanteile
- Frei definierbare Verteilerschlüssel
- Wirtschaftsplan, Jahresabrechnung (inkl. Abrechnungsspitze), Hausgeld
- Erhaltungsrücklage mit Vermögensbericht
- Eigentümerversammlungen mit Tagesordnung, Einladungs-/Protokoll-PDF und
  Beschluss-Sammlung (§ 24 Abs. 6 WEG)
- BetrKV-Brücke: umlagefähige WEG-Kosten in die Mieter-Nebenkostenabrechnung

**Datenschutz & Kontrolle**
- Alle Daten in einer lokalen SQLite-Datenbank – funktioniert komplett offline
- Verschlüsselung aller Daten im Ruhezustand (AES-256-GCM, gerätegebundener
  Schlüssel im OS-Schlüsselbund)
- Backups als eine ZIP (mit Prüfsummen), optional passwortverschlüsselt,
  Wiederherstellung mit einem Klick
- Mehrbenutzer optional: Host-/Client-Modus im LAN (Token-geschützt, mDNS)
- Kein Tracking, keine Telemetrie, keine externen Dienste im Kernpfad

## Download

Fertige Pakete gibt es unter
**[Releases](https://github.com/timo-kunisch/immobase/releases)**:

- **Windows:** NSIS-Installer (`…-win-x64.exe`)
- **macOS:** ZIP mit der App (Apple Silicon + Intel) – entpacken und
  `ImmoBase.app` in den Programme-Ordner ziehen, keine Installation nötig
- **Linux:** AppImage (`…-linux-x64.AppImage`) – einmal ausführbar machen
  (`chmod +x`) und direkt starten, keine Installation nötig

## Technik

| Bereich | Technologie |
| --- | --- |
| Desktop-Shell | Electron (electron-vite, TypeScript strict) |
| App/Server | Next.js 16 (App Router, Server Actions), React 19 |
| Datenbank | SQLite via better-sqlite3 (WAL, FK, Repository-Layer `src/data/`) |
| UI | Tailwind CSS v4, shadcn/ui, Lucide |
| PDF | pdfkit |
| Backup | archiver/yauzl (Streaming-ZIP, SHA-256-Manifest) |
| Build/Release | electron-builder (NSIS/ZIP/AppImage), electron-updater (GitHub Releases) |

Die Desktop-Shell startet den Next.js-Standalone-Server in-process auf
`127.0.0.1` (dynamischer Port) und zeigt ihn in einem Fenster an – es gibt
keinen separaten Renderer-Build und keinen Cloud-Backend-Aufruf.

## Entwicklung

Voraussetzungen: Node.js 22+ (24 empfohlen), npm.

```bash
npm install               # Abhängigkeiten (Node-ABI-Prebuild für better-sqlite3)

npm run dev               # Web-Entwicklung im Browser (Daten in ./data-dev)

npm run rebuild:electron  # einmalig: better-sqlite3 gegen Electron-ABI bauen
npm run electron:dev      # Desktop-Entwicklung (Electron-Fenster + HMR)

npm run lint              # ESLint
npm run test              # vitest
npm run build             # next build (Standalone-Output)
npx tsc -p electron/tsconfig.json   # Typcheck der Electron-Sourcen
```

> `better-sqlite3` ist ein natives Modul. Für Electron-Läufe muss es gegen
> die Electron-ABI gebaut sein (`npm run rebuild:electron`), für Tests/
> `next dev` gegen Node (`npm run rebuild:node`). Beim Packaging erledigt das
> electron-builder automatisch.

## Datenpfade

Alle Daten liegen unter `app.getPath("userData")`:

- Windows: `%APPDATA%\ImmoBase\`
- macOS: `~/Library/Application Support/ImmoBase/`
- Linux: `~/.config/ImmoBase/`

Darunter: `data.db` (SQLite, im Ruhezustand verschlüsselt als `data.db.enc`),
`files/` (Uploads/generierte PDFs, verschlüsselt), `logs/`, `backups/`
(automatische, verschlüsselte Sicherungen vor Importen), `settings.json`.

## Mehrbenutzer-Betrieb

Beim ersten Start wählbar (später: Einstellungen → Verbindung):

- **Lokal** (Standard) – alles auf diesem Rechner.
- **Host** – stellt die Daten anderen Arbeitsplätzen im Netzwerk bereit
  (Token-geschützter LAN-Proxy; DB bleibt auf der lokalen Platte des Hosts).
- **Client** – verbindet sich mit einem Host (keine lokalen Daten);
  automatische Host-Erkennung per mDNS, manueller Fallback per URL + Token.

> Die SQLite-Datei darf **niemals** auf einem Netzlaufwerk liegen – die App
> prüft das beim Start und bricht mit Erklärung ab (Datenkorruptionsrisiko
> über SMB/NFS).

## Backup & Wiederherstellung

Einstellungen → Datensicherung: Export als eine ZIP (`manifest.json` mit
SHA-256 je Datei, `data.db` über die SQLite-Backup-API, `files/`) –
streaming-tauglich für mehrere GB. Optional kann das Backup in der
Desktop-App **mit einem Passwort verschlüsselt** werden (AES-256-GCM,
Schlüsselableitung per scrypt; Dateiendung `.imbak`). Der Import erkennt
verschlüsselte Dateien automatisch und fragt das Passwort ab; validiert
werden Manifest und Prüfsummen, vorher wird automatisch eine Sicherung des
Ist-Zustands angelegt, die Arbeit läuft atomar. Modi: **Ersetzen** oder
**Zusammenführen** (nur fehlende Einträge ergänzen, lokaler Bestand
gewinnt).

## Lizenz

Siehe [LICENSE](LICENSE).
