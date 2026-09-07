import { getDb } from "./db";
import { boolToInt, intToBool, newId, now } from "./helpers";
import type { Owner } from "./types";

/**
 * Repository für Eigentümer (Tabelle `owners`) sowie den
 * Verknüpfungs-Zähler für die Eigentümer-Listenansicht. Konventionen siehe
 * src/data/properties.ts.
 *
 * Besonderheit: `is_company` ist in SQLite ein integer 0/1 und wird hier auf
 * das boolean-Feld `Owner.isCompany` gemappt (intToBool/boolToInt).
 */

const OWNER_COLUMNS = `
	id, first_name AS firstName, last_name AS lastName, is_company AS isCompany,
	company_name AS companyName, street, zip_code AS zipCode, city, country,
	email, phone, notes, created_at AS createdAt, updated_at AS updatedAt
`;

export interface OwnerInput {
	firstName: string;
	lastName: string;
	isCompany: boolean;
	companyName: string | null;
	street: string;
	zipCode: string;
	city: string;
	country: string;
	email: string | null;
	phone: string | null;
	notes: string | null;
}

/** Rohzeile mit isCompany als integer 0/1 (vor dem boolean-Mapping). */
type OwnerRow = Omit<Owner, "isCompany"> & { isCompany: number };

function mapOwner(row: OwnerRow): Owner {
	return { ...row, isCompany: intToBool(row.isCompany) };
}

/** Alle Eigentümer, alphabetisch nach Nachname (Listenansicht /weg/eigentuemer). */
export function listOwners(): Owner[] {
	const rows = getDb().prepare(`SELECT ${OWNER_COLUMNS} FROM owners ORDER BY last_name ASC`).all() as OwnerRow[];
	return rows.map(mapOwner);
}

export function getOwner(id: string): Owner | null {
	const row = getDb().prepare(`SELECT ${OWNER_COLUMNS} FROM owners WHERE id = ?`).get(id) as OwnerRow | undefined;
	return row ? mapOwner(row) : null;
}

export function createOwner(input: OwnerInput): Owner {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO owners
			 (id, first_name, last_name, is_company, company_name, street, zip_code, city, country, email, phone, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.firstName,
			input.lastName,
			boolToInt(input.isCompany),
			input.companyName,
			input.street,
			input.zipCode,
			input.city,
			input.country,
			input.email,
			input.phone,
			input.notes,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateOwner(id: string, input: OwnerInput): void {
	getDb()
		.prepare(
			`UPDATE owners
			 SET first_name = ?, last_name = ?, is_company = ?, company_name = ?, street = ?, zip_code = ?, city = ?,
				country = ?, email = ?, phone = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.firstName,
			input.lastName,
			boolToInt(input.isCompany),
			input.companyName,
			input.street,
			input.zipCode,
			input.city,
			input.country,
			input.email,
			input.phone,
			input.notes,
			now(),
			id
		);
}

export function deleteOwner(id: string): void {
	getDb().prepare("DELETE FROM owners WHERE id = ?").run(id);
}

/**
 * Anzahl der Eigentumsverhältnisse je Eigentümer für die Listenansicht
 * (Verknüpfungs-Badge) - Aufrufer: src/app/(app)/weg/eigentuemer/page.tsx.
 */
export function getOwnershipCountsByOwner(): Map<string, number> {
	const rows = getDb()
		.prepare("SELECT owner_id AS ownerId, COUNT(*) AS value FROM unit_ownerships GROUP BY owner_id")
		.all() as { ownerId: string; value: number }[];
	return new Map(rows.map((row) => [row.ownerId, row.value]));
}
