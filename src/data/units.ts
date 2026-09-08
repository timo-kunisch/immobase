import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Unit } from "./types";

/**
 * Repository für Mieteinheiten (Tabelle `units`) sowie die für die
 * Einheiten-Listenansicht benötigten Aggregat-Abfragen (Verknüpfungs-Zähler,
 * aktive Mietverhältnisse). Konventionen siehe src/data/properties.ts.
 */

export interface UnitInput {
	propertyId: string;
	label: string;
	floor: string | null;
	livingSpace: number | null;
	rooms: number | null;
	/** Miteigentumsanteil (Zähler; Nenner = Hoa.totalShares) - WEG-Verwaltung. */
	coOwnershipShare: number | null;
}

/** Einheit inklusive Name der zugehörigen Liegenschaft (Listenansicht). */
export interface UnitWithPropertyName extends Unit {
	propertyName: string;
}

export function listUnits(filter?: { propertyId?: string }): UnitWithPropertyName[] {
	const where = filter?.propertyId ? "WHERE u.property_id = ?" : "";
	const params = filter?.propertyId ? [filter.propertyId] : [];
	return getDb()
		.prepare(
			`SELECT u.id, u.property_id AS propertyId, u.label, u.living_space AS livingSpace, u.rooms,
				u.floor, u.co_ownership_share AS coOwnershipShare,
				u.created_at AS createdAt, u.updated_at AS updatedAt,
				p.name AS propertyName
			 FROM units u
			 JOIN properties p ON p.id = u.property_id
			 ${where}
			 ORDER BY u.created_at DESC`
		)
		.all(...params) as UnitWithPropertyName[];
}

export function getUnit(id: string): Unit | null {
	const row = getDb()
		.prepare(
			`SELECT id, property_id AS propertyId, label, living_space AS livingSpace, rooms,
				floor, co_ownership_share AS coOwnershipShare,
				created_at AS createdAt, updated_at AS updatedAt
			 FROM units WHERE id = ?`
		)
		.get(id) as Unit | undefined;
	return row ?? null;
}

export function createUnit(input: UnitInput): Unit {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO units (id, property_id, label, floor, living_space, rooms, co_ownership_share, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.propertyId,
			input.label,
			input.floor,
			input.livingSpace,
			input.rooms,
			input.coOwnershipShare,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateUnit(id: string, input: UnitInput): void {
	getDb()
		.prepare(
			`UPDATE units
			 SET property_id = ?, label = ?, floor = ?, living_space = ?, rooms = ?, co_ownership_share = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.propertyId, input.label, input.floor, input.livingSpace, input.rooms, input.coOwnershipShare, now(), id);
}

export function deleteUnit(id: string): void {
	getDb().prepare("DELETE FROM units WHERE id = ?").run(id);
}

// ------------------------------------------------------------
// Querschnitts-Abfragen für die Einheiten-Listenansicht
// ------------------------------------------------------------

/** Aktives Mietverhältnis einer Einheit inkl. Mietername (Vermietet/Leerstand-Anzeige). */
export interface ActiveLeaseWithTenant {
	id: string;
	unitId: string;
	tenantFirstName: string;
	tenantLastName: string;
}

/**
 * Aktuell laufende Mietverträge (Mietbeginn nicht in der Zukunft, Mietende
 * nicht in der Vergangenheit) inkl. Mieter - dieselbe Statusregel wie
 * getLeaseStatus() in src/lib/lease-status.ts, hier als SQL.
 */
export function listActiveLeasesWithTenants(date: Date = new Date()): ActiveLeaseWithTenant[] {
	const iso = date.toISOString();
	return getDb()
		.prepare(
			`SELECT l.id, l.unit_id AS unitId, t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM leases l
			 JOIN tenants t ON t.id = l.tenant_id
			 WHERE l.start_date <= ? AND (l.end_date IS NULL OR l.end_date >= ?)`
		)
		.all(iso, iso) as ActiveLeaseWithTenant[];
}

export interface UnitStats {
	leases: number;
	openTickets: number;
	documents: number;
}

/**
 * Verknüpfungs-Zähler je Einheit für die Listenansicht (Mietverträge,
 * offene Tickets, Dokumente). Bewusst als eine Aggregat-Funktion gebündelt
 * (Muster wie getPropertyStats in src/data/properties.ts) - Aufrufer:
 * src/app/(app)/einheiten/page.tsx.
 */
export function getUnitStats(): Map<string, UnitStats> {
	const db = getDb();
	const stats = new Map<string, UnitStats>();
	const ensure = (unitId: string): UnitStats => {
		let entry = stats.get(unitId);
		if (!entry) {
			entry = { leases: 0, openTickets: 0, documents: 0 };
			stats.set(unitId, entry);
		}
		return entry;
	};

	const leaseCounts = db
		.prepare("SELECT unit_id AS unitId, COUNT(*) AS value FROM leases GROUP BY unit_id")
		.all() as { unitId: string; value: number }[];
	for (const row of leaseCounts) ensure(row.unitId).leases = row.value;

	const ticketCounts = db
		.prepare(
			`SELECT unit_id AS unitId, COUNT(*) AS value FROM tickets
			 WHERE status IN ('OPEN', 'IN_PROGRESS') GROUP BY unit_id`
		)
		.all() as { unitId: string | null; value: number }[];
	for (const row of ticketCounts) {
		if (row.unitId) ensure(row.unitId).openTickets = row.value;
	}

	const documentCounts = db
		.prepare("SELECT unit_id AS unitId, COUNT(*) AS value FROM documents GROUP BY unit_id")
		.all() as { unitId: string | null; value: number }[];
	for (const row of documentCounts) {
		if (row.unitId) ensure(row.unitId).documents = row.value;
	}

	return stats;
}
