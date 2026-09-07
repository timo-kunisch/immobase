# Mitmachen bei ImmoBase

Danke für dein Interesse! Beiträge (Fehlerberichte, Verbesserungsvorschläge,
Pull Requests) sind willkommen.

## Fehler melden

- Suche zuerst in den [Issues](https://github.com/timo-kunisch/immobase/issues),
  ob das Problem schon bekannt ist.
- Beschreibe: was du erwartet hast, was stattdessen passiert ist, Schritte zur
  Reproduktion, Plattform (Windows/macOS, Version) und – falls vorhanden –
  Auszüge aus `logs/main.log` im Datenverzeichnis (vor dem Anhängen auf
  personenbezogene Daten prüfen).

## Pull Requests

1. Forke das Repository und erstelle einen Feature-Branch von `main`.
2. Halte dich an die Projekt-Konventionen (siehe [AGENTS.md](AGENTS.md)):
   deutsche UI-Texte/Kommentare, Tabs, SQL nur im Repository-Layer
   (`src/data/`), jede Server Action prüft `requireUser()`/`requireAdmin()`.
3. Vor dem PR müssen lokal grün sein:
   ```bash
   npm run lint
   npm run test
   npm run build
   npx tsc -p electron/tsconfig.json
   ```
4. Schema-Änderungen: neue Migration in `src/data/migrations/` anhängen
   (`up` + `down`, bestehende nie editieren) und `npm run schema:dump`
   ausführen.
5. Beschreibe im PR kurz das Problem und deine Lösung.

## Entwicklungs-Setup

Siehe [README.md](README.md#entwicklung) – Kurzfassung:

```bash
npm install
npm run dev               # Browser-Entwicklung (Daten in ./data-dev)
npm run rebuild:electron  # für Desktop-Läufe (Electron-ABI)
npm run electron:dev      # Desktop-Entwicklung
```

## Verhaltenshinweis

Sachlich und respektvoll bleiben. Der Rechteinhaber behält sich vor,
Beiträge ohne Begründung abzulehnen.
