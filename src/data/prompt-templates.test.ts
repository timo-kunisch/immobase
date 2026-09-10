import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import {
	countPromptTemplates,
	createPromptTemplate,
	deletePromptTemplate,
	listPromptTemplates,
	updatePromptTemplate,
} from "@/data/prompt-templates";
import { createUser } from "@/data/users";

/**
 * Repository-Tests für die eigenen Prompt-Vorlagen der Nutzer
 * (prompt_templates) gegen eine echte temporäre SQLite-Datenbank:
 * CRUD, strikte Trennung pro Nutzer (kein Lesen/Ändern/Löschen fremder
 * Vorlagen) und Kaskaden-Löschung mit dem Nutzerkonto.
 */

let testDir: string;

function createTestUser(email: string): string {
	return createUser({ email, passwordHash: "hash", role: "USER", isApproved: true }).id;
}

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-prompt-tpl-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("prompt_templates: eigene Vorlagen für den KI-Assistenten", () => {
	it("legt Vorlagen an und listet sie in Anlegereihenfolge", () => {
		const userId = createTestUser("nutzer@example.com");

		const first = createPromptTemplate(userId, { title: "Mieter-Import", content: "Importiere die Mieter aus dem Anhang." });
		const second = createPromptTemplate(userId, { title: "Rückstände", content: "Liste alle offenen Zahlungen." });

		expect(first.id).not.toBe(second.id);
		expect(first.createdAt).toBe(first.updatedAt);

		const templates = listPromptTemplates(userId);
		expect(templates.map((template) => template.title)).toEqual(["Mieter-Import", "Rückstände"]);
		expect(templates[0].content).toBe("Importiere die Mieter aus dem Anhang.");
		expect(countPromptTemplates(userId)).toBe(2);
	});

	it("aktualisiert Titel und Text und erneuert dabei updated_at", () => {
		const userId = createTestUser("nutzer@example.com");
		const template = createPromptTemplate(userId, { title: "Alt", content: "Alter Text" });

		const updated = updatePromptTemplate(userId, template.id, { title: "Neu", content: "Neuer Text" });
		expect(updated).not.toBeNull();
		expect(updated?.title).toBe("Neu");
		expect(updated?.content).toBe("Neuer Text");
		expect(updated?.createdAt).toBe(template.createdAt);
		expect(updated?.updatedAt >= template.updatedAt).toBe(true);

		expect(listPromptTemplates(userId)[0].title).toBe("Neu");
	});

	it("verweigert das Ändern und Löschen fremder Vorlagen", () => {
		const userA = createTestUser("a@example.com");
		const userB = createTestUser("b@example.com");
		const template = createPromptTemplate(userA, { title: "Von A", content: "Gehört A" });

		// Fremder Zugriff: Update/Delete laufen ins Leere, die Vorlage
		// bleibt unverändert (404 statt 403 auf Route-Ebene).
		expect(updatePromptTemplate(userB, template.id, { title: "Kaputt", content: "Kaputt" })).toBeNull();
		expect(deletePromptTemplate(userB, template.id)).toBe(false);

		const unchanged = listPromptTemplates(userA);
		expect(unchanged).toHaveLength(1);
		expect(unchanged[0].title).toBe("Von A");

		// Auch das Listen sieht nur die eigenen Vorlagen.
		expect(listPromptTemplates(userB)).toEqual([]);
		expect(countPromptTemplates(userB)).toBe(0);
	});

	it("löscht eigene Vorlagen und meldet unbekannte IDs", () => {
		const userId = createTestUser("nutzer@example.com");
		const template = createPromptTemplate(userId, { title: "Weg", content: "Wird gelöscht" });

		expect(deletePromptTemplate(userId, "unbekannte-id")).toBe(false);
		expect(deletePromptTemplate(userId, template.id)).toBe(true);
		expect(listPromptTemplates(userId)).toEqual([]);
	});

	it("löscht die Vorlagen per Kaskade mit dem Nutzerkonto", () => {
		const userId = createTestUser("nutzer@example.com");
		createPromptTemplate(userId, { title: "Notiz", content: "Text" });
		expect(countPromptTemplates(userId)).toBe(1);

		getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
		expect(listPromptTemplates(userId)).toEqual([]);
	});
});
