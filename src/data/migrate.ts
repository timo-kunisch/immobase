import fs from "node:fs";

import type BetterSqlite3 from "better-sqlite3";

import { encryptFileToFileSync } from "@/lib/file-crypto";

import { migrations } from "./migrations";

export interface Migration {
	/** Ziel-`user_version` nach Anwendung dieser Migration (lückenlos ab 1). */
	version: number;
	/** Kurzname (nur für Logs/Diagnose). */
	name: string;
	/** SQL für das Upgrade auf diese Version (wird in einer Transaktion ausgeführt). */
	up: string;
	/** SQL für den Rückbau dieser Version (Downgrade, v. a. für Tests/Tools). */
	down: string;
}

/** Höchste von dieser App-Version unterstützte Schema-Version. */
export const LATEST_SCHEMA_VERSION = Math.max(...migrations.map((m) => m.version));

export class DatabaseTooNewError extends Error {
	constructor(
		public readonly databaseVersion: number,
		public readonly appVersion: number
	) {
		super(
			`Die Datenbank wurde mit einer neueren Version der Anwendung erstellt ` +
				`(Schema-Version ${databaseVersion}, diese App unterstützt bis Version ${appVersion}). ` +
				`Bitte aktualisieren Sie die Anwendung, bevor Sie fortfahren.`
		);
		this.name = "DatabaseTooNewError";
	}
}

function getUserVersion(db: BetterSqlite3.Database): number {
	return db.pragma("user_version", { simple: true }) as number;
}

function setUserVersion(db: BetterSqlite3.Database, version: number): void {
	// PRAGMA unterstützt keine gebundenen Parameter - version ist intern
	// erzeugt (Integer aus den Migrationsdefinitionen), daher hier sicher.
	db.pragma(`user_version = ${version}`);
}

/**
 * Legt ein Sicherungs-Backup der Datenbankdatei an, bevor migriert wird.
 *
 * Da die Migration ausschließlich über die (zu diesem Zeitpunkt einzige)
 * eigene Verbindung läuft, wird zuerst ein WAL-Checkpoint erzwungen
 * (TRUNCATE) - danach ist die Hauptdatei konsistent und kann synchron
 * kopiert werden. (Für den nutzerseitigen Export einer laufenden DB gilt
 * dagegen: nur `db.backup()`, siehe src/data/backup.ts.)
 *
 * Das Backup wird als verschlüsselter Container abgelegt
 * (`data.db.pre-migrate-<Zeitstempel>.enc`, Format siehe
 * src/lib/file-crypto.ts), damit keine Klartext-Kopie der Datenbank at rest
 * liegen bleibt (siehe src/data/db-vault.ts). Wiederherstellung manuell:
 * App beenden, Container mit dem lokalen Datenschlüssel entschlüsseln
 * (z. B. über einen Test-/Skriptaufruf von decryptFileToFileSync) und als
 * data.db ablegen.
 */
function backupBeforeMigration(db: BetterSqlite3.Database, dbFilePath: string, currentVersion: number): string | null {
	// Bei einer frischen Datenbank (Version 0) gibt es nichts zu sichern.
	if (currentVersion === 0 || !fs.existsSync(dbFilePath)) return null;
	db.pragma("wal_checkpoint(TRUNCATE)");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = `${dbFilePath}.pre-migrate-${stamp}.enc`;
	encryptFileToFileSync(dbFilePath, backupPath);
	return backupPath;
}

/**
 * Migriert die Datenbank automatisch beim Start auf die aktuelle Version.
 *
 * - Jeder Migrationsschritt läuft in einer eigenen Transaktion (SQLite-DDL
 *   ist transaktional) - schlägt ein Schritt fehl, wird er zurückgerollt und
 *   die Datenbank bleibt auf der letzten funktionierenden Version; das vorher
 *   angelegte Auto-Backup bleibt erhalten.
 * - Ist die Datenbank NEUER als die App, wird mit einer klaren Meldung
 *   abgebrochen (DatabaseTooNewError) statt mit undefiniertem Verhalten
 *   weiterzulaufen.
 */
export function migrateDatabase(db: BetterSqlite3.Database, dbFilePath: string): void {
	const current = getUserVersion(db);

	if (current > LATEST_SCHEMA_VERSION) {
		throw new DatabaseTooNewError(current, LATEST_SCHEMA_VERSION);
	}
	if (current === LATEST_SCHEMA_VERSION) return;

	const backupPath = backupBeforeMigration(db, dbFilePath, current);

	for (const migration of migrations) {
		if (migration.version <= current) continue;
		try {
			db.transaction(() => {
				db.exec(migration.up);
			})();
			// user_version bewusst erst NACH dem erfolgreichen Commit setzen:
			// schlägt die Migration fehl, bleibt die alte Version erhalten und
			// der nächste Start versucht den Schritt erneut.
			setUserVersion(db, migration.version);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Migration ${migration.version} (${migration.name}) fehlgeschlagen: ${reason}. ` +
					(backupPath
						? `Ein verschlüsseltes Backup der Datenbank liegt unter: ${backupPath}`
						: "Es existierte noch keine Datenbankdatei."),
				{ cause: error }
			);
		}
	}
}

/**
 * Baut die Datenbank um `steps` Versionen zurück (v. a. für
 * Migrations-Tests und Diagnose-Werkzeuge - nicht für den Produktivbetrieb
 * gedacht). Jeder Down-Schritt läuft in einer eigenen Transaktion.
 */
export function migrateDatabaseDown(db: BetterSqlite3.Database, steps = 1): void {
	for (let i = 0; i < steps; i++) {
		const current = getUserVersion(db);
		if (current === 0) return;
		const migration = migrations.find((m) => m.version === current);
		if (!migration) {
			throw new Error(`Keine Migration für Version ${current} gefunden - Downgrade nicht möglich.`);
		}
		db.transaction(() => {
			db.exec(migration.down);
		})();
		setUserVersion(db, current - 1);
	}
}
