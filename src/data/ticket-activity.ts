import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { TicketActivity, TicketActivityAction } from "./types";

/**
 * Repository für den Ticket-Aktivitätsverlauf (Tabelle
 * `ticket_activity_log`, Migration 0017): Protokolliert jede fachliche
 * Aktion auf einem Ticket - visible im Verlauf der Ticket-Detailseite
 * („Wer hat wann was getan"). Bewusst getrennt vom globalen
 * Aktivitätsprotokoll (src/data/audit-log.ts): Dort steht die Admin-Sicht
 * über alle Module, hier die nachvollziehbare Geschichte des einzelnen
 * Tickets für jeden berechtigten Nutzer.
 *
 * Append-only: Es gibt keine Update- oder Delete-Operationen - Einträge
 * verschwinden nur mit dem Ticket (ON DELETE CASCADE) bzw. beim
 * Inhalts-Reset.
 */

const TICKET_ACTIVITY_COLUMNS = `
	id, ticket_id AS ticketId, action,
	from_value AS fromValue, to_value AS toValue, detail,
	actor_user_id AS actorUserId, actor_email AS actorEmail,
	created_at AS createdAt
`;

export interface TicketActivityInput {
	ticketId: string;
	action: TicketActivityAction;
	/** Alter/neuer Wert bei Wertänderungen (z. B. Status-Enum). */
	fromValue?: string | null;
	toValue?: string | null;
	/** Freier Kontext (z. B. E-Mail-Betreff). */
	detail?: string | null;
	/** Handelnder Nutzer; beides null/weggelassen = System-Aktion. */
	actorUserId?: string | null;
	actorEmail?: string | null;
	/** Zeitpunkt der Aktion; Default: jetzt. */
	createdAt?: string;
}

/**
 * Protokolliert eine Ticket-Aktion. Aufrufer sind die Server Actions
 * (mit dem Session-Nutzer als Akteur) und die MCP-Werkzeuge (Akteur null =
 * System, siehe AGENTS.md zu MCP: Token ohne Nutzerkontext).
 */
export function logTicketActivity(input: TicketActivityInput): TicketActivity {
	const activity: TicketActivity = {
		id: newId(),
		ticketId: input.ticketId,
		action: input.action,
		fromValue: input.fromValue ?? null,
		toValue: input.toValue ?? null,
		detail: input.detail ?? null,
		actorUserId: input.actorUserId ?? null,
		actorEmail: input.actorEmail ?? null,
		createdAt: input.createdAt ?? now(),
	};
	getDb()
		.prepare(
			`INSERT INTO ticket_activity_log (id, ticket_id, action, from_value, to_value, detail, actor_user_id, actor_email, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			activity.id,
			activity.ticketId,
			activity.action,
			activity.fromValue,
			activity.toValue,
			activity.detail,
			activity.actorUserId,
			activity.actorEmail,
			activity.createdAt
		);
	return activity;
}

/**
 * Aktivitätsverlauf eines Tickets chronologisch (rowid als Tie-Breaker
 * bei gleichem Zeitpunkt = Einreihungsfolge, z. B. UPDATED und
 * STATUS_CHANGED aus derselben Bearbeitung).
 */
export function listTicketActivity(ticketId: string): TicketActivity[] {
	return getDb()
		.prepare(`SELECT ${TICKET_ACTIVITY_COLUMNS} FROM ticket_activity_log WHERE ticket_id = ? ORDER BY created_at ASC, rowid ASC`)
		.all(ticketId) as TicketActivity[];
}
