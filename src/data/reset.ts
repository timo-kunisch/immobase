import fs from "node:fs";
import path from "node:path";

import { closeDb, getDb } from "./db";
import { getDataDir, getDatabaseFilePath, getFilesDir } from "./paths";

/**
 * Vollständiges Zurücksetzen der Anwendung ("Factory Reset") aus den
 * Einstellungen heraus (nur Admins, mit Tipp-Bestätigung - siehe
 * src/app/(app)/einstellungen/actions.ts). Entspricht der UI-Variante
 * "Inhalte und Einstellungen zurücksetzen".
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

/**
 * Tabellen, die der Inhalts-Reset (resetApplicationContent) bewusst
 * erhält: Benutzerkonten samt Sitzungen und Token (Authentifizierung,
 * niemand wird abgemeldet) sowie die Einstellungen - `app_settings`
 * (technische Konfiguration wie SMTP/IMAP/LetterXpress/Dropbox/KI/MCP
 * inkl. der feldverschlüsselten Geheimnisse) und `company_settings`
 * (Absenderdaten für PDF-Briefköpfe).
 */
const CONTENT_RESET_PRESERVED_TABLES = new Set([
	"users",
	"sessions",
	"verification_tokens",
	"password_reset_tokens",
	"company_settings",
	"app_settings",
]);

/**
 * Inhalts-Reset OHNE Anfassen der Einstellungen und Benutzerkonten
 * (UI-Variante "Inhalte zurücksetzen", nur Admins, mit Tipp-Bestätigung -
 * siehe src/app/(app)/einstellungen/actions.ts).
 *
 * Gelöscht werden die Zeilen ALLER übrigen Tabellen (dynamisch über
 * sqlite_master ermittelt - auch künftige Fachdaten-Tabellen aus neuen
 * Migrationen werden so automatisch erfasst), darunter:
 * - sämtliche Fachdaten beider Bereiche (Mietverwaltung und WEG),
 * - der KI-Chat-Verlauf samt eigenen Prompt-Vorlagen,
 * - das Aktivitätsprotokoll (die auslösende Server Action protokolliert
 *   den Reset danach als einzigen neuen Eintrag),
 * - der IMAP-Abgleichstand (imap_sync_state): Der Postfach-Ordner wird
 *   beim nächsten Abruf vollständig neu vom Mailserver gesynced -
 *   dort noch vorhandene E-Mails kehren als unzugeordnete Postfach-
 *   Einträge zurück, während bereits gelöschte verschwinden.
 *
 * Dazu außerhalb der Datenbank (innerhalb des Datenverzeichnisses):
 * - der komplette Inhalt der Dateiablage `files/` (Uploads + generierte
 *   Dokumente; das Verzeichnis selbst wird sofort leer neu angelegt),
 * - das E-Mail-Outbox-Log `logs/outbox.log` und verwaiste Import-Temp-
 *   Verzeichnisse (gleiche Aufräumarbeiten wie beim vollständigen Reset).
 *
 * Bewusst NICHT angefasst werden:
 * - die Datenbank-Datei selbst (kein Neu-Anlegen/Migrieren nötig, die
 *   App läuft ohne Unterbrechung weiter - inkl. aller angemeldeten Nutzer),
 * - die unter CONTENT_RESET_PRESERVED_TABLES gelisteten Tabellen,
 * - die lokalen Vor-Import-Sicherungen unter `backups/`: Sie sind
 *   Archive, kein "lebender" Inhalt - als einziger Rettungspfad vor
 *   einem früheren Import bleiben sie bewusst erhalten,
 * - `settings.json`/`.data-key` (Installations-/Gerätedateien, wie beim
 *   vollständigen Reset),
 * - `logs/main.log` (Betriebslog des Electron-Main-Prozesses).
 */
export function resetApplicationContent(): void {
	const db = getDb();
	const dataDir = getDataDir();

	// Fachliche Tabellen dynamisch ermitteln: alles außer den internen
	// SQLite-Tabellen (sqlite_*) und der Erhaltens-Liste.
	const contentTables = (
		db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as {
			name: string;
		}[]
	)
		.map((row) => row.name)
		.filter((name) => !CONTENT_RESET_PRESERVED_TABLES.has(name));

	// Fremdschlüssel-Prüfungen nur für den Wipe deaktivieren: Die Tabellen
	// werden in beliebiger Reihenfolge geleert, Eltern-/Kind-Beziehungen
	// zwischen Fachdaten würden sonst eine Lösch-Reihenfolge erzwingen.
	// Der Pragma-Wechsel muss außerhalb einer Transaktion erfolgen und wird
	// im finally garantiert zurückgesetzt.
	db.pragma("foreign_keys = OFF");
	try {
		db.transaction(() => {
			for (const table of contentTables) {
				db.exec(`DELETE FROM "${table}"`);
			}
		})();
	} finally {
		db.pragma("foreign_keys = ON");
	}

	// Dateiablage leeren und sofort wieder als leeres Verzeichnis anlegen
	// (ensurePrivateDir in paths.ts).
	fs.rmSync(getFilesDir(), { recursive: true, force: true });
	getFilesDir();

	// E-Mail-Outbox-Log (Altlast aus älteren Versionen, enthält E-Mail-
	// Inhalte - Fachdaten) entfernen.
	fs.rmSync(path.join(dataDir, "logs", "outbox.log"), { force: true });

	// Verwaiste Import-Temp-Verzeichnisse (nur nach abgestürztem Import
	// vorhanden, siehe src/data/backup.ts).
	for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
		if (entry.isDirectory() && (entry.name.startsWith(".import-extract-") || entry.name.startsWith(".import-trash-"))) {
			fs.rmSync(path.join(dataDir, entry.name), { recursive: true, force: true });
		}
	}

	// Speicherplatz der gelöschten Zeilen zurückgeben, damit die Dateigröße
	// wieder einer frischen Datenbank ähnelt. Best effort: Der Wipe ist zu
	// diesem Punkt bereits abgeschlossen - ein VACUUM-Fehler darf ihn nicht
	// rückgängig erscheinen lassen.
	try {
		db.exec("VACUUM");
	} catch (error) {
		console.error("VACUUM nach dem Inhalts-Reset fehlgeschlagen", error);
	}
}
