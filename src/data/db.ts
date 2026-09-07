import BetterSqlite3 from "better-sqlite3";

import { getDatabaseFilePath } from "./paths";
import { migrateDatabase } from "./migrate";

/**
 * better-sqlite3-Verbindung (synchron, kein Promise-Wrapper).
 *
 * Im Unterschied zum früheren Cloudflare-D1-Setup DARF hier ein
 * Modul-Level-Singleton verwendet werden: Der Next.js-Server läuft lokal im
 * Electron-Main-Prozess (bzw. in `next dev`), es gibt keine Worker-
 * Isolates und kein Binding, das erst zur Request-Zeit existiert.
 *
 * WICHTIG: Die Verbindung wird LAZY beim ersten `getDb()`-Aufruf geöffnet
 * (nicht beim Modul-Import), damit `next build` die Module laden kann, ohne
 * eine Datenbankdatei anzulegen/zu benötigen. Beim ersten Öffnen läuft die
 * automatische Migration (siehe src/data/migrate.ts).
 *
 * Pragmas: WAL (konkurrierende Lesezugriffe während Schreibvorgängen),
 * foreign_keys=ON (durchgesetzte Referenzen), busy_timeout=5000 (Warten
 * statt sofortigem SQLITE_BUSY bei kurzen Lock-Konflikten).
 */
let instance: BetterSqlite3.Database | null = null;

export function getDb(): BetterSqlite3.Database {
	if (instance) return instance;

	const dbFilePath = getDatabaseFilePath();
	const db = new BetterSqlite3(dbFilePath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");
	db.pragma("busy_timeout = 5000");

	// Automatisches Migrieren beim Start (Auto-Backup davor, Rollback bei
	// Fehler, klare Meldung falls die DB neuer ist als die App).
	migrateDatabase(db, dbFilePath);

	instance = db;
	return db;
}

/**
 * Schließt die Verbindung und setzt das Singleton zurück. Wird für
 * Wartungsarbeiten benötigt (Daten-Import ersetzt die DB-Datei atomar,
 * siehe src/data/backup.ts) sowie in Tests.
 */
export function closeDb(): void {
	if (instance) {
		instance.close();
		instance = null;
	}
}
