# ImmoBase

**Desktop-App zur Miet- und WEG-Verwaltung – vollständig offline, alle Daten lokal.**
Windows + macOS · Electron · Next.js · SQLite

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
- Backups als eine ZIP (mit Prüfsummen), Wiederherstellung mit einem Klick
- Mehrbenutzer optional: Host-/Client-Modus im LAN (Token-geschützt, mDNS)
- Kein Tracking, keine Telemetrie, keine externen Dienste im Kernpfad

## Download

Fertige Installer für Windows (NSIS) und macOS (DMG, Apple Silicon + Intel)
gibt es unter **[Releases](https://github.com/timo-kunisch/immobase/releases)**.

> Hinweis: Die Installer sind aktuell nicht signiert. macOS zeigt einmalig
> eine Gatekeeper-Warnung – App per Rechtsklick → „Öffnen" starten.
> Windows zeigt ggf. einen SmartScreen-Hinweis („Weitere Informationen" →
> „Trotzdem ausführen").

## Technik

| Bereich | Technologie |
| --- | --- |
| Desktop-Shell | Electron (electron-vite, TypeScript strict) |
| App/Server | Next.js 16 (App Router, Server Actions), React 19 |
| Datenbank | SQLite via better-sqlite3 (WAL, FK, Repository-Layer `src/data/`) |
| UI | Tailwind CSS v4, shadcn/ui, Lucide |
| PDF | pdfkit |
| Backup | archiver/yauzl (Streaming-ZIP, SHA-256-Manifest) |
| Build/Release | electron-builder (NSIS/DMG), electron-updater (GitHub Releases) |

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

Darunter: `data.db` (SQLite), `files/` (Uploads/generierte PDFs), `logs/`,
`backups/` (automatische Sicherungen vor Importen), `settings.json`.

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
streaming-tauglich für mehrere GB. Der Import validiert Manifest und
Prüfsummen, legt vorher automatisch eine Sicherung des Ist-Zustands an und
arbeitet atomar. Modi: **Ersetzen** oder **Zusammenführen** (nur fehlende
Einträge ergänzen, lokaler Bestand gewinnt).

## Mitmachen

Beiträge sind willkommen – siehe [CONTRIBUTING.md](CONTRIBUTING.md).
Architektur- und Arbeitsregeln für Mensch und Maschine stehen in
[AGENTS.md](AGENTS.md); die Entscheidungen der Portierung von Cloudflare
Workers auf die Desktop-App sind in [PORT.md](PORT.md) dokumentiert.

## Nutzungsrechte

Der Quellcode ist öffentlich einsehbar. **Alle Rechte vorbehalten.** Für
Nutzung, Verbreitung oder abgeleitete Werke ist eine ausdrückliche Genehmigung
des Rechteinhabers erforderlich – Anfragen gerne über ein GitHub-Issue.
