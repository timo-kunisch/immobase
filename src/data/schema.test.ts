import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";

/**
 * Konsistenz-Test: src/data/schema.sql ist die generierte Referenz des
 * Gesamtschemas und muss immer zum Stand der Migrationen passen. Bei einer
 * neuen Migration schlägt dieser Test fehl, bis schema.sql neu generiert
 * wurde (siehe README: `npm run schema:dump`).
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-schema-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("schema.sql", () => {
	it("entspricht exakt dem aus den Migrationen erzeugten Schema", () => {
		const db = getDb();
		const rows = db
			.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name")
			.all() as { sql: string }[];
		const expected =
			"-- Referenz-Gesamtschema von ImmoBase (generiert aus den Migrationen unter\n-- src/data/migrations/ - NICHT händisch editieren; Quelle der Wahrheit sind die Migrationen.\n-- Konsistenz wird durch src/data/schema.test.ts sichergestellt.)\n\n" +
			rows.map((r) => r.sql + ";").join("\n\n") +
			"\n";
		const actual = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
		expect(actual).toBe(expected);
	});
});
