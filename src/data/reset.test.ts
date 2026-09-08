import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import { LATEST_SCHEMA_VERSION } from "@/data/migrate";
import { createProperty, listProperties } from "@/data/properties";
import { resetApplicationData } from "@/data/reset";
import { countUsers } from "@/data/users";

/**
 * Vollständiger Anwendungs-Reset (src/data/reset.ts): löscht Datenbank,
 * Dateiablage, lokale Sicherungen und das Outbox-Log (Altlast älterer
 * Versionen), lässt aber Geräte-/Installationsdateien (settings.json,
 * .data-key, main.log) unangetastet und stellt anschließend sofort eine
 * frische, migrierte DB bereit.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-reset-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("resetApplicationData", () => {
	it("löscht alle App-Daten und stellt eine frische, migrierte Datenbank bereit", () => {
		// Bestand anlegen: Fachdaten in der DB + Dateien/Sicherungen/Logs im
		// Datenverzeichnis (Erzeugung NACH dem ersten getDb() über
		// createProperty, damit der Dummy-Container nicht vom Unlock-Pfad
		// als echter Container behandelt wird).
		createProperty({
			name: "Musterhaus",
			street: "Hauptstr. 1",
			zipCode: "12345",
			city: "Berlin",
			country: "Deutschland",
			notes: null,
		});
		expect(listProperties()).toHaveLength(1);

		const filesDir = path.join(testDir, "files", "documents");
		fs.mkdirSync(filesDir, { recursive: true });
		fs.writeFileSync(path.join(filesDir, "doc1.pdf"), "%PDF-fake");
		fs.writeFileSync(path.join(filesDir, "doc1.pdf.meta.json"), "{}");

		const backupsDir = path.join(testDir, "backups");
		fs.mkdirSync(backupsDir, { recursive: true });
		fs.writeFileSync(path.join(backupsDir, "pre-import-2026-01-01.zip.enc"), "dummy");

		const logsDir = path.join(testDir, "logs");
		fs.mkdirSync(logsDir, { recursive: true });
		fs.writeFileSync(path.join(logsDir, "outbox.log"), "E-Mail-Inhalt");
		fs.writeFileSync(path.join(logsDir, "main.log"), "Electron-Betriebslog");

		fs.writeFileSync(path.join(testDir, "data.db.enc"), "dummy-container");
		fs.writeFileSync(path.join(testDir, "data.db.pre-migrate-2026-01-01T00-00-00.enc"), "dummy");
		fs.writeFileSync(path.join(testDir, "data.db.dec-stale.tmp"), "dummy");

		const trashDir = path.join(testDir, ".import-trash-x");
		fs.mkdirSync(trashDir, { recursive: true });
		fs.writeFileSync(path.join(trashDir, "data.db"), "dummy");

		// Geräte-/Installationsdateien, die erhalten bleiben MÜSSEN.
		fs.writeFileSync(path.join(testDir, "settings.json"), "{}");
		fs.writeFileSync(path.join(testDir, ".data-key"), Buffer.from("a".repeat(32)).toString("base64"));

		resetApplicationData();

		// Datenbank frisch + vollständig migriert, Fachdaten entfernt.
		expect(listProperties()).toHaveLength(0);
		expect(countUsers()).toBe(0);
		expect(getDb().pragma("user_version", { simple: true })).toBe(LATEST_SCHEMA_VERSION);

		// Dateiablage, Sicherungen, Outbox-Log und Import-Temp-Reste entfernt.
		expect(fs.existsSync(path.join(testDir, "files"))).toBe(false);
		expect(fs.existsSync(backupsDir)).toBe(false);
		expect(fs.existsSync(path.join(logsDir, "outbox.log"))).toBe(false);
		expect(fs.existsSync(trashDir)).toBe(false);

		// Alle DB-bezogenen Altdateien entfernt (Container, Migrations-Backup,
		// Stale-Temp) - nur die frische neue DB (und ggf. deren WAL) bleibt.
		const remainingDbFiles = fs
			.readdirSync(testDir)
			.filter((name) => name.startsWith("data.db"))
			.filter((name) => name !== "data.db" && name !== "data.db-wal" && name !== "data.db-shm");
		expect(remainingDbFiles).toEqual([]);

		// Geräte-/Installationsdateien unangetastet.
		expect(fs.existsSync(path.join(testDir, "settings.json"))).toBe(true);
		expect(fs.existsSync(path.join(testDir, ".data-key"))).toBe(true);
		expect(fs.existsSync(path.join(logsDir, "main.log"))).toBe(true);
	});

	it("funktioniert auch auf einem leeren Datenverzeichnis (frische Installation)", () => {
		getDb(); // leere, migrierte DB anlegen
		expect(() => resetApplicationData()).not.toThrow();
		expect(countUsers()).toBe(0);
	});
});
