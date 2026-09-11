import {
	deleteExpiredTrashedDocuments,
	listTrashedGeneratedDocumentOverviewRows,
	listTrashedUploadedDocumentOverviewRows,
} from "@/data/documents";
import { deleteExpiredTrashedGeneratedDocuments } from "@/data/templates";
import type { DocumentType } from "@/data/types";
import { deleteUploadedFile } from "@/lib/storage";

/**
 * Papierkorb für Dokumente (/dokumente?trash=1): Gelöschte hochgeladene
 * DMS-Dokumente und erzeugte Vorlagen-Schreiben bleiben mit ihrem
 * Ablagepfad erhalten und können wiederhergestellt werden. Nach Ablauf
 * der Aufbewahrungsfrist (28 Tage ab Verschieben in den Papierkorb)
 * werden sie automatisch endgültig gelöscht - DB-Zeile UND Datei in der
 * Ablage - durch einen Scheduler (Muster wie der IMAP-/Dropbox-Scheduler,
 * Start im geschützten App-Layout) sowie zusätzlich beim Aufruf der
 * Papierkorb-Ansicht, damit die Frist auch bei selten geöffneter App
 * zuverlässig greift.
 */

/** Aufbewahrungsfrist des Dokumenten-Papierkorbs in Tagen. */
export const DOCUMENT_TRASH_RETENTION_DAYS = 28;

const RETENTION_MS = DOCUMENT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * ISO-Zeitpunkt, vor dem ein Papierkorb-Eintrag als abgelaufen gilt:
 * `now` minus Aufbewahrungsfrist. Eintrag gilt als abgelaufen, wenn sein
 * `deletedAt` strikt davor liegt ("länger als 28 Tage im Papierkorb").
 */
export function trashCutoff(now: Date = new Date()): string {
	return new Date(now.getTime() - RETENTION_MS).toISOString();
}

/** Quellen des Papierkorbs (die beiden löschbaren Datei-Quellen der /dokumente-Übersicht). */
export type TrashedDocumentSourceType = "DOCUMENT" | "GENERATED_DOCUMENT";

/** Zeile der Papierkorb-Tabelle: vollständig serialisierbar (Client-Prop). */
export type TrashedDocumentRow = {
	id: string;
	sourceType: TrashedDocumentSourceType;
	fileName: string;
	filePath: string;
	fileSize: number | null;
	/** Nur bei sourceType "DOCUMENT" gesetzt (CONTRACT/INVOICE/FLOORPLAN/OTHER). */
	documentType: DocumentType | null;
	deletedAt: string;
	/** ISO-Datum der automatischen endgültigen Löschung (deletedAt + Aufbewahrungsfrist). */
	permanentDeleteAt: string;
	property: { id: string; label: string } | null;
	unit: { id: string; label: string } | null;
	tenant: { id: string; label: string } | null;
};

type LinkedColumns = {
	propertyId: string | null;
	propertyName: string | null;
	unitId: string | null;
	unitLabel: string | null;
	tenantId: string | null;
	tenantFirstName: string | null;
	tenantLastName: string | null;
};

function toLinkedEntity(id: string | null, label: string | null): { id: string; label: string } | null {
	return id !== null && label !== null ? { id, label } : null;
}

function toTenantEntity(row: LinkedColumns): { id: string; label: string } | null {
	return row.tenantId !== null && row.tenantFirstName !== null && row.tenantLastName !== null
		? { id: row.tenantId, label: `${row.tenantFirstName} ${row.tenantLastName}` }
		: null;
}

function permanentDeleteAt(deletedAt: string): string {
	return new Date(Date.parse(deletedAt) + RETENTION_MS).toISOString();
}

/**
 * Alle Papierkorb-Einträge beider Quellen im gemeinsamen Anzeigeformat,
 * zuletzt gelöscht zuerst. Das Mapping folgt bewusst dem Muster von
 * loadUnifiedDocuments() in src/lib/documents-overview.ts.
 */
export function loadTrashedDocuments(): TrashedDocumentRow[] {
	const uploaded = listTrashedUploadedDocumentOverviewRows().map((row) => ({
		id: row.id,
		sourceType: "DOCUMENT" as const,
		fileName: row.fileName,
		filePath: row.filePath,
		fileSize: row.fileSize,
		documentType: row.type,
		deletedAt: row.deletedAt,
		permanentDeleteAt: permanentDeleteAt(row.deletedAt),
		property: toLinkedEntity(row.propertyId, row.propertyName),
		unit: toLinkedEntity(row.unitId, row.unitLabel),
		tenant: toTenantEntity(row),
	}));

	const generated = listTrashedGeneratedDocumentOverviewRows().map((row) => ({
		id: row.id,
		sourceType: "GENERATED_DOCUMENT" as const,
		fileName: `${row.subject || row.templateTitle}.pdf`,
		filePath: row.filePath,
		fileSize: row.fileSize,
		documentType: null,
		deletedAt: row.deletedAt,
		permanentDeleteAt: permanentDeleteAt(row.deletedAt),
		property: toLinkedEntity(row.propertyId, row.propertyName),
		unit: toLinkedEntity(row.unitId, row.unitLabel),
		tenant: toTenantEntity(row),
	}));

	return [...uploaded, ...generated].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0));
}

/**
 * Löscht alle abgelaufenen Papierkorb-Einträge endgültig: zuerst die
 * DB-Zeilen (je Quelle atomar in einer Transaktion), danach die Dateien
 * aus der Ablage (Fehler dabei werden von deleteUploadedFile nur geloggt
 * und hinterlassen einen harmlosen Datei-Rest ohne DB-Verweis).
 */
export async function purgeExpiredDocuments(now: Date = new Date()): Promise<{ documents: number; generatedDocuments: number }> {
	const cutoff = trashCutoff(now);
	const expiredDocuments = deleteExpiredTrashedDocuments(cutoff);
	const expiredGeneratedDocuments = deleteExpiredTrashedGeneratedDocuments(cutoff);

	for (const row of [...expiredDocuments, ...expiredGeneratedDocuments]) {
		await deleteUploadedFile(row.filePath);
	}

	if (expiredDocuments.length > 0 || expiredGeneratedDocuments.length > 0) {
		console.info(
			`Papierkorb: ${expiredDocuments.length + expiredGeneratedDocuments.length} Dokument(e) nach Ablauf der ` +
				`Aufbewahrungsfrist (${DOCUMENT_TRASH_RETENTION_DAYS} Tage) endgültig gelöscht.`
		);
	}

	return { documents: expiredDocuments.length, generatedDocuments: expiredGeneratedDocuments.length };
}

// ------------------------------------------------------------
// Scheduler für die automatische Endlöschung
// ------------------------------------------------------------

const SCHEDULER_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SCHEDULER_INITIAL_DELAY_MS = 30 * 1000;

let schedulerTimer: NodeJS.Timeout | null = null;

export function startDocumentTrashPurgeScheduler(): void {
	if (schedulerTimer) return;
	schedulerTimer = setInterval(() => {
		void maybePurgeExpiredDocuments();
	}, SCHEDULER_CHECK_INTERVAL_MS);
	schedulerTimer.unref();
	const initial = setTimeout(() => {
		void maybePurgeExpiredDocuments();
	}, SCHEDULER_INITIAL_DELAY_MS);
	initial.unref();
}

export async function maybePurgeExpiredDocuments(): Promise<void> {
	try {
		await purgeExpiredDocuments();
	} catch (error) {
		console.error("Papierkorb-Scheduler: Endgültiges Löschen abgelaufener Dokumente fehlgeschlagen", error);
	}
}
