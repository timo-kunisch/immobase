import "server-only";

import { createTicketMessage, listTicketMessages } from "@/data/ticket-messages";
import { newId } from "@/data/helpers";

import { isSmtpConfigured, sendTicketReplyEmail } from "./email/mailer";
import { ensureTicketSubjectTag } from "./ticket-ref";

/**
 * Versendet eine E-Mail-Antwort aus einem Ticket heraus und legt sie als
 * OUTBOUND-Eintrag im Ticket-Verlauf ab. Geteilt von Server Action
 * (src/app/(app)/tickets/actions.ts) und MCP-Werkzeug (tools-rental.ts).
 * Wirft bei fehlender SMTP-Konfiguration oder Versandfehler - die Aufrufer
 * wandeln das in ihr jeweiliges Fehlerformat um.
 *
 * Der Betreff erhält automatisch die Ticket-Kennung (z. B. „[#a3f8b2c1]"),
 * damit Antworten des Empfängers beim IMAP-Abruf auch ohne Threading-Header
 * dem richtigen Ticket zugeordnet werden können (src/lib/ticket-ref.ts).
 */
export async function sendTicketEmail(input: {
	ticketId: string;
	to: string;
	subject: string;
	body: string;
	authorUserId: string | null;
	authorEmail: string | null;
}): Promise<void> {
	if (!isSmtpConfigured()) {
		throw new Error("Der E-Mail-Versand ist nicht konfiguriert (SMTP, siehe Einstellungen).");
	}

	// Threading: an die letzte eingehende E-Mail des Verlaufs anhängen, damit
	// die Antwort beim Empfänger im selben Verlauf landet und Rückantworten
	// beim nächsten IMAP-Abruf erkannt werden.
	const threadMessageIds = listTicketMessages(input.ticketId)
		.filter((message) => message.direction !== "NOTE" && message.messageId)
		.map((message) => message.messageId as string);
	const inReplyTo = threadMessageIds.length > 0 ? threadMessageIds[threadMessageIds.length - 1] : null;
	const messageId = `<${newId()}@immobase.local>`;
	// Ticket-Kennung in den Betreff (Fallback-Zuordnung beim IMAP-Import).
	const subject = ensureTicketSubjectTag(input.subject, input.ticketId);

	const { from } = await sendTicketReplyEmail({
		to: input.to,
		subject,
		text: input.body,
		messageId,
		inReplyTo,
		references: threadMessageIds.slice(0, -1),
	});

	createTicketMessage({
		ticketId: input.ticketId,
		direction: "OUTBOUND",
		messageId,
		fromAddress: from,
		toAddresses: input.to,
		subject,
		bodyText: input.body,
		authorUserId: input.authorUserId,
		authorEmail: input.authorEmail,
	});
}
