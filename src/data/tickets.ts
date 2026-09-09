import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Ticket, TicketStatus, Unit } from "./types";

/**
 * Repository für Tickets (Schadens-/Instandhaltungsmanagement, Tabelle
 * `tickets`) inklusive der für Listenansicht und Filter benötigten
 * Lesezugriffe auf die verknüpften Stammdaten (properties/units - letztere
 * haben noch kein eigenes Repository, daher hier als JOIN/eigene Abfrage).
 */

const TICKET_COLUMNS = `
	t.id AS id, t.property_id AS propertyId, t.unit_id AS unitId,
	t.title AS title, t.description AS description, t.status AS status,
	t.contractor_notes AS contractorNotes, t.resolved_at AS resolvedAt,
	t.created_at AS createdAt, t.updated_at AS updatedAt
`;

const UNIT_COLUMNS = `
	id, property_id AS propertyId, label, living_space AS livingSpace,
	rooms, floor, co_ownership_share AS coOwnershipShare,
	created_at AS createdAt, updated_at AS updatedAt
`;

/** Ticket inklusive verknüpfter Liegenschaft und (optionaler) Einheit. */
export interface TicketWithRelations extends Ticket {
	// property_id ist NOT NULL mit FK restrict - die Liegenschaft existiert
	// daher garantiert (kein null-Fall nötig).
	property: { id: string; name: string };
	unit: { id: string; label: string } | null;
}

/** Flache Join-Zeile aus listTickets (vor dem Mapping zu TicketWithRelations). */
interface TicketJoinRow extends Ticket {
	propertyName: string;
	unitLabel: string | null;
}

export interface TicketInput {
	propertyId: string;
	unitId: string | null;
	title: string;
	description: string | null;
	status: TicketStatus;
	contractorNotes: string | null;
	/** ISO-Zeitpunkt bei status "DONE", sonst null (wird von der Action gesetzt). */
	resolvedAt: string | null;
}

export function listTickets(filters: { propertyId?: string; unitId?: string } = {}): TicketWithRelations[] {
	const conditions: string[] = [];
	const params: string[] = [];
	if (filters.propertyId) {
		conditions.push("t.property_id = ?");
		params.push(filters.propertyId);
	}
	if (filters.unitId) {
		conditions.push("t.unit_id = ?");
		params.push(filters.unitId);
	}
	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	const rows = getDb()
		.prepare(
			`SELECT ${TICKET_COLUMNS},
				p.name AS propertyName, u.label AS unitLabel
			 FROM tickets t
			 LEFT JOIN properties p ON t.property_id = p.id
			 LEFT JOIN units u ON t.unit_id = u.id
			 ${where}
			 ORDER BY t.created_at DESC`
		)
		.all(...params) as TicketJoinRow[];

	return rows.map((row) => {
		const { propertyName, unitLabel, ...ticket } = row;
		return {
			...ticket,
			property: { id: row.propertyId, name: propertyName },
			unit: row.unitId && unitLabel ? { id: row.unitId, label: unitLabel } : null,
		};
	});
}

/** Einzelnes Ticket inklusive verknüpfter Liegenschaft/Einheit (Detailseite). */
export function getTicket(id: string): TicketWithRelations | null {
	const row = getDb()
		.prepare(
			`SELECT ${TICKET_COLUMNS},
				p.name AS propertyName, u.label AS unitLabel
			 FROM tickets t
			 LEFT JOIN properties p ON t.property_id = p.id
			 LEFT JOIN units u ON t.unit_id = u.id
			 WHERE t.id = ?`
		)
		.get(id) as TicketJoinRow | undefined;
	if (!row) return null;
	const { propertyName, unitLabel, ...ticket } = row;
	return {
		...ticket,
		property: { id: row.propertyId, name: propertyName },
		unit: row.unitId && unitLabel ? { id: row.unitId, label: unitLabel } : null,
	};
}

export function createTicket(input: TicketInput): Ticket {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO tickets (id, property_id, unit_id, title, description, status, contractor_notes, resolved_at, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.propertyId,
			input.unitId,
			input.title,
			input.description,
			input.status,
			input.contractorNotes,
			input.resolvedAt,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateTicket(id: string, input: TicketInput): void {
	getDb()
		.prepare(
			`UPDATE tickets
			 SET property_id = ?, unit_id = ?, title = ?, description = ?, status = ?,
			     contractor_notes = ?, resolved_at = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.propertyId,
			input.unitId,
			input.title,
			input.description,
			input.status,
			input.contractorNotes,
			input.resolvedAt,
			now(),
			id
		);
}

/** Schneller Status-Wechsel aus der Kanban-Ansicht (resolvedAt je nach Status gesetzt/zurückgesetzt). */
export function updateTicketStatus(id: string, status: TicketStatus, resolvedAt: string | null): void {
	getDb()
		.prepare("UPDATE tickets SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?")
		.run(status, resolvedAt, now(), id);
}

export function deleteTicket(id: string): void {
	getDb().prepare("DELETE FROM tickets WHERE id = ?").run(id);
}

/**
 * Löst eine Ticket-Kennung aus dem E-Mail-Betreff (z. B. „a3f8b2c1" aus
 * „[#a3f8b2c1]", siehe src/lib/ticket-ref.ts) auf. Gibt nur bei genau
 * einem Treffer die Ticket-ID zurück - bei keiner oder mehreren
 * Übereinstimmungen (Präfix-Kollision) null, damit keine E-Mail versehentlich
 * dem falschen Ticket zugeordnet wird.
 */
export function findTicketIdByRef(ref: string): string | null {
	const normalized = ref.trim().replace(/^#/, "").toLowerCase();
	if (!/^[0-9a-f]{8}$/.test(normalized)) return null;
	const rows = getDb()
		.prepare("SELECT id FROM tickets WHERE lower(substr(id, 1, 8)) = ?")
		.all(normalized) as { id: string }[];
	return rows.length === 1 ? rows[0].id : null;
}

// ------------------------------------------------------------
// Stammdaten-Zugriffe für Auswahl/Filter der Tickets-Ansicht
// (units besitzt noch kein eigenes Repository - daher hier)
// ------------------------------------------------------------

/** Alle Einheiten für die Auswahl im Ticket-Dialog, sortiert nach Bezeichnung. */
export function listUnitsByLabel(): Unit[] {
	return getDb().prepare(`SELECT ${UNIT_COLUMNS} FROM units ORDER BY label ASC`).all() as Unit[];
}

/** Einheit inklusive Liegenschaftsname (für den Filter-Hinweis der Tickets-Ansicht). */
export function getUnitWithPropertyName(id: string): { id: string; label: string; propertyName: string } | null {
	const row = getDb()
		.prepare(
			`SELECT u.id AS id, u.label AS label, p.name AS propertyName
			 FROM units u
			 LEFT JOIN properties p ON u.property_id = p.id
			 WHERE u.id = ?`
		)
		.get(id) as { id: string; label: string; propertyName: string } | undefined;
	return row ?? null;
}
