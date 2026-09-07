"use server";

import { revalidatePath } from "next/cache";

import { createDocument, deleteDocument, getDocument } from "@/data/documents";
import type { DocumentType } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
import { deleteUploadedFile, saveUploadedFile } from "@/lib/storage";
import { sendPdfByPostForSource, type PostalShipmentActionState } from "@/lib/postal-shipments";
import type { DocumentSourceType } from "@/lib/documents-overview";
import { ALLOWED_DOCUMENT_TYPES_LABEL, isAllowedDocumentFile } from "@/app/(app)/dokumente/upload-constraints";
import { deleteGeneratedDocumentAction, sendGeneratedDocumentByPostAction } from "@/app/(app)/vorlagen/actions";
import { sendStatementByPostAction } from "@/app/(app)/abrechnung/actions";

const DOCUMENT_TYPES: DocumentType[] = ["CONTRACT", "INVOICE", "FLOORPLAN", "OTHER"];

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getOptionalId(formData: FormData, key: string): string | null {
	const value = getString(formData, key);
	return value && value !== "none" ? value : null;
}

export async function uploadDocumentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const file = formData.get("file");
	const typeRaw = getString(formData, "type") as DocumentType;
	const propertyId = getOptionalId(formData, "propertyId");
	const unitId = getOptionalId(formData, "unitId");
	const tenantId = getOptionalId(formData, "tenantId");

	if (!(file instanceof File) || file.size === 0) {
		return { error: "Bitte wählen Sie eine Datei aus." };
	}

	// Autoritative Prüfung des Dateityps (Defense-in-Depth): Das `accept`-
	// Attribut im Client ist nur eine UX-Hilfe und kann umgangen werden.
	// Aktuell wird bewusst nur PDF unterstützt (siehe upload-constraints.ts),
	// künftig ggf. um weitere Dateitypen erweiterbar.
	if (!isAllowedDocumentFile(file)) {
		return { error: `Es werden aktuell nur ${ALLOWED_DOCUMENT_TYPES_LABEL}-Dateien unterstützt.` };
	}

	const type: DocumentType = DOCUMENT_TYPES.includes(typeRaw) ? typeRaw : "OTHER";

	try {
		const saved = await saveUploadedFile(file, "documents");

		createDocument({
			propertyId,
			unitId,
			tenantId,
			type,
			fileName: saved.fileName,
			filePath: saved.relativePath,
			mimeType: saved.mimeType,
			fileSize: saved.fileSize,
		});
	} catch (error) {
		console.error("uploadDocumentAction failed", error);
		return { error: "Die Datei konnte nicht hochgeladen werden." };
	}

	revalidatePath("/dokumente");
	return { success: true };
}

export async function deleteDocumentAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		const document = getDocument(id);
		if (!document) {
			return { error: "Dokument nicht gefunden." };
		}

		deleteDocument(id);
		await deleteUploadedFile(document.filePath);
	} catch (error) {
		console.error("deleteDocumentAction failed", error);
		return { error: "Das Dokument konnte nicht gelöscht werden." };
	}

	revalidatePath("/dokumente");
	return { success: true };
}

// ============================================================
// Postversand: hochgeladenes Dokument per LetterXpress verschicken
// ============================================================

/**
 * Nur PDF-Dokumente können per Post versendet werden (LetterXpress
 * erwartet ausschließlich PDF-Dateien) - andere Uploads (Bilder, Word/Excel)
 * werden hier explizit abgewiesen, statt einen unverständlichen API-Fehler
 * der Gegenseite anzuzeigen.
 */
export async function sendDocumentByPostAction(documentId: string): Promise<PostalShipmentActionState> {
	const user = await requireUser();
	const document = getDocument(documentId);
	if (!document) {
		return { error: "Das Dokument wurde nicht gefunden." };
	}
	if (document.mimeType !== "application/pdf") {
		return { error: "Nur PDF-Dokumente können per Post versendet werden." };
	}

	const result = await sendPdfByPostForSource("DOCUMENT", documentId, user.id);

	revalidatePath("/dokumente");
	return result;
}

// ============================================================
// Vereinheitlichte Übersicht (alle drei Datei-Quellen, siehe
// src/lib/documents-overview.ts): Löschen/Postversand werden je nach
// `sourceType` an die zuständige, quellenspezifische Action der jeweiligen
// Fachmodule weitergereicht - analog zu sendPdfByPostForSource() in
// src/lib/postal-shipments.ts, aber hier für Löschen/Versand direkt aus der
// gemeinsamen /dokumente-Ansicht heraus, ohne dass die Tabelle selbst die
// Modul-Grenzen kennen muss.
// ============================================================

/**
 * Für versandfertige Nebenkostenabrechnungs-PDFs (TENANT_STATEMENT) gibt es
 * bewusst keine eigenständige "PDF löschen"-Action ohne das zugehörige
 * TenantStatement selbst zu löschen (das PDF ist nur eine abgeleitete
 * Momentaufnahme, siehe abrechnung/actions.ts) - Löschen ist für diese
 * Quelle in der Gesamtübersicht daher nicht möglich.
 */
export async function deleteAnyDocumentAction(sourceType: DocumentSourceType, id: string): Promise<ActionState> {
	if (sourceType === "DOCUMENT") return deleteDocumentAction(id);
	if (sourceType === "GENERATED_DOCUMENT") return deleteGeneratedDocumentAction(id);
	return { error: "Abrechnungs-PDFs können nur über die jeweilige Abrechnungsperiode gelöscht werden." };
}

export async function sendAnyDocumentByPostAction(sourceType: DocumentSourceType, id: string): Promise<PostalShipmentActionState> {
	if (sourceType === "DOCUMENT") return sendDocumentByPostAction(id);
	if (sourceType === "GENERATED_DOCUMENT") return sendGeneratedDocumentByPostAction(id);
	return sendStatementByPostAction(id);
}
