import { getDb } from "./db";
import { intToBool, newId, now } from "./helpers";
import { createTicket, type TicketInput } from "./tickets";
import type { Ticket, TicketMessage, TicketMessageDirection } from "./types";

/**
 * Repository für die Ticket-Kommunikation (Tabelle `ticket_messages`):
 * eine Tabelle für den kompletten Konversationsverlauf eines Tickets
 * (eingehende/ausgehende E-Mails + interne Notizen) UND gleichzeitig für
 * das Eingangs-Postfach (eingehende Nachrichten mit `ticket_id IS NULL`).
 * Siehe Migration 0006; `hidden` (Migration 0018) blendet Postfach-Nachrichten
 * aus der normalen Ansicht aus, ohne sie zu löschen.
 */

const TICKET_MESSAGE_COLUMNS = `
	id, ticket_id AS ticketId, direction, message_id AS messageId,
	imap_folder AS imapFolder, imap_uid AS imapUid,
	from_address AS fromAddress, to_addresses AS toAddresses,
	subject, body_text AS bodyText,
	author_user_id AS authorUserId, author_email AS authorEmail,
	created_at AS createdAt, hidden
`;

/** Zeilenform, wie better-sqlite3 sie liefert (hidden noch als 0/1). */
type TicketMessageRow = Omit<TicketMessage, "hidden"> & { hidden: number };

function mapTicketMessageRow(row: TicketMessageRow): TicketMessage {
	return { ...row, hidden: intToBool(row.hidden) };
}

export interface TicketMessageInput {
	ticketId: string | null;
	direction: TicketMessageDirection;
	messageId?: string | null;
	imapFolder?: string | null;
	imapUid?: number | null;
	fromAddress?: string | null;
	toAddresses?: string | null;
	subject?: string | null;
	bodyText?: string | null;
	authorUserId?: string | null;
	authorEmail?: string | null;
	/** Zeitpunkt im Verlauf (bei E-Mails das Mail-Datum); Default: jetzt. */
	createdAt?: string;
}

export function createTicketMessage(input: TicketMessageInput): TicketMessage {
	const message: TicketMessage = {
		id: newId(),
		ticketId: input.ticketId,
		direction: input.direction,
		messageId: input.messageId ?? null,
		imapFolder: input.imapFolder ?? null,
		imapUid: input.imapUid ?? null,
		fromAddress: input.fromAddress ?? null,
		toAddresses: input.toAddresses ?? null,
		subject: input.subject ?? null,
		bodyText: input.bodyText ?? null,
		authorUserId: input.authorUserId ?? null,
		authorEmail: input.authorEmail ?? null,
		createdAt: input.createdAt ?? now(),
		hidden: false,
	};
	getDb()
		.prepare(
			`INSERT INTO ticket_messages (id, ticket_id, direction, message_id, imap_folder, imap_uid,
				from_address, to_addresses, subject, body_text, author_user_id, author_email, created_at, hidden)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
		)
		.run(
			message.id,
			message.ticketId,
			message.direction,
			message.messageId,
			message.imapFolder,
			message.imapUid,
			message.fromAddress,
			message.toAddresses,
			message.subject,
			message.bodyText,
			message.authorUserId,
			message.authorEmail,
			message.createdAt
		);
	return message;
}

/**
 * Importiert eine eingehende IMAP-Nachricht, dedupliziert über den
 * partiellen Unique-Index (imap_folder, imap_uid). Gibt `inserted: false`
 * zurück, wenn die Nachricht bereits bekannt war (kein erneuter Import).
 */
export function importInboundMessage(input: Omit<TicketMessageInput, "ticketId" | "direction"> & { ticketId?: string | null }): {
	message: TicketMessage;
	inserted: boolean;
} {
	const message: TicketMessage = {
		id: newId(),
		ticketId: input.ticketId ?? null,
		direction: "INBOUND",
		messageId: input.messageId ?? null,
		imapFolder: input.imapFolder ?? null,
		imapUid: input.imapUid ?? null,
		fromAddress: input.fromAddress ?? null,
		toAddresses: input.toAddresses ?? null,
		subject: input.subject ?? null,
		bodyText: input.bodyText ?? null,
		authorUserId: null,
		authorEmail: null,
		createdAt: input.createdAt ?? now(),
		hidden: false,
	};
	const result = getDb()
		.prepare(
			`INSERT OR IGNORE INTO ticket_messages (id, ticket_id, direction, message_id, imap_folder, imap_uid,
				from_address, to_addresses, subject, body_text, author_user_id, author_email, created_at, hidden)
			 VALUES (?, ?, 'INBOUND', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0)`
		)
		.run(
			message.id,
			message.ticketId,
			message.messageId,
			message.imapFolder,
			message.imapUid,
			message.fromAddress,
			message.toAddresses,
			message.subject,
			message.bodyText,
			message.createdAt
		);
	return { message, inserted: result.changes > 0 };
}

export function getTicketMessage(id: string): TicketMessage | null {
	const row = getDb()
		.prepare(`SELECT ${TICKET_MESSAGE_COLUMNS} FROM ticket_messages WHERE id = ?`)
		.get(id) as TicketMessageRow | undefined;
	return row ? mapTicketMessageRow(row) : null;
}

/** Verlauf eines Tickets chronologisch (rowid als Tie-Breaker bei gleichem Mail-Datum). */
export function listTicketMessages(ticketId: string): TicketMessage[] {
	const rows = getDb()
		.prepare(`SELECT ${TICKET_MESSAGE_COLUMNS} FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC, rowid ASC`)
		.all(ticketId) as TicketMessageRow[];
	return rows.map(mapTicketMessageRow);
}

/** Postfach: sichtbare eingehende Nachrichten (noch keinem Ticket zugeordnet, neueste zuerst). */
export function listMailboxMessages(): TicketMessage[] {
	const rows = getDb()
		.prepare(
			`SELECT ${TICKET_MESSAGE_COLUMNS} FROM ticket_messages
			 WHERE direction = 'INBOUND' AND ticket_id IS NULL AND hidden = 0
			 ORDER BY created_at DESC, rowid DESC`
		)
		.all() as TicketMessageRow[];
	return rows.map(mapTicketMessageRow);
}

/** Postfach: die ausgeblendeten, noch keinem Ticket zugeordneten Nachrichten (neueste zuerst). */
export function listHiddenMailboxMessages(): TicketMessage[] {
	const rows = getDb()
		.prepare(
			`SELECT ${TICKET_MESSAGE_COLUMNS} FROM ticket_messages
			 WHERE direction = 'INBOUND' AND ticket_id IS NULL AND hidden = 1
			 ORDER BY created_at DESC, rowid DESC`
		)
		.all() as TicketMessageRow[];
	return rows.map(mapTicketMessageRow);
}

/** Anzahl der Nachrichten je Ticket (für Zähler-Badges in der Kanban-Ansicht). */
export function listTicketMessageCounts(): Record<string, number> {
	const rows = getDb()
		.prepare(`SELECT ticket_id AS ticketId, COUNT(*) AS count FROM ticket_messages WHERE ticket_id IS NOT NULL GROUP BY ticket_id`)
		.all() as { ticketId: string; count: number }[];
	return Object.fromEntries(rows.map((row) => [row.ticketId, row.count]));
}

/**
 * Ordnet eine Nachricht (aus dem Postfach) einem Ticket zu. Ein evtl.
 * vorhandenes Ausblend-Flag wird zurückgesetzt, damit die E-Mail nach
 * dem Lösen der Zuordnung wieder sichtbar im Postfach landet.
 */
export function linkMessageToTicket(id: string, ticketId: string): void {
	getDb().prepare("UPDATE ticket_messages SET ticket_id = ?, hidden = 0 WHERE id = ?").run(ticketId, id);
}

/**
 * Löst die Ticket-Zuordnung einer eingehenden E-Mail wieder auf - die
 * Nachricht landet zurück im Postfach. Nur eingehende E-Mails sind
 * entknüpfbar (ausgehende E-Mails/Notizen gehören fachlich zum Ticket
 * und hätten ohne Zuordnung keinen Anzeigeort).
 */
export function unlinkMessageFromTicket(id: string): void {
	getDb().prepare("UPDATE ticket_messages SET ticket_id = NULL WHERE id = ? AND direction = 'INBOUND'").run(id);
}

/**
 * Löscht eine Nachricht aus dem Postfach (auch ausgeblendete). Nur
 * unverknüpfte eingehende Nachrichten sind so löschbar - Ticket-Verläufe
 * werden nicht entfernt (sie verschwinden mit dem Ticket per ON DELETE
 * CASCADE).
 */
export function deleteMailboxMessage(id: string): void {
	getDb().prepare("DELETE FROM ticket_messages WHERE id = ? AND direction = 'INBOUND' AND ticket_id IS NULL").run(id);
}

/**
 * Blendet eine Nachricht aus dem Postfach aus (Alternative zum Löschen:
 * die lokale Kopie bleibt samt Dedup-Merkmal erhalten und kann jederzeit
 * wieder eingeblendet werden). Nur unverknüpfte eingehende Nachrichten.
 */
export function hideMailboxMessage(id: string): void {
	getDb().prepare("UPDATE ticket_messages SET hidden = 1 WHERE id = ? AND direction = 'INBOUND' AND ticket_id IS NULL").run(id);
}

/** Blendet eine ausgeblendete Postfach-Nachricht wieder ein. */
export function unhideMailboxMessage(id: string): void {
	getDb().prepare("UPDATE ticket_messages SET hidden = 0 WHERE id = ? AND direction = 'INBOUND' AND ticket_id IS NULL").run(id);
}

/**
 * Bearbeitet den Text einer internen Notiz. Nur Notizen sind editierbar -
 * E-Mail-Einträge sind authentische Protokolle des Mailverkehrs.
 */
export function updateTicketNote(id: string, bodyText: string): void {
	getDb().prepare("UPDATE ticket_messages SET body_text = ? WHERE id = ? AND direction = 'NOTE'").run(bodyText, id);
}

/**
 * Löscht eine interne Notiz aus dem Ticket-Verlauf. Nur Notizen sind so
 * löschbar - E-Mail-Einträge bleiben erhalten (sie verschwinden nur mit
 * dem Ticket bzw. landen beim Entknüpfen zurück im Postfach).
 */
export function deleteTicketNote(id: string): void {
	getDb().prepare("DELETE FROM ticket_messages WHERE id = ? AND direction = 'NOTE'").run(id);
}

/**
 * Threading: Sucht zu RFC-822-Verweisen (In-Reply-To/References) ein
 * bereits verknüpftes Ticket - eingehende Antworten auf Ticket-E-Mails
 * landen so automatisch im richtigen Verlauf.
 */
export function findLinkedTicketIdByMessageIds(messageIds: string[]): string | null {
	const ids = [...new Set(messageIds.filter((id) => typeof id === "string" && id.length > 0))];
	if (ids.length === 0) return null;
	const placeholders = ids.map(() => "?").join(", ");
	const row = getDb()
		.prepare(`SELECT ticket_id AS ticketId FROM ticket_messages WHERE ticket_id IS NOT NULL AND message_id IN (${placeholders}) LIMIT 1`)
		.get(...ids) as { ticketId: string } | undefined;
	return row?.ticketId ?? null;
}

/**
 * Wandelt eine Postfach-Nachricht in ein neues Ticket um (Transaktion:
 * Ticket anlegen + Nachricht verknüpfen - kein halbzugeordneter Zustand).
 */
export function convertMessageToTicket(messageId: string, input: TicketInput): Ticket {
	const db = getDb();
	return db.transaction(() => {
		const ticket = createTicket(input);
		linkMessageToTicket(messageId, ticket.id);
		return ticket;
	})();
}
