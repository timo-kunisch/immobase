import {
	listGeneratedDocumentOverviewRows,
	listTenantStatementOverviewRows,
	listUploadedDocumentOverviewRows,
} from "@/data/documents";
import type { DocumentType } from "@/data/types";

/**
 * Vereinheitlichte Sicht auf ALLE drei Datei-Quellen der App - hochgeladene
 * DMS-Dokumente (`documents`), generierte Vorlagen-Schreiben
 * (`generated_documents`) und versandfertige Nebenkostenabrechnungs-PDFs
 * (`tenant_statements.pdfPath`) - für die zentrale Übersicht unter
 * /dokumente. Analog zum polymorphen Muster von
 * src/lib/postal-shipments.ts (sourceType/sourceId), hier aber für die
 * *Anzeige* aller Dateien statt für den Postversand-Log.
 *
 * Der Datenzugriff (Joins + strukturelle Filter) liegt vollständig im
 * Repository src/data/documents.ts; hier werden die drei Ergebnismengen nur
 * noch auf ein gemeinsames Anzeigeformat gemappt, per Volltextsuche
 * gefiltert und gemeinsam sortiert - für dieses kleine, interne Tool
 * unproblematisch (keine paginierten Massenmengen zu erwarten).
 */

export type DocumentSourceType = "DOCUMENT" | "GENERATED_DOCUMENT" | "TENANT_STATEMENT";

type LinkedEntity = { id: string; label: string };

export type UnifiedDocument = {
	id: string;
	sourceType: DocumentSourceType;
	fileName: string;
	filePath: string;
	mimeType: string | null;
	fileSize: number | null;
	createdAt: string;
	/** Nur bei sourceType "DOCUMENT" gesetzt (CONTRACT/INVOICE/FLOORPLAN/OTHER). */
	documentType: DocumentType | null;
	property: LinkedEntity | null;
	unit: LinkedEntity | null;
	tenant: LinkedEntity | null;
};

export type DocumentOverviewFilters = {
	propertyId?: string;
	unitId?: string;
	tenantId?: string;
	/** Freitextsuche über Dateiname, OCR-Text (nur DOCUMENT) sowie Property-/Unit-/Mieter-Namen. */
	search?: string;
};

/** Spalten-Shape der verknüpften Stammdaten in den Übersichts-Zeilen aus src/data/documents.ts. */
type LinkedColumns = {
	propertyId: string | null;
	propertyName: string | null;
	unitId: string | null;
	unitLabel: string | null;
	tenantId: string | null;
	tenantFirstName: string | null;
	tenantLastName: string | null;
};

const toLinkedEntity = (id: string | null, label: string | null): LinkedEntity | null =>
	id !== null && label !== null ? { id, label } : null;

const toTenantEntity = (row: LinkedColumns): LinkedEntity | null =>
	row.tenantId !== null && row.tenantFirstName !== null && row.tenantLastName !== null
		? { id: row.tenantId, label: `${row.tenantFirstName} ${row.tenantLastName}` }
		: null;

const tenantName = (row: LinkedColumns): string | null => toTenantEntity(row)?.label ?? null;

export async function loadUnifiedDocuments(filters: DocumentOverviewFilters = {}): Promise<UnifiedDocument[]> {
	const { propertyId, unitId, tenantId, search } = filters;
	const structuralFilters = { propertyId, unitId, tenantId };

	// Alle drei Quellen vollständig laden (strukturelle Filter bereits auf DB-Ebene).
	const uploadedDocumentRows = listUploadedDocumentOverviewRows(structuralFilters);
	const generatedDocumentRows = listGeneratedDocumentOverviewRows(structuralFilters);
	const tenantStatementRows = listTenantStatementOverviewRows(structuralFilters);

	let unified: (UnifiedDocument & { searchHaystack: string })[] = [
		...uploadedDocumentRows.map((row) => {
			const haystack = [row.fileName, row.ocrText, row.propertyName, row.unitLabel, tenantName(row)].filter(Boolean).join(" ").toLowerCase();
			return {
				id: row.id,
				sourceType: "DOCUMENT" as const,
				fileName: row.fileName,
				filePath: row.filePath,
				mimeType: row.mimeType,
				fileSize: row.fileSize,
				createdAt: row.createdAt,
				documentType: row.type,
				property: toLinkedEntity(row.propertyId, row.propertyName),
				unit: toLinkedEntity(row.unitId, row.unitLabel),
				tenant: toTenantEntity(row),
				searchHaystack: haystack,
			};
		}),
		...generatedDocumentRows.map((row) => {
			const fileName = `${row.subject || row.templateTitle}.pdf`;
			const haystack = [fileName, row.templateTitle, row.propertyName, row.unitLabel, tenantName(row)].filter(Boolean).join(" ").toLowerCase();
			return {
				id: row.id,
				sourceType: "GENERATED_DOCUMENT" as const,
				fileName,
				filePath: row.filePath,
				mimeType: "application/pdf",
				fileSize: row.fileSize,
				createdAt: row.createdAt,
				documentType: null,
				property: toLinkedEntity(row.propertyId, row.propertyName),
				unit: toLinkedEntity(row.unitId, row.unitLabel),
				tenant: toTenantEntity(row),
				searchHaystack: haystack,
			};
		}),
		...tenantStatementRows.map((row) => {
			const fileName = `Nebenkostenabrechnung ${row.propertyName ?? ""} ${tenantName(row) ?? ""}.pdf`.replace(/\s+/g, " ").trim();
			const haystack = [fileName, row.propertyName, row.unitLabel, tenantName(row)].filter(Boolean).join(" ").toLowerCase();
			return {
				id: row.id,
				sourceType: "TENANT_STATEMENT" as const,
				fileName,
				filePath: row.pdfPath,
				mimeType: "application/pdf",
				fileSize: row.pdfFileSize,
				createdAt: row.pdfGeneratedAt ?? row.periodTo ?? "",
				documentType: null,
				property: toLinkedEntity(row.propertyId, row.propertyName),
				unit: toLinkedEntity(row.unitId, row.unitLabel),
				tenant: toTenantEntity(row),
				searchHaystack: haystack,
			};
		}),
	];

	if (search) {
		const needle = search.trim().toLowerCase();
		if (needle) {
			unified = unified.filter((row) => row.searchHaystack.includes(needle));
		}
	}

	unified.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

	return unified.map(({ searchHaystack, ...row }) => {
		void searchHaystack;
		return row;
	});
}
