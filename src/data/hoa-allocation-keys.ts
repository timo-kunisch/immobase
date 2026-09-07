import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { HoaCustomAllocationKey, HoaCustomAllocationKeyWeight, Unit } from "./types";

/**
 * Repository für frei definierbare Verteilerschlüssel (Tabellen
 * `hoa_custom_allocation_keys` + `hoa_custom_allocation_key_weights`,
 * allocationKey "CUSTOM") sowie die Einheiten-Abfrage für den
 * Gewichte-Dialog. Konventionen siehe src/data/properties.ts.
 */

const KEY_COLUMNS = `
	id, hoa_id AS hoaId, label, notes, created_at AS createdAt, updated_at AS updatedAt
`;

const WEIGHT_COLUMNS = `
	id, custom_allocation_key_id AS customAllocationKeyId, unit_id AS unitId,
	weight, created_at AS createdAt, updated_at AS updatedAt
`;

export interface CustomAllocationKeyInput {
	hoaId: string;
	label: string;
	notes: string | null;
}

/** Verteilerschlüssel inkl. seiner Gewichte je Einheit. */
export interface CustomAllocationKeyWithWeights extends HoaCustomAllocationKey {
	weights: HoaCustomAllocationKeyWeight[];
}

/** Alle Verteilerschlüssel einer WEG inkl. Gewichte (Seite /weg/verteilerschluessel). */
export function listCustomAllocationKeysWithWeights(hoaId: string): CustomAllocationKeyWithWeights[] {
	const db = getDb();
	const keys = db
		.prepare(`SELECT ${KEY_COLUMNS} FROM hoa_custom_allocation_keys WHERE hoa_id = ? ORDER BY created_at ASC`)
		.all(hoaId) as HoaCustomAllocationKey[];
	if (keys.length === 0) return [];

	const weights = db
		.prepare(
			`SELECT ${WEIGHT_COLUMNS} FROM hoa_custom_allocation_key_weights
			 WHERE custom_allocation_key_id IN (SELECT id FROM hoa_custom_allocation_keys WHERE hoa_id = ?)
			 ORDER BY created_at ASC`
		)
		.all(hoaId) as HoaCustomAllocationKeyWeight[];

	const weightsByKey = new Map<string, HoaCustomAllocationKeyWeight[]>();
	for (const weight of weights) {
		const list = weightsByKey.get(weight.customAllocationKeyId) ?? [];
		list.push(weight);
		weightsByKey.set(weight.customAllocationKeyId, list);
	}

	return keys.map((key) => ({ ...key, weights: weightsByKey.get(key.id) ?? [] }));
}

/**
 * Einheiten der Liegenschaft einer WEG, sortiert nach Bezeichnung -
 * Auswahl/Tabellengrundlage des Gewichte-Dialogs (Seite
 * /weg/verteilerschluessel).
 */
export function listUnitsForHoa(hoaId: string): Unit[] {
	return getDb()
		.prepare(
			`SELECT u.id, u.property_id AS propertyId, u.label, u.living_space AS livingSpace, u.rooms,
				u.floor, u.co_ownership_share AS coOwnershipShare,
				u.created_at AS createdAt, u.updated_at AS updatedAt
			 FROM units u
			 JOIN hoas h ON h.property_id = u.property_id
			 WHERE h.id = ?
			 ORDER BY u.label ASC`
		)
		.all(hoaId) as Unit[];
}

export function createCustomAllocationKey(input: CustomAllocationKeyInput): HoaCustomAllocationKey {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO hoa_custom_allocation_keys (id, hoa_id, label, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.hoaId, input.label, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

/** Aktualisiert Bezeichnung/Notizen (hoaId eines Schlüssels ist unveränderlich). */
export function updateCustomAllocationKey(id: string, input: { label: string; notes: string | null }): void {
	getDb()
		.prepare("UPDATE hoa_custom_allocation_keys SET label = ?, notes = ?, updated_at = ? WHERE id = ?")
		.run(input.label, input.notes, now(), id);
}

export function deleteCustomAllocationKey(id: string): void {
	getDb().prepare("DELETE FROM hoa_custom_allocation_keys WHERE id = ?").run(id);
}

/**
 * Upsert des Gewichts einer Einheit für einen Verteilerschlüssel (Unique-
 * Index auf custom_allocation_key_id + unit_id).
 */
export function upsertCustomAllocationKeyWeight(customAllocationKeyId: string, unitId: string, weight: number): void {
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO hoa_custom_allocation_key_weights (id, custom_allocation_key_id, unit_id, weight, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (custom_allocation_key_id, unit_id)
			 DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at`
		)
		.run(newId(), customAllocationKeyId, unitId, weight, timestamp, timestamp);
}
