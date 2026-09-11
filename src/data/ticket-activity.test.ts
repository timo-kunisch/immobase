import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listTicketActivity, logTicketActivity } from "@/data/ticket-activity";
import { closeDb, getDb } from "@/data/db";
import { createTicket, deleteTicket } from "@/data/tickets";
import { createUser } from "@/data/users";

/**
 * Repository-Tests für den Ticket-Aktivitätsverlauf (ticket_activity_log)
 * gegen eine echte temporäre SQLite-Datenbank: Protokollierung mit
 * Werten/Akteur/Kontext, chronologische Reihenfolge inkl. Einreihungsfolge
 * bei gleichem Zeitpunkt, Trennung je Ticket, Kaskade mit dem Ticket und
 * die Akteur-Referenz (ON DELETE SET NULL, E-Mail bleibt denormalisiert
 * lesbar).
 */

let testDir: string;

function createTestTicket(): string {
	return createTicket({
		propertyId: null,
		unitId: null,
		title: "Heizung defekt",
		description: null,
		status: "OPEN",
		resolvedAt: null,
	}).id;
}

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-ticket-activity-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("ticket_activity_log", () => {
	it("protokolliert eine Aktion mit Werten, Akteur und Kontext", () => {
		const ticketId = createTestTicket();
		logTicketActivity({
			ticketId,
			action: "STATUS_CHANGED",
			fromValue: "OPEN",
			toValue: "IN_PROGRESS",
			detail: null,
			actorUserId: null,
			actorEmail: "verwalter@example.com",
		});

		const entries = listTicketActivity(ticketId);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			ticketId,
			action: "STATUS_CHANGED",
			fromValue: "OPEN",
			toValue: "IN_PROGRESS",
			detail: null,
			actorUserId: null,
			actorEmail: "verwalter@example.com",
		});
		expect(entries[0].id).toBeTruthy();
		expect(entries[0].createdAt).toBeTruthy();
	});

	it("listet chronologisch und hält bei gleichem Zeitpunkt die Einreihungsfolge", () => {
		const ticketId = createTestTicket();
		const at = "2026-09-12T10:00:00.000Z";
		// Gleicher Zeitpunkt (z. B. UPDATED + STATUS_CHANGED aus einer
		// Bearbeitung): Reihenfolge der Einreihung bleibt erhalten.
		logTicketActivity({ ticketId, action: "UPDATED", createdAt: at });
		logTicketActivity({ ticketId, action: "STATUS_CHANGED", fromValue: "OPEN", toValue: "DONE", createdAt: at });
		logTicketActivity({ ticketId, action: "STATUS_CHANGED", fromValue: "IN_PROGRESS", toValue: "OPEN", createdAt: "2026-09-10T09:00:00.000Z" });
		// System-Aktion ohne Akteur (MCP-Werkzeuge).
		logTicketActivity({ ticketId, action: "NOTE_DELETED", createdAt: "2026-09-12T11:30:00.000Z" });

		const entries = listTicketActivity(ticketId);
		expect(entries.map((entry) => entry.action)).toEqual(["STATUS_CHANGED", "UPDATED", "STATUS_CHANGED", "NOTE_DELETED"]);
		expect(entries[3].actorUserId).toBeNull();
		expect(entries[3].actorEmail).toBeNull();
	});

	it("trennt die Verläufe je Ticket", () => {
		const first = createTestTicket();
		const second = createTestTicket();
		logTicketActivity({ ticketId: first, action: "CREATED", toValue: "OPEN" });
		logTicketActivity({ ticketId: second, action: "CREATED", toValue: "OPEN" });

		expect(listTicketActivity(first)).toHaveLength(1);
		expect(listTicketActivity(second)).toHaveLength(1);
	});

	it("verweigert Einträge für unbekannte Tickets (Fremdschlüssel)", () => {
		expect(() => logTicketActivity({ ticketId: "gibts-nicht", action: "CREATED" })).toThrow();
	});

	it("löscht den Verlauf mit dem Ticket mit (ON DELETE CASCADE)", () => {
		const ticketId = createTestTicket();
		logTicketActivity({ ticketId, action: "CREATED", toValue: "OPEN" });
		expect(listTicketActivity(ticketId)).toHaveLength(1);

		deleteTicket(ticketId);
		expect(listTicketActivity(ticketId)).toHaveLength(0);
	});

	it("behält den Eintrag nach Löschung des Nutzerkontos und nullt nur die Referenz (ON DELETE SET NULL)", () => {
		const user = createUser({ email: "alt@example.com", passwordHash: "hash", role: "USER", isApproved: true });
		const ticketId = createTestTicket();
		logTicketActivity({ ticketId, action: "NOTE_DELETED", actorUserId: user.id, actorEmail: user.email });

		getDb().prepare("DELETE FROM users WHERE id = ?").run(user.id);

		const entries = listTicketActivity(ticketId);
		expect(entries).toHaveLength(1);
		expect(entries[0].actorUserId).toBeNull();
		// E-Mail bewusst denormalisiert - bleibt auch ohne Konto lesbar.
		expect(entries[0].actorEmail).toBe("alt@example.com");
	});
});
