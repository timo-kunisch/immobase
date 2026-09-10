import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { CustomAllocationKey, CustomAllocationKeyWeight } from "./types";

/**
 * Repository für frei definierbare Umlageschlüssel der Nebenkostenabrechnung
 * (Tabellen `custom_allocation_keys` +
 * `custom_allocation_key_weights`, allocationKey "CUSTOM") - Muster der
 * WEG-Verwaltung (src/data/hoa-allocation-keys.ts), liegenschaftsbezogen.
 * Konventionen siehe src/data/properties.ts.
 */

const KEY_COLUMNS = `
	id, property_id AS propertyId, label, notes, created_at AS createdAt, updated_at AS updatedAt
`;

const WEIGHT_COLUMNS = `
	id, custom_allocation_key_id AS customAllocationKeyId, unit_id AS unitId,
	weight, created_at AS createdAt, updated_at AS updatedAt
`;

export interface CustomAllocationKeyInput {
	propertyId: string;
	label: string;
	notes: string | null;
}

/** Umlageschlüssel inkl. seiner Gewichte je Einheit. */
export interface CustomAllocationKeyWithWeights extends CustomAllocationKey {
	weights: CustomAllocationKeyWeight[];
}

/** Alle frei definierbaren Umlageschlüssel einer Liegenschaft inkl. Gewichte. */
export function listCustomAllocationKeysWithWeights(propertyId: string): CustomAllocationKeyWithWeights[] {
	const db = getDb();
	const keys = db
		.prepare(`SELECT ${KEY_COLUMNS} FROM custom_allocation_keys WHERE property_id = ? ORDER BY created_at ASC`)
		.all(propertyId) as CustomAllocationKey[];
	if (keys.length === 0) return [];

	const weights = db
		.prepare(
			`SELECT ${WEIGHT_COLUMNS} FROM custom_allocation_key_weights
			 WHERE custom_allocation_key_id IN (SELECT id FROM custom_allocation_keys WHERE property_id = ?)
			 ORDER BY created_at ASC`
		)
		.all(propertyId) as CustomAllocationKeyWeight[];

	const weightsByKey = new Map<string, CustomAllocationKeyWeight[]>();
	for (const weight of weights) {
		const list = weightsByKey.get(weight.customAllocationKeyId) ?? [];
		list.push(weight);
		weightsByKey.set(weight.customAllocationKeyId, list);
	}

	return keys.map((key) => ({ ...key, weights: weightsByKey.get(key.id) ?? [] }));
}

export function getCustomAllocationKey(id: string): CustomAllocationKey | null {
	const row = getDb().prepare(`SELECT ${KEY_COLUMNS} FROM custom_allocation_keys WHERE id = ?`).get(id) as
		| CustomAllocationKey
		| undefined;
	return row ?? null;
}

export function createCustomAllocationKey(input: CustomAllocationKeyInput): CustomAllocationKey {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO custom_allocation_keys (id, property_id, label, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.propertyId, input.label, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

/** Aktualisiert Bezeichnung/Notizen (propertyId eines Schlüssels ist unveränderlich). */
export function updateCustomAllocationKey(id: string, input: { label: string; notes: string | null }): void {
	getDb()
		.prepare("UPDATE custom_allocation_keys SET label = ?, notes = ?, updated_at = ? WHERE id = ?")
		.run(input.label, input.notes, now(), id);
}

export function deleteCustomAllocationKey(id: string): void {
	getDb().prepare("DELETE FROM custom_allocation_keys WHERE id = ?").run(id);
}

/**
 * Upsert des Gewichts einer Einheit für einen Umlageschlüssel (Unique-Index
 * auf custom_allocation_key_id + unit_id).
 */
export function upsertCustomAllocationKeyWeight(customAllocationKeyId: string, unitId: string, weight: number): void {
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO custom_allocation_key_weights (id, custom_allocation_key_id, unit_id, weight, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (custom_allocation_key_id, unit_id)
			 DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at`
		)
		.run(newId(), customAllocationKeyId, unitId, weight, timestamp, timestamp);
}

/** Gewichtszeilen der übergebenen Umlageschlüssel (Batch-Lesezugriff). */
export function listCustomAllocationKeyWeightRows(customAllocationKeyIds: string[]): CustomAllocationKeyWeight[] {
	if (customAllocationKeyIds.length === 0) return [];
	const placeholders = customAllocationKeyIds.map(() => "?").join(", ");
	return getDb()
		.prepare(
			`SELECT ${WEIGHT_COLUMNS} FROM custom_allocation_key_weights
			 WHERE custom_allocation_key_id IN (${placeholders})`
		)
		.all(...customAllocationKeyIds) as CustomAllocationKeyWeight[];
}

/**
 * Löst die Gewichte der übergebenen Umlageschlüssel in der Form auf, die die
 * Berechnung (BillingCostItemInput.customAllocationWeights in
 * src/lib/billing.ts) erwartet - geteilte Grundlage der Live-Vorschau und
 * der Finalisierung (Server Action + MCP-Werkzeug, identische Berechnung).
 */
export function buildCustomAllocationWeightsByKey(customAllocationKeyIds: string[]): Map<string, { unitId: string; weight: number }[]> {
	const weightsByKey = new Map<string, { unitId: string; weight: number }[]>();
	if (customAllocationKeyIds.length === 0) return weightsByKey;
	for (const weight of listCustomAllocationKeyWeightRows(customAllocationKeyIds)) {
		const list = weightsByKey.get(weight.customAllocationKeyId) ?? [];
		list.push({ unitId: weight.unitId, weight: weight.weight });
		weightsByKey.set(weight.customAllocationKeyId, list);
	}
	return weightsByKey;
}
