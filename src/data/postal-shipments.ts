import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { PostalShipment, PostalShipmentMode, PostalShipmentSourceType, PostalShipmentStatus } from "./types";

/**
 * Repository für Postversand-Protokolle (Tabelle `postal_shipments`) sowie
 * die zum Auflösen der polymorphen PDF-Quellen (sourceType/sourceId)
 * benötigten Lesezugriffe auf die jeweiligen Quell-Tabellen.
 *
 * Die fachliche Orchestrierung (PDF laden -> LetterXpress -> protokollieren)
 * liegt weiterhin in src/lib/postal-shipments.ts; hier ist ausschließlich
 * der Datenzugriff.
 */

const SHIPMENT_COLUMNS = `
	id, source_type AS sourceType, source_id AS sourceId,
	external_job_id AS externalJobId, external_status AS externalStatus,
	mode, status, error_message AS errorMessage,
	requested_by_user_id AS requestedByUserId,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface CreatePostalShipmentInput {
	sourceType: PostalShipmentSourceType;
	sourceId: string;
	externalJobId: string | null;
	externalStatus: string | null;
	mode: PostalShipmentMode;
	status: PostalShipmentStatus;
	errorMessage: string | null;
	requestedByUserId: string | null;
}

export function createPostalShipment(input: CreatePostalShipmentInput): PostalShipment {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO postal_shipments
			 (id, source_type, source_id, external_job_id, external_status, mode, status, error_message, requested_by_user_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.sourceType,
			input.sourceId,
			input.externalJobId,
			input.externalStatus,
			input.mode,
			input.status,
			input.errorMessage,
			input.requestedByUserId,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

/** Letzter Versandversuch für eine PDF-Quelle (für die Anzeige in der jeweiligen Ansicht). */
export function getLatestPostalShipmentForSource(sourceType: PostalShipmentSourceType, sourceId: string): PostalShipment | null {
	const row = getDb()
		.prepare(
			`SELECT ${SHIPMENT_COLUMNS} FROM postal_shipments
			 WHERE source_type = ? AND source_id = ?
			 ORDER BY created_at DESC LIMIT 1`
		)
		.get(sourceType, sourceId) as PostalShipment | undefined;
	return row ?? null;
}

/**
 * Löscht die Versand-Protokolle einer PDF-Quelle (wird beim Löschen der
 * Quelle selbst aufgerufen, z. B. Abrechnungs-PDFs einer finalisierten
 * Periode, damit keine Protokolle auf gelöschte Quellen verweisen).
 */
export function deletePostalShipmentsForSource(sourceType: PostalShipmentSourceType, sourceIds: string[]): void {
	if (sourceIds.length === 0) return;
	const placeholders = sourceIds.map(() => "?").join(", ");
	getDb()
		.prepare(`DELETE FROM postal_shipments WHERE source_type = ? AND source_id IN (${placeholders})`)
		.run(sourceType, ...sourceIds);
}

// ------------------------------------------------------------
// Auflösung der polymorphen PDF-Quellen (Lesezugriffe)
// ------------------------------------------------------------

export interface PostalSourceFile {
	filePath: string;
	fileName: string;
}

export function getTenantStatementPdfFile(sourceId: string): PostalSourceFile | null {
	const row = getDb().prepare("SELECT pdf_path AS pdfPath FROM tenant_statements WHERE id = ?").get(sourceId) as
		| { pdfPath: string | null }
		| undefined;
	if (!row?.pdfPath) return null;
	return { filePath: row.pdfPath, fileName: row.pdfPath.split("/").pop() ?? "abrechnung.pdf" };
}

export function getGeneratedDocumentPdfFile(sourceId: string): PostalSourceFile | null {
	const row = getDb()
		.prepare(
			"SELECT file_path AS filePath, subject, template_title AS templateTitle FROM generated_documents WHERE id = ? AND deleted_at IS NULL"
		)
		.get(sourceId) as { filePath: string; subject: string | null; templateTitle: string } | undefined;
	if (!row) return null;
	return { filePath: row.filePath, fileName: `${row.subject || row.templateTitle}.pdf` };
}

export function getDocumentPdfFile(sourceId: string): PostalSourceFile | null {
	const row = getDb()
		.prepare("SELECT file_path AS filePath, file_name AS fileName FROM documents WHERE id = ? AND deleted_at IS NULL")
		.get(sourceId) as { filePath: string; fileName: string } | undefined;
	if (!row) return null;
	return { filePath: row.filePath, fileName: row.fileName };
}

export function getHoaAnnualStatementPdfFile(sourceId: string): PostalSourceFile | null {
	const row = getDb().prepare("SELECT pdf_path AS pdfPath FROM annual_statement_unit_results WHERE id = ?").get(sourceId) as
		| { pdfPath: string | null }
		| undefined;
	if (!row?.pdfPath) return null;
	return { filePath: row.pdfPath, fileName: row.pdfPath.split("/").pop() ?? "weg-abrechnung.pdf" };
}

export function getOwnerMeetingInvitationPdfFile(sourceId: string): PostalSourceFile | null {
	const row = getDb()
		.prepare("SELECT invitation_pdf_path AS pdfPath, title FROM owner_meetings WHERE id = ?")
		.get(sourceId) as { pdfPath: string | null; title: string } | undefined;
	if (!row?.pdfPath) return null;
	return { filePath: row.pdfPath, fileName: `Einladung ${row.title}.pdf` };
}

export function getOwnerMeetingMinutesPdfFile(sourceId: string): PostalSourceFile | null {
	const row = getDb().prepare("SELECT minutes_pdf_path AS pdfPath, title FROM owner_meetings WHERE id = ?").get(sourceId) as
		| { pdfPath: string | null; title: string }
		| undefined;
	if (!row?.pdfPath) return null;
	return { filePath: row.pdfPath, fileName: `Protokoll ${row.title}.pdf` };
}
