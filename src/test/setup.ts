import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Vitest-Setup: lenkt alle Datenzugriffe (SQLite-DB, files/, logs/) in ein
 * temporäres Verzeichnis um, damit Tests keine Seiteneffekte im Repository
 * (z. B. ein versehentlich angelegtes data-dev/) erzeugen - auch wenn ein
 * Test transitiv getDb() auslöst (z. B. über App-Einstellungen im
 * LetterXpress-/Mailer-Modul).
 *
 * Einzelne Testdateien (z. B. src/data/migrate.test.ts) setzen APP_DATA_DIR
 * in ihren eigenen beforeEach-Hooks auf jeweils frische Temp-Verzeichnisse
 * um und räumen diese selbst auf.
 */
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "iv-test-env-"));
