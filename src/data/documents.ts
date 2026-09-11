import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { DocumentRecord, DocumentType, Tenant, Unit } from "./types";

/**
 * Repository für das Dokumentenmanagement (DMS, Tabelle `documents`) sowie
 * die SQL-Abfragen für die vereinheitlichte Datei-Übersicht unter /dokumente
 * (hochgeladene Dokumente, generierte Vorlagen-Schreiben, versandfertige
 * Nebenkostenabrechnungs-PDFs und versandfertige WEG-Einzelabrechnungs-PDFs
 * - das Mapping auf das gemeinsame Anzeigeformat inkl. Volltextsuche liegt
 * in src/lib/documents-overview.ts).
 *
 * Enthält außerdem die für Auswahl/Filter benötigten Lesezugriffe auf die
 * verknüpften Stammdaten (units/tenants haben noch kein eigenes Repository,
 * daher hier als eigene Abfragen).
 */

const DOCUMENT_COLUMNS = `
	id, property_id AS propertyId, unit_id AS unitId, tenant_id AS tenantId,
	type, file_name AS fileName, file_path AS filePath, mime_type AS mimeType,
	file_size AS fileSize, ocr_text AS ocrText,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_COLUMNS = `
	id, property_id AS propertyId, label, living_space AS livingSpace,
	rooms, floor, co_ownership_share AS coOwnershipShare,
	created_at AS createdAt, updated_at AS updatedAt
`;

const TENANT_COLUMNS = `
	id, first_name AS firstName, last_name AS lastName, email, phone, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface DocumentInput {
	propertyId: string | null;
	unitId: string | null;
	tenantId: string | null;
	type: DocumentType;
	fileName: string;
	filePath: string;
	mimeType: string | null;
	fileSize: number | null;
}

export function getDocument(id: string): DocumentRecord | null {
	const row = getDb().prepare(`SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ?`).get(id) as
		| DocumentRecord
		| undefined;
	return row ?? null;
}

export function createDocument(input: DocumentInput): DocumentRecord {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO documents (id, property_id, unit_id, tenant_id, type, file_name, file_path, mime_type, file_size, ocr_text, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
		)
		.run(
			id,
			input.propertyId,
			input.unitId,
			input.tenantId,
			input.type,
			input.fileName,
			input.filePath,
			input.mimeType,
			input.fileSize,
			timestamp,
			timestamp
		);
	return { id, ...input, ocrText: null, createdAt: timestamp, updatedAt: timestamp };
}

/** Änderbare Felder eines hochgeladenen DMS-Dokuments (Typ + Zuordnungen). */
export interface DocumentUpdateInput {
	propertyId: string | null;
	unitId: string | null;
	tenantId: string | null;
	type: DocumentType;
}

/**
 * Aktualisiert Dokumententyp und Zuordnungen eines hochgeladenen Dokuments -
 * die Datei-Attribute (Name, Ablagepfad, Größe, OCR-Text) bleiben unberührt.
 */
export function updateDocument(id: string, input: DocumentUpdateInput): void {
	getDb()
		.prepare(
			`UPDATE documents
			 SET property_id = ?, unit_id = ?, tenant_id = ?, type = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.propertyId, input.unitId, input.tenantId, input.type, now(), id);
}

export function deleteDocument(id: string): void {
	getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
}

// ------------------------------------------------------------
// Stammdaten-Zugriffe für Auswahl/Filter der Dokumente-Ansicht
// (units/tenants besitzen noch kein eigenes Repository - daher hier)
// ------------------------------------------------------------

/** Alle Einheiten für die Auswahl im Upload-Dialog, sortiert nach Bezeichnung. */
export function listUnitsByLabel(): Unit[] {
	return getDb().prepare(`SELECT ${UNIT_COLUMNS} FROM units ORDER BY label ASC`).all() as Unit[];
}

/** Alle Mieter für die Auswahl im Upload-Dialog, sortiert nach Nachname. */
export function listTenantsByLastName(): Tenant[] {
	return getDb().prepare(`SELECT ${TENANT_COLUMNS} FROM tenants ORDER BY last_name ASC`).all() as Tenant[];
}

export function getTenant(id: string): Tenant | null {
	const row = getDb().prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = ?`).get(id) as Tenant | undefined;
	return row ?? null;
}

/** Einheit inklusive Liegenschaftsname (für den Filter-Hinweis der Dokumente-Ansicht). */
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

// ------------------------------------------------------------
// Vereinheitlichte Dokumenten-Übersicht (alle drei Datei-Quellen)
// Verbraucher: src/lib/documents-overview.ts
// ------------------------------------------------------------

export interface DocumentOverviewFilters {
	propertyId?: string;
	unitId?: string;
	tenantId?: string;
}

/** Verknüpfte Stammdaten einer Übersichts-Zeile (flach, null = nicht verknüpft). */
interface OverviewLinkedColumns {
	propertyId: string | null;
	propertyName: string | null;
	unitId: string | null;
	unitLabel: string | null;
	tenantId: string | null;
	tenantFirstName: string | null;
	tenantLastName: string | null;
}

/** Übersichts-Zeile eines hochgeladenen DMS-Dokuments (Quelle `documents`). */
export interface UploadedDocumentOverviewRow extends OverviewLinkedColumns {
	id: string;
	type: DocumentType;
	fileName: string;
	filePath: string;
	mimeType: string | null;
	fileSize: number | null;
	ocrText: string | null;
	createdAt: string;
}

/** Übersichts-Zeile eines generierten Vorlagen-Schreibens (Quelle `generated_documents`). */
export interface GeneratedDocumentOverviewRow extends OverviewLinkedColumns {
	id: string;
	subject: string | null;
	templateTitle: string;
	filePath: string;
	fileSize: number | null;
	createdAt: string;
}

/** Übersichts-Zeile eines versandfertigen Abrechnungs-PDFs (Quelle `tenant_statements.pdf_path`). */
export interface TenantStatementOverviewRow extends OverviewLinkedColumns {
	id: string;
	pdfPath: string;
	pdfFileSize: number | null;
	pdfGeneratedAt: string | null;
	periodTo: string | null;
}

/** Übersichts-Zeile eines versandfertigen WEG-Einzelabrechnungs-PDFs (Quelle `annual_statement_unit_results.pdf_path`). */
export interface HoaAnnualStatementOverviewRow extends OverviewLinkedColumns {
	id: string;
	pdfPath: string;
	pdfFileSize: number | null;
	pdfGeneratedAt: string | null;
	periodTo: string | null;
	/** Anzeige-Name des Eigentümers (Eigentümer statt Mieter als Bezugsperson). */
	ownerFirstName: string | null;
	ownerLastName: string | null;
}

function buildOverviewWhere(conditions: string[]): string {
	return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

/**
 * Hochgeladene DMS-Dokumente mit verknüpfter Liegenschaft/Einheit/Mieter.
 * Strukturelle Filter (propertyId/unitId/tenantId) auf DB-Ebene; die
 * Freitextsuche erfolgt wie bisher anwendungsseitig in der lib.
 */
export function listUploadedDocumentOverviewRows(filters: DocumentOverviewFilters): UploadedDocumentOverviewRow[] {
	const conditions: string[] = [];
	const params: string[] = [];
	if (filters.propertyId) {
		conditions.push("d.property_id = ?");
		params.push(filters.propertyId);
	}
	if (filters.unitId) {
		conditions.push("d.unit_id = ?");
		params.push(filters.unitId);
	}
	if (filters.tenantId) {
		conditions.push("d.tenant_id = ?");
		params.push(filters.tenantId);
	}

	return getDb()
		.prepare(
			`SELECT
				d.id AS id, d.type AS type, d.file_name AS fileName, d.file_path AS filePath,
				d.mime_type AS mimeType, d.file_size AS fileSize, d.ocr_text AS ocrText,
				d.created_at AS createdAt,
				p.id AS propertyId, p.name AS propertyName,
				u.id AS unitId, u.label AS unitLabel,
				t.id AS tenantId, t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM documents d
			 LEFT JOIN properties p ON d.property_id = p.id
			 LEFT JOIN units u ON d.unit_id = u.id
			 LEFT JOIN tenants t ON d.tenant_id = t.id
			 ${buildOverviewWhere(conditions)}`
		)
		.all(...params) as UploadedDocumentOverviewRow[];
}

/**
 * Generierte Vorlagen-Schreiben. Liegenschaft/Einheit sind nicht direkt
 * verlinkt, sondern nur über den (optionalen) Mietvertrag ableitbar
 * (lease -> unit -> property).
 */
export function listGeneratedDocumentOverviewRows(filters: DocumentOverviewFilters): GeneratedDocumentOverviewRow[] {
	const conditions: string[] = [];
	const params: string[] = [];
	if (filters.tenantId) {
		conditions.push("gd.tenant_id = ?");
		params.push(filters.tenantId);
	}
	if (filters.unitId) {
		conditions.push("u.id = ?");
		params.push(filters.unitId);
	}
	if (filters.propertyId) {
		conditions.push("p.id = ?");
		params.push(filters.propertyId);
	}

	return getDb()
		.prepare(
			`SELECT
				gd.id AS id, gd.subject AS subject, gd.template_title AS templateTitle,
				gd.file_path AS filePath, gd.file_size AS fileSize, gd.created_at AS createdAt,
				p.id AS propertyId, p.name AS propertyName,
				u.id AS unitId, u.label AS unitLabel,
				t.id AS tenantId, t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM generated_documents gd
			 LEFT JOIN leases l ON gd.lease_id = l.id
			 LEFT JOIN units u ON l.unit_id = u.id
			 LEFT JOIN properties p ON u.property_id = p.id
			 LEFT JOIN tenants t ON gd.tenant_id = t.id
			 ${buildOverviewWhere(conditions)}`
		)
		.all(...params) as GeneratedDocumentOverviewRow[];
}

/**
 * Versandfertige Nebenkostenabrechnungs-PDFs (nur Abrechnungen mit bereits
 * erzeugtem PDF - daher pdf_path IS NOT NULL).
 */
export function listTenantStatementOverviewRows(filters: DocumentOverviewFilters): TenantStatementOverviewRow[] {
	const conditions: string[] = ["ts.pdf_path IS NOT NULL"];
	const params: string[] = [];
	if (filters.tenantId) {
		conditions.push("l.tenant_id = ?");
		params.push(filters.tenantId);
	}
	if (filters.unitId) {
		conditions.push("u.id = ?");
		params.push(filters.unitId);
	}
	if (filters.propertyId) {
		conditions.push("p.id = ?");
		params.push(filters.propertyId);
	}

	return getDb()
		.prepare(
			`SELECT
				ts.id AS id, ts.pdf_path AS pdfPath, ts.pdf_file_size AS pdfFileSize,
				ts.pdf_generated_at AS pdfGeneratedAt, bp.period_to AS periodTo,
				p.id AS propertyId, p.name AS propertyName,
				u.id AS unitId, u.label AS unitLabel,
				t.id AS tenantId, t.first_name AS tenantFirstName, t.last_name AS tenantLastName
			 FROM tenant_statements ts
			 INNER JOIN leases l ON ts.lease_id = l.id
			 LEFT JOIN units u ON l.unit_id = u.id
			 LEFT JOIN properties p ON u.property_id = p.id
			 LEFT JOIN tenants t ON l.tenant_id = t.id
			 LEFT JOIN billing_periods bp ON ts.billing_period_id = bp.id
			 ${buildOverviewWhere(conditions)}`
		)
		.all(...params) as TenantStatementOverviewRow[];
}

/**
 * Versandfertige WEG-Einzelabrechnungs-PDFs (nur Einzelabrechnungen mit
 * bereits erzeugtem PDF - daher pdf_path IS NOT NULL).
 */
export function listHoaAnnualStatementOverviewRows(filters: DocumentOverviewFilters): HoaAnnualStatementOverviewRow[] {
	const conditions: string[] = ["ur.pdf_path IS NOT NULL"];
	const params: string[] = [];
	if (filters.propertyId) {
		conditions.push("p.id = ?");
		params.push(filters.propertyId);
	}
	if (filters.unitId) {
		conditions.push("u.id = ?");
		params.push(filters.unitId);
	}
	if (filters.tenantId) {
		// WEG-Abrechnungen haben keinen Mieter-Bezug - ein Mieter-Filter
		// liefert bewusst keine Treffer.
		conditions.push("1 = 0");
	}

	return getDb()
		.prepare(
			`SELECT
				ur.id AS id, ur.pdf_path AS pdfPath, ur.pdf_file_size AS pdfFileSize,
				ur.pdf_generated_at AS pdfGeneratedAt, s.period_to AS periodTo,
				p.id AS propertyId, p.name AS propertyName,
				u.id AS unitId, u.label AS unitLabel,
				NULL AS tenantId,
				o.first_name AS ownerFirstName, o.last_name AS ownerLastName
			 FROM annual_statement_unit_results ur
			 INNER JOIN annual_statements s ON s.id = ur.annual_statement_id
			 INNER JOIN hoas h ON h.id = s.hoa_id
			 INNER JOIN properties p ON p.id = h.property_id
			 INNER JOIN units u ON u.id = ur.unit_id
			 INNER JOIN owners o ON o.id = ur.owner_id
			 ${buildOverviewWhere(conditions)}`
		)
		.all(...params) as HoaAnnualStatementOverviewRow[];
}
