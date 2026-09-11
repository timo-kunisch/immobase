import { getDb } from "./db";
import { newId, now } from "./helpers";
import type {
	DocumentTemplate,
	DocumentTemplateCategory,
	GeneratedDocument,
	Lease,
	Property,
	RentAdjustment,
	Tenant,
	Unit,
} from "./types";

/**
 * Repository für Dokumentvorlagen (Tabelle `document_templates`) und die
 * daraus erzeugten Schreiben (Tabelle `generated_documents`).
 *
 * Enthält außerdem die für die Platzhalter-Auflösung benötigten
 * domänenübergreifenden Lesezugriffe (Mietvertrag inkl. Mieter, Einheit,
 * Liegenschaft und Mietanpassungen) - die eigentliche Ersetzungslogik liegt
 * weiterhin in src/lib/templates.ts, hier ist ausschließlich der Datenzugriff.
 *
 * Hinweis: `generated_documents` hat bewusst KEIN updated_at (eingefrorene,
 * unveränderliche Dokumente) - createGeneratedDocument setzt daher nur id
 * und created_at.
 */

const TEMPLATE_COLUMNS = `
	id, title, category, subject, body,
	created_at AS createdAt, updated_at AS updatedAt
`;

const GENERATED_DOCUMENT_COLUMNS = `
	id, template_id AS templateId, template_title AS templateTitle,
	lease_id AS leaseId, tenant_id AS tenantId, subject,
	rendered_body AS renderedBody, file_path AS filePath, file_size AS fileSize,
	created_at AS createdAt, deleted_at AS deletedAt
`;

/** Dasselbe wie GENERATED_DOCUMENT_COLUMNS, aber mit Tabellen-Alias "d" qualifiziert (für JOINs). */
const GENERATED_DOCUMENT_COLUMNS_QUALIFIED = `
	d.id, d.template_id AS templateId, d.template_title AS templateTitle,
	d.lease_id AS leaseId, d.tenant_id AS tenantId, d.subject,
	d.rendered_body AS renderedBody, d.file_path AS filePath, d.file_size AS fileSize,
	d.created_at AS createdAt, d.deleted_at AS deletedAt
`;

// ------------------------------------------------------------
// Dokumentvorlagen (DocumentTemplate)
// ------------------------------------------------------------

export interface DocumentTemplateInput {
	title: string;
	category: DocumentTemplateCategory;
	subject: string | null;
	body: string;
}

export function listDocumentTemplates(): DocumentTemplate[] {
	return getDb()
		.prepare(`SELECT ${TEMPLATE_COLUMNS} FROM document_templates ORDER BY created_at DESC`)
		.all() as DocumentTemplate[];
}

export function getDocumentTemplate(id: string): DocumentTemplate | null {
	const row = getDb().prepare(`SELECT ${TEMPLATE_COLUMNS} FROM document_templates WHERE id = ?`).get(id) as
		| DocumentTemplate
		| undefined;
	return row ?? null;
}

export function createDocumentTemplate(input: DocumentTemplateInput): DocumentTemplate {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO document_templates (id, title, category, subject, body, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.title, input.category, input.subject, input.body, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateDocumentTemplate(id: string, input: DocumentTemplateInput): void {
	getDb()
		.prepare(
			`UPDATE document_templates
			 SET title = ?, category = ?, subject = ?, body = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.title, input.category, input.subject, input.body, now(), id);
}

export function deleteDocumentTemplate(id: string): void {
	getDb().prepare("DELETE FROM document_templates WHERE id = ?").run(id);
}

/**
 * Anzahl erzeugter Schreiben je Vorlage für die Listenansicht.
 * Einträge ohne Vorlagen-Bezug (template_id IS NULL, nach Löschen der
 * Vorlage via ON DELETE SET NULL) werden nicht mitgezählt.
 */
export function getGeneratedDocumentCountsByTemplate(): Map<string, number> {
	const rows = getDb()
		.prepare(
			"SELECT template_id AS templateId, COUNT(*) AS value FROM generated_documents WHERE deleted_at IS NULL GROUP BY template_id"
		)
		.all() as { templateId: string | null; value: number }[];
	const counts = new Map<string, number>();
	for (const row of rows) {
		if (row.templateId) counts.set(row.templateId, row.value);
	}
	return counts;
}

// ------------------------------------------------------------
// Erzeugte Schreiben (GeneratedDocument)
// ------------------------------------------------------------

/** GeneratedDocument inkl. (optionalem) Mieter-Bezug für die Anzeige. */
export type GeneratedDocumentWithTenant = GeneratedDocument & {
	tenant: { id: string; firstName: string; lastName: string } | null;
};

type GeneratedDocumentJoinRow = GeneratedDocument & {
	tenantRefId: string | null;
	tenantFirstName: string | null;
	tenantLastName: string | null;
};

function mapGeneratedDocumentJoinRow(row: GeneratedDocumentJoinRow): GeneratedDocumentWithTenant {
	const { tenantRefId, tenantFirstName, tenantLastName, ...document } = row;
	return {
		...document,
		tenant: tenantRefId ? { id: tenantRefId, firstName: tenantFirstName!, lastName: tenantLastName! } : null,
	};
}

/** Alle aktiven (nicht im Papierkorb liegenden) Schreiben einer Vorlage, neueste zuerst (Detailansicht der Vorlage). */
export function listGeneratedDocumentsByTemplate(templateId: string): GeneratedDocumentWithTenant[] {
	const rows = getDb()
		.prepare(
			`SELECT ${GENERATED_DOCUMENT_COLUMNS_QUALIFIED},
				t.id AS tenantRefId, t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM generated_documents d
			 LEFT JOIN tenants t ON t.id = d.tenant_id
			 WHERE d.template_id = ? AND d.deleted_at IS NULL
			 ORDER BY d.created_at DESC`
		)
		.all(templateId) as GeneratedDocumentJoinRow[];
	return rows.map(mapGeneratedDocumentJoinRow);
}

export interface GeneratedDocumentFilter {
	tenantId?: string;
	leaseId?: string;
}

/**
 * Aktive (nicht im Papierkorb liegende) Schreiben gefiltert nach Mieter
 * und/oder Vertrag (beide Bedingungen werden UND-verknüpft, Filter-Verlinkung
 * von Mieter-/Vertragsansicht), neueste zuerst. Ohne Filter werden alle
 * aktiven Schreiben geliefert.
 */
export function listGeneratedDocumentsFiltered(filter: GeneratedDocumentFilter): GeneratedDocumentWithTenant[] {
	const conditions: string[] = ["d.deleted_at IS NULL"];
	const params: string[] = [];
	if (filter.tenantId) {
		conditions.push("d.tenant_id = ?");
		params.push(filter.tenantId);
	}
	if (filter.leaseId) {
		conditions.push("d.lease_id = ?");
		params.push(filter.leaseId);
	}
	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const rows = getDb()
		.prepare(
			`SELECT ${GENERATED_DOCUMENT_COLUMNS_QUALIFIED},
				t.id AS tenantRefId, t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM generated_documents d
			 LEFT JOIN tenants t ON t.id = d.tenant_id
			 ${whereClause}
			 ORDER BY d.created_at DESC`
		)
		.all(...params) as GeneratedDocumentJoinRow[];
	return rows.map(mapGeneratedDocumentJoinRow);
}

/** Aktives (nicht im Papierkorb liegendes) Schreiben per ID - Papierkorb-Einträge liefern null. */
export function getGeneratedDocument(id: string): GeneratedDocument | null {
	const row = getDb()
		.prepare(`SELECT ${GENERATED_DOCUMENT_COLUMNS} FROM generated_documents WHERE id = ? AND deleted_at IS NULL`)
		.get(id) as GeneratedDocument | undefined;
	return row ?? null;
}

/** Im Papierkorb liegendes Schreiben per ID (Wiederherstellen/endgültiges Löschen) - aktive liefern null. */
export function getTrashedGeneratedDocument(id: string): GeneratedDocument | null {
	const row = getDb()
		.prepare(`SELECT ${GENERATED_DOCUMENT_COLUMNS} FROM generated_documents WHERE id = ? AND deleted_at IS NOT NULL`)
		.get(id) as GeneratedDocument | undefined;
	return row ?? null;
}

export interface CreateGeneratedDocumentInput {
	templateId: string | null;
	templateTitle: string;
	leaseId: string | null;
	tenantId: string | null;
	subject: string | null;
	renderedBody: string;
	filePath: string;
	fileSize: number | null;
}

export function createGeneratedDocument(input: CreateGeneratedDocumentInput): GeneratedDocument {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO generated_documents
			 (id, template_id, template_title, lease_id, tenant_id, subject, rendered_body, file_path, file_size, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.templateId,
			input.templateTitle,
			input.leaseId,
			input.tenantId,
			input.subject,
			input.renderedBody,
			input.filePath,
			input.fileSize,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, deletedAt: null };
}

/**
 * Verschiebt ein aktives Schreiben in den Papierkorb (Soft-Delete). Die
 * PDF-Datei in der Ablage wird nicht angetastet. Liefert false, wenn das
 * Schreiben nicht (mehr) aktiv ist.
 */
export function trashGeneratedDocument(id: string): boolean {
	const result = getDb()
		.prepare("UPDATE generated_documents SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
		.run(now(), id);
	return result.changes > 0;
}

/** Holt ein Schreiben aus dem Papierkorb zurück (löscht nur den Papierkorb-Marker). */
export function restoreGeneratedDocument(id: string): boolean {
	const result = getDb()
		.prepare("UPDATE generated_documents SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL")
		.run(id);
	return result.changes > 0;
}

/** Endgültiges Löschen der DB-Zeile (Datei in der Ablage muss separat entfernt werden). */
export function deleteGeneratedDocument(id: string): void {
	getDb().prepare("DELETE FROM generated_documents WHERE id = ?").run(id);
}

/**
 * Endgültiges Löschen aller abgelaufenen Papierkorb-Einträge
 * (`deletedAt` älter als der übergebene ISO-Zeitpunkt), atomar in einer
 * Transaktion. Liefert die Ablagepfade der gelöschten Zeilen zurück, damit
 * der Aufrufer die zugehörigen Dateien entfernen kann.
 */
export function deleteExpiredTrashedGeneratedDocuments(cutoffIso: string): { id: string; filePath: string }[] {
	const db = getDb();
	const expired = db
		.prepare(
			`SELECT id, file_path AS filePath FROM generated_documents WHERE deleted_at IS NOT NULL AND deleted_at < ?`
		)
		.all(cutoffIso) as { id: string; filePath: string }[];
	const purge = db.transaction(() => {
		const statement = db.prepare("DELETE FROM generated_documents WHERE id = ?");
		for (const row of expired) statement.run(row.id);
	});
	purge();
	return expired;
}

// ------------------------------------------------------------
// Domänenübergreifende Lesezugriffe für Vorschau/Erzeugung
// ------------------------------------------------------------

const LEASE_COLUMNS = `
	id, unit_id AS unitId, tenant_id AS tenantId, start_date AS startDate, end_date AS endDate,
	cold_rent AS coldRent, service_charges AS serviceCharges,
	deposit, notes, created_at AS createdAt, updated_at AS updatedAt
`;

const TENANT_COLUMNS = `
	id, first_name AS firstName, last_name AS lastName,
	street, zip_code AS zipCode, city, country,
	email, phone, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_COLUMNS = `
	id, property_id AS propertyId, label, living_space AS livingSpace, rooms, floor,
	co_ownership_share AS coOwnershipShare, created_at AS createdAt, updated_at AS updatedAt
`;

const PROPERTY_COLUMNS = `
	id, name, street, zip_code AS zipCode, city, country, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const RENT_ADJUSTMENT_COLUMNS = `
	id, lease_id AS leaseId, valid_from AS validFrom, cold_rent AS coldRent, service_charges AS serviceCharges,
	notes, created_at AS createdAt, updated_at AS updatedAt
`;

/**
 * Auswahloptionen für die Vertragsauswahl im Erzeugen-Dialog: bewusst nur
 * die für die Anzeige benötigten Felder (kein voller Datensatz an die
 * Client Component), sortiert nach Mietbeginn absteigend.
 */
export interface LeaseOption {
	id: string;
	tenant: { firstName: string; lastName: string };
	unit: { label: string; property: { name: string } };
}

export function listLeaseOptions(): LeaseOption[] {
	const rows = getDb()
		.prepare(
			`SELECT
				l.id,
				t.first_name AS tenantFirstName, t.last_name AS tenantLastName,
				u.label AS unitLabel, p.name AS propertyName
			FROM leases l
			JOIN tenants t ON t.id = l.tenant_id
			JOIN units u ON u.id = l.unit_id
			JOIN properties p ON p.id = u.property_id
			ORDER BY l.start_date DESC`
		)
		.all() as { id: string; tenantFirstName: string; tenantLastName: string; unitLabel: string; propertyName: string }[];
	return rows.map((row) => ({
		id: row.id,
		tenant: { firstName: row.tenantFirstName, lastName: row.tenantLastName },
		unit: { label: row.unitLabel, property: { name: row.propertyName } },
	}));
}

/**
 * Vollständiger Platzhalter-Kontext eines Mietvertrags (Vertrag inkl.
 * Mietanpassungen, Mieter, Einheit inkl. Liegenschaft) für das Rendern von
 * Vorlagen - strukturell kompatibel zum TemplateContext in
 * src/lib/templates.ts. Liefert null, wenn der Vertrag (oder einer der per
 * NOT-NULL-FK zwingend verknüpften Datensätze) nicht existiert.
 */
export interface LeaseTemplateContext {
	lease: Lease & { rentAdjustments: RentAdjustment[] };
	tenant: Tenant;
	unit: Unit & { property: Property };
}

export function getLeaseTemplateContext(leaseId: string): LeaseTemplateContext | null {
	const db = getDb();
	const lease = db.prepare(`SELECT ${LEASE_COLUMNS} FROM leases WHERE id = ?`).get(leaseId) as Lease | undefined;
	if (!lease) return null;

	const tenant = db.prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = ?`).get(lease.tenantId) as
		| Tenant
		| undefined;
	const unit = db.prepare(`SELECT ${UNIT_COLUMNS} FROM units WHERE id = ?`).get(lease.unitId) as Unit | undefined;
	const property = unit
		? (db.prepare(`SELECT ${PROPERTY_COLUMNS} FROM properties WHERE id = ?`).get(unit.propertyId) as
				| Property
				| undefined)
		: undefined;
	if (!tenant || !unit || !property) return null;

	const rentAdjustments = db
		.prepare(`SELECT ${RENT_ADJUSTMENT_COLUMNS} FROM rent_adjustments WHERE lease_id = ? ORDER BY valid_from ASC`)
		.all(leaseId) as RentAdjustment[];

	return {
		lease: { ...lease, rentAdjustments },
		tenant,
		unit: { ...unit, property },
	};
}

/** Name des Mieters eines Vertrags (für den Filter-Hinweis in der Listenansicht). */
export function getLeaseTenantName(leaseId: string): { firstName: string; lastName: string } | null {
	const row = getDb()
		.prepare(
			`SELECT t.first_name AS firstName, t.last_name AS lastName
			 FROM leases l
			 JOIN tenants t ON t.id = l.tenant_id
			 WHERE l.id = ?`
		)
		.get(leaseId) as { firstName: string; lastName: string } | undefined;
	return row ?? null;
}
