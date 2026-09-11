import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Tenant } from "./types";

/**
 * Repository für Mieter (Tabelle `tenants`) sowie die für die
 * Mieter-Listenansicht benötigten Aggregat-Abfragen (Verknüpfungs-Zähler).
 * Konventionen siehe src/data/properties.ts.
 */

const TENANT_COLUMNS = `
	id, first_name AS firstName, last_name AS lastName,
	street, zip_code AS zipCode, city, country,
	email, phone, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface TenantInput {
	firstName: string;
	lastName: string;
	/** Postanschrift (optional; null = keine hinterlegt, s. Tenant). */
	street?: string | null;
	zipCode?: string | null;
	city?: string | null;
	country?: string | null;
	email: string | null;
	phone: string | null;
	notes: string | null;
}

export function listTenants(): Tenant[] {
	return getDb()
		.prepare(`SELECT ${TENANT_COLUMNS} FROM tenants ORDER BY created_at DESC`)
		.all() as Tenant[];
}

export function getTenant(id: string): Tenant | null {
	const row = getDb().prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = ?`).get(id) as Tenant | undefined;
	return row ?? null;
}

export function createTenant(input: TenantInput): Tenant {
	const id = newId();
	const timestamp = now();
	const street = input.street ?? null;
	const zipCode = input.zipCode ?? null;
	const city = input.city ?? null;
	const country = input.country ?? null;
	getDb()
		.prepare(
			`INSERT INTO tenants (id, first_name, last_name, street, zip_code, city, country, email, phone, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.firstName, input.lastName, street, zipCode, city, country, input.email, input.phone, input.notes, timestamp, timestamp);
	return { id, ...input, street, zipCode, city, country, createdAt: timestamp, updatedAt: timestamp };
}

export function updateTenant(id: string, input: TenantInput): void {
	getDb()
		.prepare(
			`UPDATE tenants
			 SET first_name = ?, last_name = ?, street = ?, zip_code = ?, city = ?, country = ?,
				 email = ?, phone = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.firstName,
			input.lastName,
			input.street ?? null,
			input.zipCode ?? null,
			input.city ?? null,
			input.country ?? null,
			input.email,
			input.phone,
			input.notes,
			now(),
			id
		);
}

export function deleteTenant(id: string): void {
	getDb().prepare("DELETE FROM tenants WHERE id = ?").run(id);
}

// ------------------------------------------------------------
// Querschnitts-Abfragen für die Mieter-Listenansicht
// ------------------------------------------------------------

export interface TenantStats {
	leases: number;
	documents: number;
	generatedDocuments: number;
}

/**
 * Verknüpfungs-Zähler je Mieter für die Listenansicht (Mietverträge,
 * Dokumente, generierte Schreiben). Bewusst als eine Aggregat-Funktion
 * gebündelt (Muster wie getPropertyStats in src/data/properties.ts) -
 * Aufrufer: src/app/(app)/mieter/page.tsx.
 */
export function getTenantStats(): Map<string, TenantStats> {
	const db = getDb();
	const stats = new Map<string, TenantStats>();
	const ensure = (tenantId: string): TenantStats => {
		let entry = stats.get(tenantId);
		if (!entry) {
			entry = { leases: 0, documents: 0, generatedDocuments: 0 };
			stats.set(tenantId, entry);
		}
		return entry;
	};

	const leaseCounts = db
		.prepare("SELECT tenant_id AS tenantId, COUNT(*) AS value FROM leases GROUP BY tenant_id")
		.all() as { tenantId: string; value: number }[];
	for (const row of leaseCounts) ensure(row.tenantId).leases = row.value;

	const documentCounts = db
		.prepare("SELECT tenant_id AS tenantId, COUNT(*) AS value FROM documents WHERE deleted_at IS NULL GROUP BY tenant_id")
		.all() as { tenantId: string | null; value: number }[];
	for (const row of documentCounts) {
		if (row.tenantId) ensure(row.tenantId).documents = row.value;
	}

	const generatedDocumentCounts = db
		.prepare("SELECT tenant_id AS tenantId, COUNT(*) AS value FROM generated_documents WHERE deleted_at IS NULL GROUP BY tenant_id")
		.all() as { tenantId: string | null; value: number }[];
	for (const row of generatedDocumentCounts) {
		if (row.tenantId) ensure(row.tenantId).generatedDocuments = row.value;
	}

	return stats;
}
