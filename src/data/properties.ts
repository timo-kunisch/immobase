import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Property } from "./types";

/**
 * Repository für Liegenschaften (Tabelle `properties`).
 *
 * Konventionen für alle Repositories unter src/data/:
 * - SELECTs verwenden Spalten-Aliase (`zip_code AS zipCode`), sodass die
 *   Zeilen direkt dem camelCase-Typ aus ./types entsprechen - keine
 *   separate Mapper-Schicht nötig.
 * - create* erzeugt id/createdAt/updatedAt anwendungsseitig (siehe
 *   src/lib/id.ts).
 * - Synchroner better-sqlite3-Zugriff - Aufrufer können die Funktionen
 *   trotzdem mit `await` aufrufen (harmlos: await auf Nicht-Promises
 *   ist ein No-Op).
 */

const PROPERTY_COLUMNS = `
	id, name, street, zip_code AS zipCode, city, country, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface PropertyInput {
	name: string;
	street: string;
	zipCode: string;
	city: string;
	country: string;
	notes: string | null;
}

export function listProperties(): Property[] {
	return getDb()
		.prepare(`SELECT ${PROPERTY_COLUMNS} FROM properties ORDER BY created_at DESC`)
		.all() as Property[];
}

export function getProperty(id: string): Property | null {
	const row = getDb().prepare(`SELECT ${PROPERTY_COLUMNS} FROM properties WHERE id = ?`).get(id) as
		| Property
		| undefined;
	return row ?? null;
}

export function createProperty(input: PropertyInput): Property {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO properties (id, name, street, zip_code, city, country, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.name, input.street, input.zipCode, input.city, input.country, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateProperty(id: string, input: PropertyInput): void {
	getDb()
		.prepare(
			`UPDATE properties
			 SET name = ?, street = ?, zip_code = ?, city = ?, country = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.name, input.street, input.zipCode, input.city, input.country, input.notes, now(), id);
}

export function deleteProperty(id: string): void {
	getDb().prepare("DELETE FROM properties WHERE id = ?").run(id);
}

export interface PropertyStats {
	units: number;
	openTickets: number;
	documents: number;
}

/**
 * Verknüpfungs-Zähler je Liegenschaft für die Listenansicht (Einheiten,
 * offene Tickets, Dokumente). Bewusst als eine Aggregat-Funktion im
 * properties-Repository gebündelt, statt drei einzelner Count-Queries über
 * die Modulgrenzen verteilt - Aufrufer: src/app/(app)/liegenschaften/page.tsx.
 */
export function getPropertyStats(): Map<string, PropertyStats> {
	const db = getDb();
	const stats = new Map<string, PropertyStats>();
	const ensure = (propertyId: string): PropertyStats => {
		let entry = stats.get(propertyId);
		if (!entry) {
			entry = { units: 0, openTickets: 0, documents: 0 };
			stats.set(propertyId, entry);
		}
		return entry;
	};

	const unitCounts = db
		.prepare("SELECT property_id AS propertyId, COUNT(*) AS value FROM units GROUP BY property_id")
		.all() as { propertyId: string; value: number }[];
	for (const row of unitCounts) ensure(row.propertyId).units = row.value;

	const ticketCounts = db
		.prepare(
			`SELECT property_id AS propertyId, COUNT(*) AS value FROM tickets
			 WHERE status IN ('OPEN', 'IN_PROGRESS') GROUP BY property_id`
		)
		.all() as { propertyId: string; value: number }[];
	for (const row of ticketCounts) ensure(row.propertyId).openTickets = row.value;

	const documentCounts = db
		.prepare("SELECT property_id AS propertyId, COUNT(*) AS value FROM documents WHERE deleted_at IS NULL GROUP BY property_id")
		.all() as { propertyId: string | null; value: number }[];
	for (const row of documentCounts) {
		if (row.propertyId) ensure(row.propertyId).documents = row.value;
	}

	return stats;
}
