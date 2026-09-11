import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb } from "@/data/db";
import { createProperty } from "@/data/properties";
import { createTicketMessage, listTicketMessages } from "@/data/ticket-messages";
import { createTicket } from "@/data/tickets";
import { sendTicketEmail } from "@/lib/ticket-mailer";
import { buildTicketSubjectTag } from "@/lib/ticket-ref";

// Der SMTP-Versand (nodemailer) wird gemockt - getestet wird die fachliche
// Orchestrierung: Konfigurations-Sperre, Threading-Header und Ablage der
// ausgehenden Nachricht im Ticket-Verlauf.
const sendTicketReplyEmailMock = vi.fn(async () => ({ from: "verwaltung@example.com" }));
const isSmtpConfiguredMock = vi.fn(() => true);

vi.mock("@/lib/email/mailer", () => ({
	isSmtpConfigured: () => isSmtpConfiguredMock(),
	sendTicketReplyEmail: (options: unknown) => sendTicketReplyEmailMock(options),
}));

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-ticket-mailer-test-"));
	process.env.APP_DATA_DIR = testDir;
	sendTicketReplyEmailMock.mockClear();
	isSmtpConfiguredMock.mockReturnValue(true);
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function createTestTicket(): string {
	const property = createProperty({
		name: "Testobjekt",
		street: "Musterweg 1",
		zipCode: "12345",
		city: "Berlin",
		country: "Deutschland",
		notes: null,
	});
	return createTicket({
		propertyId: property.id,
		unitId: null,
		title: "Heizung defekt",
		description: null,
		status: "OPEN",
		resolvedAt: null,
	}).id;
}

describe("sendTicketEmail (src/lib/ticket-mailer.ts)", () => {
	it("sperrt den Versand ohne SMTP-Konfiguration", async () => {
		isSmtpConfiguredMock.mockReturnValue(false);
		const ticketId = createTestTicket();
		await expect(sendTicketEmail({ ticketId, to: "a@b.de", subject: "Re: x", body: "Hallo", authorUserId: null, authorEmail: null })).rejects.toThrow(
			/SMTP/
		);
		expect(sendTicketReplyEmailMock).not.toHaveBeenCalled();
		expect(listTicketMessages(ticketId)).toHaveLength(0);
	});

	it("versendet mit Threading-Headern und legt die Nachricht im Verlauf ab", async () => {
		const ticketId = createTestTicket();
		createTicketMessage({
			ticketId,
			direction: "INBOUND",
			messageId: "<in-1@example.com>",
			fromAddress: "Mieter <mieter@example.com>",
			subject: "Heizung defekt",
			createdAt: "2026-01-01T10:00:00.000Z",
		});
		createTicketMessage({ ticketId, direction: "NOTE", bodyText: "Intern", createdAt: "2026-01-02T10:00:00.000Z" });

		await sendTicketEmail({
			ticketId,
			to: "mieter@example.com",
			subject: "Re: Heizung defekt",
			body: "Der Handwerker kommt morgen.",
			// In der Test-DB existiert kein users-Datensatz (FK) - daher null
			// (entspricht dem MCP-Aufrufpfad ohne Nutzerkontext).
			authorUserId: null,
			authorEmail: "admin@example.com",
		});

		// Versand mit In-Reply-To auf die letzte eingehende E-Mail (die interne
		// Notiz dazwischen hat keine Message-ID und zählt nicht).
		expect(sendTicketReplyEmailMock).toHaveBeenCalledTimes(1);
		const sentOptions = sendTicketReplyEmailMock.mock.calls[0][0] as { inReplyTo?: string; references?: string[]; messageId: string };
		expect(sentOptions.inReplyTo).toBe("<in-1@example.com>");
		expect(sentOptions.references).toEqual([]);
		expect(sentOptions.messageId).toMatch(/^<.+@immobase\.local>$/);

		const timeline = listTicketMessages(ticketId);
		expect(timeline).toHaveLength(3);
		const outbound = timeline[2];
		expect(outbound.direction).toBe("OUTBOUND");
		expect(outbound.fromAddress).toBe("verwaltung@example.com");
		expect(outbound.toAddresses).toBe("mieter@example.com");
		// Der Betreff erhält automatisch die Ticket-Kennung (siehe eigener Test unten).
		expect(outbound.subject).toBe(`Re: Heizung defekt ${buildTicketSubjectTag(ticketId)}`);
		expect(outbound.authorEmail).toBe("admin@example.com");
		expect(outbound.messageId).toBe(sentOptions.messageId);
	});

	it("versendet ohne Threading-Header, wenn der Verlauf keine E-Mails enthält", async () => {
		const ticketId = createTestTicket();
		await sendTicketEmail({ ticketId, to: "a@b.de", subject: "Info", body: "Text", authorUserId: null, authorEmail: null });
		const sentOptions = sendTicketReplyEmailMock.mock.calls[0][0] as { inReplyTo?: string | null; references?: string[] };
		expect(sentOptions.inReplyTo).toBeNull();
		expect(sentOptions.references).toEqual([]);
	});

	it("hängt die Ticket-Kennung an den Betreff (Versand und Verlauf), aber nicht doppelt", async () => {
		const ticketId = createTestTicket();
		const tag = buildTicketSubjectTag(ticketId);

		// Ohne Tag im Betreff: wird angehängt.
		await sendTicketEmail({ ticketId, to: "a@b.de", subject: "Re: Heizung", body: "Text", authorUserId: null, authorEmail: null });
		let sentOptions = sendTicketReplyEmailMock.mock.calls[0][0] as { subject: string };
		expect(sentOptions.subject).toBe(`Re: Heizung ${tag}`);
		expect(listTicketMessages(ticketId)[0].subject).toBe(`Re: Heizung ${tag}`);

		// Mit bereits vorhandenem Tag: unverändert (idempotent).
		await sendTicketEmail({ ticketId, to: "a@b.de", subject: `Re: Heizung ${tag}`, body: "Text", authorUserId: null, authorEmail: null });
		sentOptions = sendTicketReplyEmailMock.mock.calls[1][0] as { subject: string };
		expect(sentOptions.subject).toBe(`Re: Heizung ${tag}`);
		expect(sentOptions.subject.match(/\[#/g)).toHaveLength(1);
	});
});
