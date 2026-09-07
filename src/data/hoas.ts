import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Hoa, Property } from "./types";

/**
 * Repository für WEGs (Tabelle `hoas`, 1:1 an `properties` gebunden) sowie
 * die für die WEG-Listenansicht benötigten Querschnitts-Abfragen
 * (verfügbare Liegenschaften, Verknüpfungs-Zähler). Konventionen siehe
 * src/data/properties.ts.
 */

const HOA_COLUMNS = `
	id, property_id AS propertyId, name, total_shares AS totalShares,
	bank_iban AS bankIban, bank_bic AS bankBic, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface HoaInput {
	propertyId: string;
	name: string;
	totalShares: number;
	bankIban: string | null;
	bankBic: string | null;
	notes: string | null;
}

/** WEG inklusive der zugehörigen Liegenschaft (Anzeige + Bearbeiten-Dialog). */
export interface HoaWithProperty extends Hoa {
	property: Property;
}

/** Rohzeile des JOINs: WEG-Spalten + Liegenschafts-Spalten mit Präfix `property__`. */
type HoaWithPropertyRow = Hoa & {
	[K in keyof Property as `property__${K}`]: Property[K];
};

function mapHoaWithProperty(row: HoaWithPropertyRow): HoaWithProperty {
	return {
		id: row.id,
		propertyId: row.propertyId,
		name: row.name,
		totalShares: row.totalShares,
		bankIban: row.bankIban,
		bankBic: row.bankBic,
		notes: row.notes,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		property: {
			id: row.property__id,
			name: row.property__name,
			street: row.property__street,
			zipCode: row.property__zipCode,
			city: row.property__city,
			country: row.property__country,
			notes: row.property__notes,
			createdAt: row.property__createdAt,
			updatedAt: row.property__updatedAt,
		},
	};
}

/** Alle WEGs inkl. Liegenschaft, neueste zuerst (Listenansicht /weg). */
export function listHoasWithProperty(): HoaWithProperty[] {
	const rows = getDb()
		.prepare(
			`SELECT h.id, h.property_id AS propertyId, h.name, h.total_shares AS totalShares,
				h.bank_iban AS bankIban, h.bank_bic AS bankBic, h.notes,
				h.created_at AS createdAt, h.updated_at AS updatedAt,
				p.id AS property__id, p.name AS property__name, p.street AS property__street,
				p.zip_code AS property__zipCode, p.city AS property__city, p.country AS property__country,
				p.notes AS property__notes, p.created_at AS property__createdAt, p.updated_at AS property__updatedAt
			 FROM hoas h
			 JOIN properties p ON p.id = h.property_id
			 ORDER BY h.created_at DESC`
		)
		.all() as HoaWithPropertyRow[];
	return rows.map(mapHoaWithProperty);
}

export function getHoa(id: string): Hoa | null {
	const row = getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas WHERE id = ?`).get(id) as Hoa | undefined;
	return row ?? null;
}

/**
 * Liegenschaften, die noch keiner WEG zugeordnet sind (1:1-Beziehung über
 * hoas.property_id) - Auswahl im Anlegen-Dialog, alphabetisch sortiert.
 */
export function listAvailablePropertiesForHoa(): Property[] {
	return getDb()
		.prepare(
			`SELECT id, name, street, zip_code AS zipCode, city, country, notes,
				created_at AS createdAt, updated_at AS updatedAt
			 FROM properties
			 WHERE id NOT IN (SELECT property_id FROM hoas)
			 ORDER BY name ASC`
		)
		.all() as Property[];
}

export function createHoa(input: HoaInput): Hoa {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO hoas (id, property_id, name, total_shares, bank_iban, bank_bic, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.propertyId, input.name, input.totalShares, input.bankIban, input.bankBic, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateHoa(id: string, input: HoaInput): void {
	getDb()
		.prepare(
			`UPDATE hoas
			 SET property_id = ?, name = ?, total_shares = ?, bank_iban = ?, bank_bic = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.propertyId, input.name, input.totalShares, input.bankIban, input.bankBic, input.notes, now(), id);
}

export function deleteHoa(id: string): void {
	getDb().prepare("DELETE FROM hoas WHERE id = ?").run(id);
}

// ------------------------------------------------------------
// Querschnitts-Abfragen für die WEG-Listenansicht
// ------------------------------------------------------------

export interface HoaStats {
	units: number;
	ownerships: number;
}

/**
 * Verknüpfungs-Zähler je WEG für die Listenansicht (Einheiten der
 * Liegenschaft, Eigentumsverhältnisse über alle Einheiten hinweg).
 * Bewusst als eine Aggregat-Funktion gebündelt (Muster wie getPropertyStats
 * in src/data/properties.ts) - Aufrufer: src/app/(app)/weg/page.tsx.
 */
export function getHoaStats(): Map<string, HoaStats> {
	const rows = getDb()
		.prepare(
			`SELECT h.id AS hoaId,
				(SELECT COUNT(*) FROM units u WHERE u.property_id = h.property_id) AS units,
				(SELECT COUNT(*) FROM unit_ownerships uo
				 JOIN units u2 ON u2.id = uo.unit_id
				 WHERE u2.property_id = h.property_id) AS ownerships
			 FROM hoas h`
		)
		.all() as { hoaId: string; units: number; ownerships: number }[];

	const stats = new Map<string, HoaStats>();
	for (const row of rows) {
		stats.set(row.hoaId, { units: row.units, ownerships: row.ownerships });
	}
	return stats;
}
