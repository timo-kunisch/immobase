import fs from "node:fs";
import path from "node:path";

import { closeDb, getDb } from "./db";
import { getDataDir, getDatabaseFilePath, getFilesDir } from "./paths";

/**
 * Vollständiges Zurücksetzen der Anwendung ("Factory Reset") aus den
 * Einstellungen heraus (nur Admins, mit Tipp-Bestätigung - siehe
 * src/app/(app)/einstellungen/actions.ts).
 *
 * Gelöscht wird ausschließlich innerhalb des Datenverzeichnisses
 * (APP_DATA_DIR, siehe src/data/paths.ts):
 * - die SQLite-Datenbank in allen Formen: `data.db` (+ `-wal`/`-shm`), der
 *   verschlüsselte Ruhezustands-Container `data.db.enc`, die automatischen
 *   Migrations-Backups `data.db.pre-migrate-*.enc` und verwaiste
 *   Lock/Unlock-Temp-Dateien (src/data/db-vault.ts) - damit sind sämtliche
 *   Fachdaten, Benutzerkonten, Sessions und Einstellungen (inkl. der
 *   feldverschlüsselten Geheimnisse in app_settings) entfernt,
 * - das komplette Dateiverzeichnis `files/` (Uploads + generierte
 *   Dokumente, src/lib/storage.ts),
 * - die lokalen Vor-Import-Sicherungen unter `backups/` (vollständige
 *   Datenkopien, src/data/backup.ts),
 * - das E-Mail-Outbox-Log `logs/outbox.log` (Altlast aus älteren
 *   Versionen, enthält E-Mail-Inhalte - wird seit der Entfernung des
 *   Outbox-Fallbacks nicht mehr geschrieben),
 * - verwaiste Import-Temp-Verzeichnisse (`.import-extract-*`,
 *   `.import-trash-*` - Reste abgestürzter Importe).
 *
 * Bewusst NICHT angefasst werden:
 * - `settings.json` und `.data-key`(`.managed`): Master-Schlüssel und
 *   Modus-/Verbindungskonfiguration gehören zur Installation auf diesem
 *   Gerät (Electron-Main-Prozess), nicht zu den App-Daten - nach dem Reset
 *   existieren ohnehin keine mit dem Schlüssel verschlüsselten Daten mehr.
 * - `logs/main.log`: Betriebslog des Electron-Main-Prozesses (dort ggf. als
 *   Datei-Handle geöffnet), keine Fachdaten.
 *
 * Anschließend wird die Datenbank sofort frisch angelegt (getDb() führt die
 * Migrationen auf einer leeren DB aus), damit die Anwendung ohne Neustart
 * konsistent weiterläuft und die Ersteinrichtung (/setup) wieder erreichbar
 * ist (countUsers() === 0). Das gilt auch im Fehlerfall (finally): Dann ist
 * der Datenbestand ggf. teilweise gelöscht, die App bleibt aber lauffähig.
 */
export function resetApplicationData(): void {
	const dataDir = getDataDir();
	const dbFilePath = getDatabaseFilePath();
	const dbBaseName = path.basename(dbFilePath); // "data.db"

	try {
		closeDb();

		// Alle DB-bezogenen Dateien löschen: Klartext ("data.db"), WAL/SHM
		// ("data.db-wal"/"-shm"), Container ("data.db.enc"), Migrations-Backups
		// ("data.db.pre-migrate-*.enc") und Stale-Temps ("data.db.dec-*.tmp",
		// "data.db.enc.enc-*.tmp") - gemeinsames Präfix "data.db".
		for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			if (entry.name === dbBaseName || entry.name.startsWith(`${dbBaseName}.`) || entry.name.startsWith(`${dbBaseName}-`)) {
				fs.rmSync(path.join(dataDir, entry.name), { force: true });
			}
		}

		// Dateiablage und lokale Sicherungen komplett entfernen (werden bei
		// Bedarf automatisch neu angelegt, siehe ensurePrivateDir in paths.ts).
		fs.rmSync(getFilesDir(), { recursive: true, force: true });
		fs.rmSync(path.join(dataDir, "backups"), { recursive: true, force: true });

		// E-Mail-Outbox-Log (Altlast aus älteren Versionen, enthält ggf.
		// noch E-Mail-Inhalte - wird nicht mehr geschrieben).
		fs.rmSync(path.join(dataDir, "logs", "outbox.log"), { force: true });

		// Verwaiste Import-Temp-Verzeichnisse (nur nach abgestürztem Import
		// vorhanden, siehe src/data/backup.ts).
		for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
			if (entry.isDirectory() && (entry.name.startsWith(".import-extract-") || entry.name.startsWith(".import-trash-"))) {
				fs.rmSync(path.join(dataDir, entry.name), { recursive: true, force: true });
			}
		}
	} finally {
		// In JEDEM Fall eine frische, migrierte Datenbank bereitstellen, damit
		// die Anwendung konsistent weiterläuft (Ersteinrichtung /setup).
		getDb();
	}
}
