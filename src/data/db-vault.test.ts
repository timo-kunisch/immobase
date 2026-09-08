import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sealDatabaseForShutdown } from "@/data/db";
import { getEncryptedDatabasePath, unlockDatabaseIfNeeded } from "@/data/db-vault";
import { getDatabaseFilePath } from "@/data/paths";
import { createProperty, listProperties } from "@/data/properties";
import { isEncryptedFile } from "@/lib/file-crypto";

/**
 * Tests für den Container-Verschlüsselungs-Zustandsautomaten der Datenbank
 * (src/data/db-vault.ts + Shutdown-Versiegelung in src/data/db.ts).
 * Die Shutdown-Hooks selbst werden in vitest bewusst nicht registriert (siehe
 * registerShutdownHooks); seal/lock/unlock werden gezielt aufgerufen.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-dbvault-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function dbPath(): string {
	return getDatabaseFilePath();
}

function encPath(): string {
	return getEncryptedDatabasePath(dbPath());
}

describe("DB-Container (unlock/lock)", () => {
	it("versiegelt beim Shutdown: data.db wird zu data.db.enc, Klartext inkl. WAL/SHM entfernt", () => {
		createProperty({ name: "Musterhaus", street: "Weg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
		expect(fs.existsSync(dbPath())).toBe(true);

		sealDatabaseForShutdown();

		expect(fs.existsSync(dbPath())).toBe(false);
		expect(fs.existsSync(dbPath() + "-wal")).toBe(false);
		expect(fs.existsSync(dbPath() + "-shm")).toBe(false);
		expect(fs.existsSync(encPath())).toBe(true);
		expect(isEncryptedFile(encPath())).toBe(true);
		// Kein SQLite-Header im Container (kein Klartext).
		expect(fs.readFileSync(encPath()).subarray(0, 15).toString("utf8")).not.toBe("SQLite format 3");
	});

	it("entsperrt beim nächsten getDb(): Daten sind vollständig wieder da", () => {
		createProperty({ name: "Musterhaus", street: "Weg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
		sealDatabaseForShutdown();

		// "Neustart": getDb entschlüsselt den Container transparent.
		const names = listProperties().map((p) => p.name);
		expect(names).toEqual(["Musterhaus"]);
		expect(fs.existsSync(dbPath())).toBe(true);
		expect(fs.existsSync(encPath())).toBe(false);
	});

	it("Roundtrip über mehrere Versiegelungs-/Entsperr-Zyklen", () => {
		createProperty({ name: "Haus A", street: "Weg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
		sealDatabaseForShutdown();
		createProperty({ name: "Haus B", street: "Weg 2", zipCode: "54321", city: "Hamburg", country: "Deutschland", notes: null });
		sealDatabaseForShutdown();

		expect(listProperties().map((p) => p.name).sort()).toEqual(["Haus A", "Haus B"]);
	});

	it("ist idempotent: seal ohne geöffnete DB / ohne Klartext-Datei ist ein No-Op", () => {
		expect(() => sealDatabaseForShutdown()).not.toThrow();
		expect(fs.existsSync(encPath())).toBe(false);
	});

	it("unlock ohne Container ist ein No-Op (Neuinstallation/Klartext)", () => {
		unlockDatabaseIfNeeded(dbPath());
		expect(fs.existsSync(dbPath())).toBe(false);
		expect(fs.existsSync(encPath())).toBe(false);
	});

	it("Crash-Konsistenz: existieren Container UND Klartext, gewinnt der Klartext (Container wird verworfen)", () => {
		createProperty({ name: "Musterhaus", street: "Weg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
		sealDatabaseForShutdown();

		// Beide Dateien herstellen (Zustand nach Absturz zwischen den atomaren
		// Schritten): Container-Bytes sichern, entsperren (legt Klartext an und
		// löscht den Container), dann Container-Bytes zurückschreiben.
		const containerBytes = fs.readFileSync(encPath());
		closeDb();
		unlockDatabaseIfNeeded(dbPath());
		fs.writeFileSync(encPath(), containerBytes);
		expect(fs.existsSync(dbPath())).toBe(true);
		expect(fs.existsSync(encPath())).toBe(true);

		unlockDatabaseIfNeeded(dbPath());

		expect(fs.existsSync(dbPath())).toBe(true);
		expect(fs.existsSync(encPath())).toBe(false);
		expect(listProperties().map((p) => p.name)).toEqual(["Musterhaus"]);
	});

	it("wirft bei beschädigtem Container einen klaren Fehler und löscht ihn NICHT", () => {
		createProperty({ name: "Musterhaus", street: "Weg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
		sealDatabaseForShutdown();

		// Container beschädigen (Ciphertext kippen).
		const raw = fs.readFileSync(encPath());
		raw[raw.length - 40] ^= 0xff;
		fs.writeFileSync(encPath(), raw);

		expect(() => unlockDatabaseIfNeeded(dbPath())).toThrow(/nicht entschlüsselt werden/);
		// Container bleibt für Rettungsversuche erhalten, kein Klartext-Neustart.
		expect(fs.existsSync(encPath())).toBe(true);
		expect(fs.existsSync(dbPath())).toBe(false);
	});

	it("räumt verwaiste Temp-Dateien beim Entsperren auf", () => {
		createProperty({ name: "Musterhaus", street: "Weg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
		sealDatabaseForShutdown();

		fs.writeFileSync(dbPath() + ".dec-irgendwas.tmp", "rest");
		fs.writeFileSync(encPath() + ".enc-irgendwas.tmp", "rest");

		unlockDatabaseIfNeeded(dbPath());
		expect(fs.existsSync(dbPath() + ".dec-irgendwas.tmp")).toBe(false);
		expect(fs.existsSync(encPath() + ".enc-irgendwas.tmp")).toBe(false);
	});
});
