import fs from "node:fs";

import BetterSqlite3 from "better-sqlite3";

import { getDatabaseFilePath } from "./paths";
import { migrateDatabase } from "./migrate";
import { lockDatabaseIfNeeded, unlockDatabaseIfNeeded } from "./db-vault";

/**
 * better-sqlite3-Verbindung (synchron, kein Promise-Wrapper).
 *
 * Die Verbindung ist ein Modul-Level-Singleton: Der Next.js-Server läuft
 * lokal im Electron-Main-Prozess (bzw. in `next dev`) - ein prozessweites,
 * synchrones Handle ist hier der einfachste und sicherste Weg.
 *
 * WICHTIG: Die Verbindung wird LAZY beim ersten `getDb()`-Aufruf geöffnet
 * (nicht beim Modul-Import), damit `next build` die Module laden kann, ohne
 * eine Datenbankdatei anzulegen/zu benötigen. Beim ersten Öffnen läuft die
 * automatische Migration (siehe src/data/migrate.ts).
 *
 * Pragmas: WAL (konkurrierende Lesezugriffe während Schreibvorgängen),
 * foreign_keys=ON (durchgesetzte Referenzen), busy_timeout=5000 (Warten
 * statt sofortigem SQLITE_BUSY bei kurzen Lock-Konflikten).
 *
 * Verschlüsselung at rest (siehe src/data/db-vault.ts): Vor dem Öffnen wird
 * ein vorhandener Container `data.db.enc` entschlüsselt; beim sauberen
 * Beenden des Prozesses (exit/SIGINT/SIGTERM-Hooks) wird die Datenbank
 * wieder verschlüsselt abgelegt und der Klartext entfernt.
 */
let instance: BetterSqlite3.Database | null = null;

export function getDb(): BetterSqlite3.Database {
	if (instance) return instance;

	const dbFilePath = getDatabaseFilePath();
	// Container at rest entschlüsseln (No-Op, wenn nur Klartext vorhanden).
	unlockDatabaseIfNeeded(dbFilePath);

	const db = new BetterSqlite3(dbFilePath);
	try {
		// Zugriffsrechte restriktiv (nur eigener OS-Benutzer) - die DB enthält
		// sämtliche Fachdaten. Best effort (Windows kennt keine POSIX-Rechte).
		fs.chmodSync(dbFilePath, 0o600);
	} catch {
		// Ignorieren.
	}
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");
	db.pragma("busy_timeout = 5000");

	// Automatisches Migrieren beim Start (Auto-Backup davor, Rollback bei
	// Fehler, klare Meldung falls die DB neuer ist als die App).
	migrateDatabase(db, dbFilePath);

	instance = db;
	registerShutdownHooks();
	return db;
}

/**
 * Schließt die Verbindung und setzt das Singleton zurück. Wird für
 * Wartungsarbeiten benötigt (Daten-Import ersetzt die DB-Datei atomar,
 * siehe src/data/backup.ts) sowie in Tests. Verschlüsselt NICHT (das ist
 * Aufgabe von sealDatabaseForShutdown).
 */
export function closeDb(): void {
	if (instance) {
		instance.close();
		instance = null;
	}
}

/**
 * Versiegelt die Datenbank für das Prozessende: WAL-Checkpoint (TRUNCATE,
 * damit die Hauptdatei vollständig ist), Verbindung schließen, dann die
 * Datei verschlüsselt als `data.db.enc` ablegen und Klartext-Reste löschen
 * (siehe src/data/db-vault.ts). Idempotent und synchron (Exit-Hook-tauglich).
 */
export function sealDatabaseForShutdown(): void {
	if (instance) {
		try {
			instance.pragma("wal_checkpoint(TRUNCATE)");
		} catch (error) {
			console.error("Datenbank: WAL-Checkpoint vor der Versiegelung fehlgeschlagen", error);
		}
		try {
			instance.close();
		} catch (error) {
			console.error("Datenbank: Schließen vor der Versiegelung fehlgeschlagen", error);
		}
		instance = null;
	}
	lockDatabaseIfNeeded(getDatabaseFilePath());
}

let shutdownHooksRegistered = false;

/**
 * Registriert die Versiegelung auf Prozessende:
 * - "exit" (sauberes Node-Shutdown, auch Electron app.quit()): erlaubt nur
 *   synchronen Code - unsere Versiegelung ist vollständig synchron.
 * - SIGINT/SIGTERM (z. B. Ctrl+C in `next dev`, concurrently -k): erst
 *   versiegeln, dann mit dem konventionellen Exit-Code beenden (der
 *   "exit"-Hook ist idempotent und läuft ggf. ein zweites Mal als No-Op).
 *
 * In Tests (vitest) werden keine Hooks registriert - Lock/Unlock werden dort
 * gezielt direkt getestet (src/data/db-vault.test.ts).
 */
function registerShutdownHooks(): void {
	if (shutdownHooksRegistered || process.env.VITEST) return;
	shutdownHooksRegistered = true;

	process.once("exit", () => {
		try {
			sealDatabaseForShutdown();
		} catch (error) {
			console.error("Datenbank: Versiegelung beim Prozessende fehlgeschlagen", error);
		}
	});
	process.once("SIGINT", () => {
		try {
			sealDatabaseForShutdown();
		} finally {
			process.exit(130);
		}
	});
	process.once("SIGTERM", () => {
		try {
			sealDatabaseForShutdown();
		} finally {
			process.exit(143);
		}
	});
}
