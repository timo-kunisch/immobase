import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/data/db";
import { getImapSyncState, listImapSyncStates, resetImapSyncState, upsertImapSyncState } from "@/data/imap-sync-state";
import { createProperty } from "@/data/properties";
import {
	convertMessageToTicket,
	createTicketMessage,
	deleteMailboxMessage,
	deleteTicketNote,
	findLinkedTicketIdByMessageIds,
	getTicketMessage,
	importInboundMessage,
	linkMessageToTicket,
	listMailboxMessages,
	listTicketMessageCounts,
	listTicketMessages,
	unlinkMessageFromTicket,
	updateTicketNote,
} from "@/data/ticket-messages";
import { createTicket, deleteTicket, findTicketIdByRef, getTicket } from "@/data/tickets";
import { buildTicketSubjectTag } from "@/lib/ticket-ref";

/**
 * Repository-Tests für die Ticket-Kommunikation (ticket_messages) und den
 * IMAP-Abgleichstand (imap_sync_state) gegen eine echte temporäre
 * SQLite-Datenbank: Postfach-Listing, Zuordnung/Umwandlung, Dedup des
 * IMAP-Imports, Threading und Verlauf-Reihenfolge.
 */

let testDir: string;

function createTestProperty(): string {
	return createProperty({ name: "Testobjekt", street: "Musterweg 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null }).id;
}

function createTestTicket(propertyId: string): string {
	return createTicket({
		propertyId,
		unitId: null,
		title: "Heizung defekt",
		description: null,
		status: "OPEN",
		resolvedAt: null,
	}).id;
}

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-ticket-msg-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("ticket_messages: Postfach und Verknüpfung", () => {
	it("listet importierte E-Mails im Postfach und ordnet sie einem Ticket zu", () => {
		const { message, inserted } = importInboundMessage({
			messageId: "<m1@example.com>",
			imapFolder: "INBOX",
			imapUid: 1,
			fromAddress: "Mieter <mieter@example.com>",
			subject: "Wasserhahn tropft",
			bodyText: "In der Küche tropft der Wasserhahn.",
		});
		expect(inserted).toBe(true);
		expect(message.direction).toBe("INBOUND");
		expect(message.ticketId).toBeNull();

		// Im Postfach sichtbar, in keinem Ticket-Verlauf.
		expect(listMailboxMessages().map((m) => m.id)).toEqual([message.id]);

		const ticketId = createTestTicket(createTestProperty());
		linkMessageToTicket(message.id, ticketId);

		expect(listMailboxMessages()).toHaveLength(0);
		const timeline = listTicketMessages(ticketId);
		expect(timeline).toHaveLength(1);
		expect(timeline[0].subject).toBe("Wasserhahn tropft");
	});

	it("dedupliziert den IMAP-Import über Ordner + UID", () => {
		const first = importInboundMessage({ imapFolder: "INBOX", imapUid: 7, subject: "Erste" });
		expect(first.inserted).toBe(true);
		// Gleiche UID im selben Ordner -> kein erneuter Import.
		const second = importInboundMessage({ imapFolder: "INBOX", imapUid: 7, subject: "Erste" });
		expect(second.inserted).toBe(false);
		expect(listMailboxMessages()).toHaveLength(1);
		// Gleiche UID in einem anderen Ordner ist eine andere Nachricht.
		const third = importInboundMessage({ imapFolder: "Archiv", imapUid: 7, subject: "Erste" });
		expect(third.inserted).toBe(true);
		expect(listMailboxMessages()).toHaveLength(2);
	});

	it("wandelt eine Postfach-E-Mail atomar in ein Ticket um", () => {
		const propertyId = createTestProperty();
		const { message } = importInboundMessage({ imapFolder: "INBOX", imapUid: 3, subject: "Schimmel im Bad", bodyText: "Bitte prüfen." });

		const ticket = convertMessageToTicket(message.id, {
			propertyId,
			unitId: null,
			title: "Schimmel im Bad",
			description: "Bitte prüfen.",
			status: "OPEN",
			resolvedAt: null,
		});

		expect(getTicket(ticket.id)?.title).toBe("Schimmel im Bad");
		expect(getTicketMessage(message.id)?.ticketId).toBe(ticket.id);
		expect(listMailboxMessages()).toHaveLength(0);
		expect(listTicketMessages(ticket.id)).toHaveLength(1);
	});

	it("löscht nur unverknüpfte Postfach-E-Mails, keine Ticket-Verläufe", () => {
		const propertyId = createTestProperty();
		const { message } = importInboundMessage({ imapFolder: "INBOX", imapUid: 11, subject: "Lösch mich" });
		deleteMailboxMessage(message.id);
		expect(getTicketMessage(message.id)).toBeNull();

		// Verknüpfte Nachrichten bleiben von deleteMailboxMessage unberührt.
		const linked = importInboundMessage({ imapFolder: "INBOX", imapUid: 12, subject: "Behalten" }).message;
		const ticketId = createTestTicket(propertyId);
		linkMessageToTicket(linked.id, ticketId);
		deleteMailboxMessage(linked.id);
		expect(getTicketMessage(linked.id)).not.toBeNull();
	});

	it("findet Tickets über Threading-Verweise (In-Reply-To/References)", () => {
		const ticketId = createTestTicket(createTestProperty());
		// Ausgehende Ticket-E-Mail mit eigener Message-ID.
		createTicketMessage({ ticketId, direction: "OUTBOUND", messageId: "<out-1@immobase.local>", toAddresses: "mieter@example.com" });

		expect(findLinkedTicketIdByMessageIds(["<out-1@immobase.local>"])).toBe(ticketId);
		expect(findLinkedTicketIdByMessageIds(["<unbekannt@example.com>"])).toBeNull();
		// Unverknüpfte Postfach-Nachrichten lösen kein Threading aus.
		importInboundMessage({ imapFolder: "INBOX", imapUid: 21, messageId: "<free@example.com>" });
		expect(findLinkedTicketIdByMessageIds(["<free@example.com>"])).toBeNull();
		expect(findLinkedTicketIdByMessageIds([])).toBeNull();
	});

	it("löst die Zuordnung eingehender E-Mails wieder auf (zurück ins Postfach)", () => {
		const ticketId = createTestTicket(createTestProperty());
		const { message } = importInboundMessage({ imapFolder: "INBOX", imapUid: 31, subject: "Falsch zugeordnet" });
		linkMessageToTicket(message.id, ticketId);
		expect(listTicketMessages(ticketId)).toHaveLength(1);
		expect(listMailboxMessages()).toHaveLength(0);

		unlinkMessageFromTicket(message.id);

		expect(getTicketMessage(message.id)?.ticketId).toBeNull();
		expect(listTicketMessages(ticketId)).toHaveLength(0);
		expect(listMailboxMessages().map((m) => m.id)).toEqual([message.id]);
	});

	it("lässt ausgehende E-Mails und Notizen beim Entknüpfen unberührt", () => {
		const ticketId = createTestTicket(createTestProperty());
		const outbound = createTicketMessage({ ticketId, direction: "OUTBOUND", subject: "Antwort" });
		const note = createTicketMessage({ ticketId, direction: "NOTE", bodyText: "Intern" });

		unlinkMessageFromTicket(outbound.id);
		unlinkMessageFromTicket(note.id);

		expect(getTicketMessage(outbound.id)?.ticketId).toBe(ticketId);
		expect(getTicketMessage(note.id)?.ticketId).toBe(ticketId);
	});

	it("ordnet eine E-Mail einem anderen Ticket neu zu", () => {
		const propertyId = createTestProperty();
		const firstTicketId = createTestTicket(propertyId);
		const secondTicketId = createTestTicket(propertyId);
		const { message } = importInboundMessage({ imapFolder: "INBOX", imapUid: 32, subject: "Umziehen" });
		linkMessageToTicket(message.id, firstTicketId);

		linkMessageToTicket(message.id, secondTicketId);

		expect(getTicketMessage(message.id)?.ticketId).toBe(secondTicketId);
		expect(listTicketMessages(firstTicketId)).toHaveLength(0);
		expect(listTicketMessages(secondTicketId)).toHaveLength(1);
	});

	it("löst Ticket-Kennungen aus dem Betreff eindeutig auf (findTicketIdByRef)", () => {
		const ticketId = createTestTicket(createTestProperty());
		const ref = buildTicketSubjectTag(ticketId).slice(2, 10); // „[#a3f8b2c1]" -> „a3f8b2c1"

		expect(findTicketIdByRef(ref)).toBe(ticketId);
		// Unbekannte/ungültige Kennungen liefern keinen Treffer.
		expect(findTicketIdByRef("00000000")).toBeNull();
		expect(findTicketIdByRef("xyz")).toBeNull();
	});

	it("ordnet den Verlauf chronologisch und zählt Einträge je Ticket", () => {
		const ticketId = createTestTicket(createTestProperty());
		createTicketMessage({ ticketId, direction: "INBOUND", subject: "Alt", createdAt: "2026-01-01T10:00:00.000Z" });
		createTicketMessage({ ticketId, direction: "NOTE", bodyText: "Notiz", authorEmail: "admin@example.com", createdAt: "2026-01-03T10:00:00.000Z" });
		createTicketMessage({ ticketId, direction: "OUTBOUND", subject: "Neu", createdAt: "2026-01-02T10:00:00.000Z" });

		const timeline = listTicketMessages(ticketId);
		expect(timeline.map((m) => m.direction)).toEqual(["INBOUND", "OUTBOUND", "NOTE"]);

		const counts = listTicketMessageCounts();
		expect(counts[ticketId]).toBe(3);
	});

	it("löscht den Verlauf mit dem Ticket (ON DELETE CASCADE)", () => {
		const ticketId = createTestTicket(createTestProperty());
		createTicketMessage({ ticketId, direction: "NOTE", bodyText: "Intern" });
		deleteTicket(ticketId);
		expect(listTicketMessages(ticketId)).toHaveLength(0);
	});

	it("bearbeitet nur interne Notizen, keine E-Mail-Einträge", () => {
		const ticketId = createTestTicket(createTestProperty());
		const note = createTicketMessage({ ticketId, direction: "NOTE", bodyText: "Ursprünglich" });
		const outbound = createTicketMessage({ ticketId, direction: "OUTBOUND", subject: "Antwort", bodyText: "Gesendet" });

		updateTicketNote(note.id, "Überarbeitet");
		expect(getTicketMessage(note.id)?.bodyText).toBe("Überarbeitet");

		// Ausgehende E-Mails bleiben vom Notiz-Update unberührt.
		updateTicketNote(outbound.id, "Manipulation");
		expect(getTicketMessage(outbound.id)?.bodyText).toBe("Gesendet");
	});

	it("löscht nur interne Notizen, keine E-Mail-Einträge", () => {
		const ticketId = createTestTicket(createTestProperty());
		const note = createTicketMessage({ ticketId, direction: "NOTE", bodyText: "Weg damit" });
		const outbound = createTicketMessage({ ticketId, direction: "OUTBOUND", subject: "Antwort" });

		deleteTicketNote(note.id);
		expect(getTicketMessage(note.id)).toBeNull();
		expect(listTicketMessages(ticketId)).toHaveLength(1);

		// Ausgehende E-Mails bleiben vom Notiz-Löschen unberührt.
		deleteTicketNote(outbound.id);
		expect(getTicketMessage(outbound.id)).not.toBeNull();
	});
});

describe("imap_sync_state", () => {
	it("speichert und aktualisiert den Abgleichstand je Ordner", () => {
		expect(getImapSyncState("INBOX")).toBeNull();

		upsertImapSyncState({ folder: "INBOX", uidValidity: 42, lastUid: 100, lastError: null, lastNewCount: 3 });
		let state = getImapSyncState("INBOX");
		expect(state?.uidValidity).toBe(42);
		expect(state?.lastUid).toBe(100);
		expect(state?.lastNewCount).toBe(3);
		expect(state?.lastError).toBeNull();
		expect(state?.lastSyncAt).toBeTruthy();

		upsertImapSyncState({ folder: "INBOX", uidValidity: 42, lastUid: 150, lastError: "timeout", lastNewCount: null });
		state = getImapSyncState("INBOX");
		expect(state?.lastUid).toBe(150);
		expect(state?.lastError).toBe("timeout");

		expect(listImapSyncStates()).toHaveLength(1);
	});

	it("setzt bei UIDVALIDITY-Wechsel die UID zurück, behält aber den Ordner", () => {
		upsertImapSyncState({ folder: "INBOX", uidValidity: 1, lastUid: 500, lastError: null, lastNewCount: 0 });
		resetImapSyncState("INBOX", 2);
		const state = getImapSyncState("INBOX");
		expect(state?.uidValidity).toBe(2);
		expect(state?.lastUid).toBe(0);
	});
});
