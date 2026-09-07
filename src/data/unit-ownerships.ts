import { getDb } from "./db";
import { intToBool, newId, now } from "./helpers";
import type { Owner, Unit, UnitOwnership } from "./types";

/**
 * Repository für Eigentumsverhältnisse (Tabelle `unit_ownerships`) -
 * zeitversionierte Zeitreihe je Einheit (startDate/endDate), siehe
 * src/lib/hoa-ownership.ts für die Auswertungslogik. Konventionen siehe
 * src/data/properties.ts.
 */

const UNIT_OWNERSHIP_COLUMNS = `
	id, unit_id AS unitId, owner_id AS ownerId, co_owner_id AS coOwnerId,
	start_date AS startDate, end_date AS endDate, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface UnitOwnershipInput {
	unitId: string;
	ownerId: string;
	coOwnerId: string | null;
	startDate: string;
	notes: string | null;
}

/** Eigentumsverhältnis inkl. Eigentümer und optionalem Miteigentümer. */
export interface UnitOwnershipWithOwners extends UnitOwnership {
	owner: Owner;
	coOwner: Owner | null;
}

/**
 * Einheit einer WEG-Liegenschaft inkl. Anzeigedaten und aller
 * Eigentumsverhältnisse (neueste zuerst) - Datenmodell der Seite
 * src/app/(app)/weg/eigentumsverhaeltnisse/page.tsx.
 */
export interface UnitWithOwnerships extends Unit {
	propertyName: string;
	/** Nenner der Miteigentumsanteile (hoas.total_shares der zugehörigen WEG). */
	hoaTotalShares: number;
	ownerships: UnitOwnershipWithOwners[];
}

/**
 * Rohvariante der Eigentümer-Spalten im JOIN: isCompany liegt als integer
 * 0/1 vor (Mapping auf boolean erst in mapOwnerColumns).
 */
type OwnerColumnsRaw = Omit<Owner, "isCompany"> & { isCompany: number };

/** Rohzeile des Besitzer-JOINs: Eigentümer-Spalten mit Präfix `owner__` / `coOwner__`. */
type OwnershipJoinRow = UnitOwnership & {
	[K in keyof OwnerColumnsRaw as `owner__${K}`]: OwnerColumnsRaw[K];
} & {
	[K in keyof OwnerColumnsRaw as `coOwner__${K}`]: OwnerColumnsRaw[K] | null;
};

function mapOwnerColumns(row: OwnershipJoinRow, prefix: "owner__" | "coOwner__"): Owner | null {
	const id = row[`${prefix}id`];
	if (!id) return null;
	return {
		id,
		firstName: row[`${prefix}firstName`]!,
		lastName: row[`${prefix}lastName`]!,
		isCompany: intToBool(row[`${prefix}isCompany`]),
		companyName: row[`${prefix}companyName`] ?? null,
		street: row[`${prefix}street`]!,
		zipCode: row[`${prefix}zipCode`]!,
		city: row[`${prefix}city`]!,
		country: row[`${prefix}country`]!,
		email: row[`${prefix}email`] ?? null,
		phone: row[`${prefix}phone`] ?? null,
		notes: row[`${prefix}notes`] ?? null,
		createdAt: row[`${prefix}createdAt`]!,
		updatedAt: row[`${prefix}updatedAt`]!,
	};
}

/** Spaltenliste eines Eigentümer-JOINs mit gewünschtem Alias-Präfix. */
function ownerJoinColumns(alias: string, prefix: string): string {
	return `
		${alias}.id AS ${prefix}id, ${alias}.first_name AS ${prefix}firstName, ${alias}.last_name AS ${prefix}lastName,
		${alias}.is_company AS ${prefix}isCompany, ${alias}.company_name AS ${prefix}companyName,
		${alias}.street AS ${prefix}street, ${alias}.zip_code AS ${prefix}zipCode, ${alias}.city AS ${prefix}city,
		${alias}.country AS ${prefix}country, ${alias}.email AS ${prefix}email, ${alias}.phone AS ${prefix}phone,
		${alias}.notes AS ${prefix}notes, ${alias}.created_at AS ${prefix}createdAt, ${alias}.updated_at AS ${prefix}updatedAt
	`;
}

/**
 * Alle Einheiten von WEG-Liegenschaften inkl. ihrer Eigentumsverhältnisse
 * (je Einheit nach Beginn absteigend), optional auf eine WEG eingeschränkt
 * (hoaId-Filter der Seite /weg/eigentumsverhaeltnisse). Einheiten werden
 * nach Bezeichnung sortiert.
 */
export function listUnitsWithOwnerships(hoaId?: string): UnitWithOwnerships[] {
	const db = getDb();
	const hoaFilter = hoaId ? "WHERE h.id = ?" : "";
	const params = hoaId ? [hoaId] : [];

	const unitRows = db
		.prepare(
			`SELECT u.id, u.property_id AS propertyId, u.label, u.living_space AS livingSpace, u.rooms,
				u.floor, u.co_ownership_share AS coOwnershipShare,
				u.created_at AS createdAt, u.updated_at AS updatedAt,
				p.name AS propertyName, h.total_shares AS hoaTotalShares
			 FROM units u
			 JOIN properties p ON p.id = u.property_id
			 JOIN hoas h ON h.property_id = u.property_id
			 ${hoaFilter}
			 ORDER BY u.label ASC`
		)
		.all(...params) as (Unit & { propertyName: string; hoaTotalShares: number })[];

	if (unitRows.length === 0) return [];

	const ownershipRows = db
		.prepare(
			`SELECT uo.id, uo.unit_id AS unitId, uo.owner_id AS ownerId, uo.co_owner_id AS coOwnerId,
				uo.start_date AS startDate, uo.end_date AS endDate, uo.notes,
				uo.created_at AS createdAt, uo.updated_at AS updatedAt,
				${ownerJoinColumns("o", "owner__")}, ${ownerJoinColumns("co", "coOwner__")}
			 FROM unit_ownerships uo
			 JOIN units u ON u.id = uo.unit_id
			 JOIN hoas h ON h.property_id = u.property_id
			 JOIN owners o ON o.id = uo.owner_id
			 LEFT JOIN owners co ON co.id = uo.co_owner_id
			 ${hoaFilter}
			 ORDER BY uo.start_date DESC`
		)
		.all(...params) as OwnershipJoinRow[];

	const ownershipsByUnit = new Map<string, UnitOwnershipWithOwners[]>();
	for (const row of ownershipRows) {
		const ownership: UnitOwnershipWithOwners = {
			id: row.id,
			unitId: row.unitId,
			ownerId: row.ownerId,
			coOwnerId: row.coOwnerId,
			startDate: row.startDate,
			endDate: row.endDate,
			notes: row.notes,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			owner: mapOwnerColumns(row, "owner__")!,
			coOwner: mapOwnerColumns(row, "coOwner__"),
		};
		const list = ownershipsByUnit.get(row.unitId) ?? [];
		list.push(ownership);
		ownershipsByUnit.set(row.unitId, list);
	}

	return unitRows.map((unit) => ({ ...unit, ownerships: ownershipsByUnit.get(unit.id) ?? [] }));
}

/** Das aktuell noch laufende (end_date IS NULL) Eigentumsverhältnis einer Einheit. */
export function getOpenUnitOwnership(unitId: string): UnitOwnership | null {
	const row = getDb()
		.prepare(`SELECT ${UNIT_OWNERSHIP_COLUMNS} FROM unit_ownerships WHERE unit_id = ? AND end_date IS NULL`)
		.get(unitId) as UnitOwnership | undefined;
	return row ?? null;
}

export function createUnitOwnership(input: UnitOwnershipInput): UnitOwnership {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO unit_ownerships (id, unit_id, owner_id, co_owner_id, start_date, end_date, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`
		)
		.run(id, input.unitId, input.ownerId, input.coOwnerId, input.startDate, input.notes, timestamp, timestamp);
	return { id, ...input, endDate: null, createdAt: timestamp, updatedAt: timestamp };
}

export function updateUnitOwnership(id: string, input: UnitOwnershipInput): void {
	getDb()
		.prepare(
			`UPDATE unit_ownerships
			 SET unit_id = ?, owner_id = ?, co_owner_id = ?, start_date = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.unitId, input.ownerId, input.coOwnerId, input.startDate, input.notes, now(), id);
}

/**
 * Setzt ausschließlich das Enddatum eines Eigentumsverhältnisses - genutzt
 * beim automatischen Beenden des bisher laufenden Verhältnisses im Zuge
 * eines Eigentümerwechsels (siehe saveUnitOwnershipAction).
 */
export function setUnitOwnershipEndDate(id: string, endDate: string): void {
	getDb()
		.prepare("UPDATE unit_ownerships SET end_date = ?, updated_at = ? WHERE id = ?")
		.run(endDate, now(), id);
}

export function deleteUnitOwnership(id: string): void {
	getDb().prepare("DELETE FROM unit_ownerships WHERE id = ?").run(id);
}
