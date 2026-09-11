import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import {
	DatabaseTooNewError,
	LATEST_SCHEMA_VERSION,
	migrateDatabase,
	migrateDatabaseDown,
} from "@/data/migrate";
import { migrations } from "@/data/migrations";

/**
 * Tests für den Migrations-Mechanismus (PRAGMA user_version):
 * - frische DB wird auf die neueste Version migriert
 * - vor/zurück (up/down) zwischen den Versionen
 * - Auto-Backup wird vor einer Migration einer bestehenden DB angelegt
 * - eine DB mit NEUERER Version wird mit klarer Meldung abgelehnt
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-migrate-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function openRaw(): BetterSqlite3.Database {
	return new BetterSqlite3(path.join(testDir, "data.db"));
}

function tableNames(db: BetterSqlite3.Database): string[] {
	const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
		name: string;
	}[];
	return rows.map((r) => r.name);
}

function columnNames(db: BetterSqlite3.Database, table: string): string[] {
	const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	return rows.map((r) => r.name);
}

describe("migrateDatabase", () => {
	it("migriert eine frische Datenbank auf die neueste Version", () => {
		const db = getDb();
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);
		const tables = tableNames(db);
		// Stichproben aus beiden fachlichen Blöcken + System-Tabellen
		expect(tables).toContain("properties");
		expect(tables).toContain("leases");
		expect(tables).toContain("tenant_statements");
		expect(tables).toContain("hoas");
		expect(tables).toContain("owner_resolutions");
		expect(tables).toContain("users");
		expect(tables).toContain("app_settings");
	});

	it("ist idempotent (kein erneutes Anwenden bei aktueller Version)", () => {
		getDb();
		closeDb();
		// Zweiter Start: darf nicht fehlschlagen und keine Backup-Datei anlegen
		const db = getDb();
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);
		const backups = fs.readdirSync(testDir).filter((f) => f.includes("pre-migrate"));
		expect(backups).toHaveLength(0);
	});

	it("migriert eine ältere DB schrittweise und legt vorher ein Auto-Backup an", () => {
		// Zustand "Version 1" herstellen: nur init-Migration anwenden
		const raw = openRaw();
		raw.exec(migrations[0].up);
		raw.pragma("user_version = 1");
		raw.prepare(
			"INSERT INTO properties (id, name, street, zip_code, city, country, created_at, updated_at) VALUES ('p1', 'Alt', 'Str. 1', '12345', 'Stadt', 'Deutschland', '2026-01-01', '2026-01-01')"
		).run();
		raw.close();

		const db = getDb(); // läuft durch migrateDatabase: 1 -> LATEST
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);
		expect(tableNames(db)).toContain("app_settings");

		const backups = fs.readdirSync(testDir).filter((f) => f.includes("pre-migrate"));
		expect(backups).toHaveLength(1);
		// Das Auto-Backup liegt verschlüsselt vor (kein Klartext-Residuum der DB).
		expect(backups[0]).toMatch(/\.enc$/);
		expect(fs.readFileSync(path.join(testDir, backups[0])).subarray(0, 20).toString("utf8")).toBe("IMMOBASE-FILE-ENC:v1");
	});

	it("lehnt eine Datenbank ab, die neuer ist als die App", () => {
		const raw = openRaw();
		raw.pragma(`user_version = ${LATEST_SCHEMA_VERSION + 1}`);
		raw.close();

		const db = openRaw();
		expect(() => migrateDatabase(db, path.join(testDir, "data.db"))).toThrow(DatabaseTooNewError);
		db.close();
	});

	it("0015: erhält Ticket-Verlauf beim Neubau und erlaubt Tickets ohne Liegenschaft", () => {
		// DB auf den Stand VOR 0015 bringen (Migrationen 1..14) und echte
		// Tickets samt Kommunikationsverlauf befüllen.
		const raw = openRaw();
		for (const migration of migrations) {
			if (migration.version >= 15) continue;
			raw.exec(migration.up);
		}
		raw.pragma("user_version = 14");
		raw.pragma("foreign_keys = ON");
		raw
			.prepare(
				"INSERT INTO properties (id, name, street, zip_code, city, country, created_at, updated_at) VALUES ('p1', 'Haus 1', 'Str. 1', '12345', 'Stadt', 'Deutschland', '2026-01-01', '2026-01-01')"
			)
			.run();
		raw
			.prepare(
				"INSERT INTO tickets (id, property_id, title, status, created_at, updated_at) VALUES ('t1', 'p1', 'Heizung defekt', 'OPEN', '2026-01-02', '2026-01-02')"
			)
			.run();
		raw
			.prepare(
				"INSERT INTO ticket_messages (id, ticket_id, direction, body_text, created_at) VALUES ('m1', 't1', 'NOTE', 'Erste Rückmeldung', '2026-01-03')"
			)
			.run();
		raw.close();

		// Migration 0015: Der Tabellen-Neubau darf den Verlauf NICHT kaskadieren
		// (ticket_messages zeigt mit ON DELETE CASCADE auf tickets).
		const db = getDb();
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);
		expect(db.prepare("SELECT COUNT(*) c FROM tickets").get().c).toBe(1);
		expect(db.prepare("SELECT COUNT(*) c FROM ticket_messages").get().c).toBe(1);

		// Tickets ohne Liegenschaft sind nach 0015 erlaubt ...
		db.prepare("INSERT INTO tickets (id, title, status, created_at, updated_at) VALUES ('t2', 'Organisatorisch', 'OPEN', '2026-01-04', '2026-01-04')").run();

		// ... das Down schlägt dafür bewusst mit Constraint-Fehler fehl und
		// lässt die Datenbank auf Version 15 stehen (0018, 0017 und 0016 wurden
		// zuvor erfolgreich zurückgenommen, 0015 bleibt unverändert erhalten).
		expect(() => migrateDatabaseDown(db, 4)).toThrow();
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION - 3);
		expect(db.prepare("SELECT COUNT(*) c FROM ticket_messages").get().c).toBe(1);
	});
});

describe("migrateDatabaseDown", () => {
	it("kann die letzte Migration zurücknehmen (vor/zurück)", () => {
		const db = getDb();
		// Stichprobe = Änderung der jeweils letzten Migration (derzeit 0018:
		// ausgeblendete E-Mails - Spalte ticket_messages.hidden fällt weg).
		expect(columnNames(db, "ticket_messages")).toContain("hidden");

		migrateDatabaseDown(db, 1);
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION - 1);
		expect(columnNames(db, "ticket_messages")).not.toContain("hidden");

		// ...und wieder hochmigrieren
		migrateDatabase(db, path.join(testDir, "data.db"));
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);
		expect(columnNames(db, "ticket_messages")).toContain("hidden");
	});

	it("kann vollständig zurück auf Version 0 (leere Datenbank)", () => {
		const db = getDb();
		migrateDatabaseDown(db, LATEST_SCHEMA_VERSION);
		expect(db.pragma("user_version", { simple: true })).toBe(0);
		expect(tableNames(db)).toHaveLength(0);

		migrateDatabase(db, path.join(testDir, "data.db"));
		expect(db.pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);
		expect(tableNames(db).length).toBeGreaterThan(30);
	});
});
