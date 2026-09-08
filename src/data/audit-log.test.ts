import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/data/db";
import { countAuditLogEntries, createAuditLogEntry, listAuditLogCategories, listAuditLogEntriesPage } from "@/data/audit-log";
import { createUser } from "@/data/users";

/**
 * Tests für das Aktivitätsprotokoll (Repository src/data/audit-log.ts):
 * Insert-Mapping, Filter, Sortierung und Pagination gegen eine echte
 * (temporäre) better-sqlite3-Datenbank.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-audit-log-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function seedUser(email = "admin@example.com") {
	return createUser({ email, passwordHash: "hash", role: "ADMIN", isApproved: true });
}

describe("audit-log", () => {
	it("Insert-Roundtrip inkl. Default entityId = null", () => {
		const user = seedUser();
		const entry = createAuditLogEntry({
			userId: user.id,
			userEmail: user.email,
			action: "CREATE",
			category: "mieter",
			description: `Mieter „Max Mustermann“ angelegt`,
		});

		expect(entry.entityId).toBeNull();
		expect(entry.createdAt).toBeTruthy();

		const listed = listAuditLogEntriesPage({}, 50, 0);
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({
			id: entry.id,
			userId: user.id,
			userEmail: user.email,
			action: "CREATE",
			category: "mieter",
			description: `Mieter „Max Mustermann“ angelegt`,
			entityId: null,
		});
		expect(countAuditLogEntries()).toBe(1);
	});

	it("Sortierung: neueste zuerst, Pagination via LIMIT/OFFSET", () => {
		const user = seedUser();
		for (let index = 0; index < 5; index += 1) {
			createAuditLogEntry({
				userId: user.id,
				userEmail: user.email,
				action: "UPDATE",
				category: "einheiten",
				description: `Eintrag ${index}`,
			});
		}

		const page1 = listAuditLogEntriesPage({}, 2, 0);
		const page2 = listAuditLogEntriesPage({}, 2, 2);
		const page3 = listAuditLogEntriesPage({}, 2, 4);
		expect(page1.map((entry) => entry.description)).toEqual(["Eintrag 4", "Eintrag 3"]);
		expect(page2.map((entry) => entry.description)).toEqual(["Eintrag 2", "Eintrag 1"]);
		expect(page3.map((entry) => entry.description)).toEqual(["Eintrag 0"]);
		expect(countAuditLogEntries()).toBe(5);
	});

	it("Filter nach Nutzer und Kategorie (UND-verknüpft)", () => {
		const admin = seedUser();
		const other = seedUser("nutzer@example.com");
		createAuditLogEntry({ userId: admin.id, userEmail: admin.email, action: "CREATE", category: "mieter", description: "a" });
		createAuditLogEntry({ userId: admin.id, userEmail: admin.email, action: "DELETE", category: "tickets", description: "b" });
		createAuditLogEntry({ userId: other.id, userEmail: other.email, action: "CREATE", category: "mieter", description: "c" });

		expect(listAuditLogEntriesPage({ userId: admin.id }, 50, 0).map((entry) => entry.description)).toEqual(["b", "a"]);
		expect(listAuditLogEntriesPage({ category: "mieter" }, 50, 0).map((entry) => entry.description)).toEqual(["c", "a"]);
		const combined = listAuditLogEntriesPage({ userId: admin.id, category: "mieter" }, 50, 0);
		expect(combined.map((entry) => entry.description)).toEqual(["a"]);
		expect(countAuditLogEntries({ userId: admin.id, category: "mieter" })).toBe(1);
	});

	it("listAuditLogCategories liefert distinct sortierte Kategorien", () => {
		const user = seedUser();
		createAuditLogEntry({ userId: user.id, userEmail: user.email, action: "CREATE", category: "mieter", description: "a" });
		createAuditLogEntry({ userId: user.id, userEmail: user.email, action: "CREATE", category: "mieter", description: "b" });
		createAuditLogEntry({ userId: user.id, userEmail: user.email, action: "LOGIN", category: "auth", description: "c" });

		expect(listAuditLogCategories()).toEqual(["auth", "mieter"]);
	});
});
