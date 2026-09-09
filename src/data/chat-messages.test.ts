import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appendChatMessages, clearChatMessages, listChatMessages } from "@/data/chat-messages";
import { closeDb, getDb } from "@/data/db";
import { createUser } from "@/data/users";

/**
 * Repository-Tests für den persistenten Chat-Verlauf des KI-Assistenten
 * (chat_messages) gegen eine echte temporäre SQLite-Datenbank:
 * Gesprächsreihenfolge, Trennung der Verläufe pro Nutzer, manuelles
 * Löschen und Kaskaden-Löschung mit dem Nutzerkonto.
 */

let testDir: string;

function createTestUser(email: string): string {
	return createUser({ email, passwordHash: "hash", role: "USER", isApproved: true }).id;
}

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-chat-msg-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("chat_messages: persistenter Verlauf des KI-Assistenten", () => {
	it("hält die Gesprächsreihenfolge auch bei identischen Zeitstempeln (Einfügereihenfolge)", () => {
		const userId = createTestUser("nutzer@example.com");

		appendChatMessages(userId, [
			{ role: "user", content: "Frage 1" },
			{ role: "assistant", content: "Antwort 1", toolCalls: [{ name: "properties_list", ok: true }] },
		]);
		appendChatMessages(userId, [
			{ role: "user", content: "Frage 2" },
			{ role: "assistant", content: "Antwort 2" },
		]);

		const messages = listChatMessages(userId);
		expect(messages.map((message) => [message.role, message.content])).toEqual([
			["user", "Frage 1"],
			["assistant", "Antwort 1"],
			["user", "Frage 2"],
			["assistant", "Antwort 2"],
		]);
		// Werkzeug-Liste wird als JSON gespeichert und beim Lesen gemappt;
		// Nachrichten ohne Werkzeuge liefern ein leeres Array.
		expect(messages[1].toolCalls).toEqual([{ name: "properties_list", ok: true }]);
		expect(messages[0].toolCalls).toEqual([]);
		expect(messages[2].toolCalls).toEqual([]);
	});

	it("trennt die Verläufe mehrerer Nutzer und löscht nur den eigenen", () => {
		const userA = createTestUser("a@example.com");
		const userB = createTestUser("b@example.com");

		appendChatMessages(userA, [{ role: "user", content: "Nachricht von A" }]);
		appendChatMessages(userB, [{ role: "user", content: "Nachricht von B" }]);

		expect(listChatMessages(userA).map((message) => message.content)).toEqual(["Nachricht von A"]);
		expect(listChatMessages(userB).map((message) => message.content)).toEqual(["Nachricht von B"]);

		clearChatMessages(userA);
		expect(listChatMessages(userA)).toEqual([]);
		expect(listChatMessages(userB)).toHaveLength(1);
	});

	it("löscht den Verlauf per Kaskade mit dem Nutzerkonto", () => {
		const userId = createTestUser("nutzer@example.com");
		appendChatMessages(userId, [{ role: "user", content: "Notiz" }]);
		expect(listChatMessages(userId)).toHaveLength(1);

		getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
		expect(listChatMessages(userId)).toEqual([]);
	});

	it("übersteht defekte tool_calls-JSON-Werte mit leerer Werkzeug-Liste", () => {
		const userId = createTestUser("nutzer@example.com");
		appendChatMessages(userId, [{ role: "assistant", content: "Antwort" }]);
		getDb().prepare("UPDATE chat_messages SET tool_calls = ? WHERE user_id = ?").run("{kein-json", userId);

		const messages = listChatMessages(userId);
		expect(messages).toHaveLength(1);
		expect(messages[0].toolCalls).toEqual([]);
	});
});
