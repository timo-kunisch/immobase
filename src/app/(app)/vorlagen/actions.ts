"use server";

import { revalidatePath } from "next/cache";

import {
	createDocumentTemplate,
	createGeneratedDocument,
	deleteDocumentTemplate,
	deleteGeneratedDocument,
	getDocumentTemplate,
	getGeneratedDocument,
	getLeaseTemplateContext,
	updateDocumentTemplate,
} from "@/data/templates";
import type { DocumentTemplateCategory } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { deleteUploadedFile, saveGeneratedFile } from "@/lib/storage";
import { generateLetterPdf } from "@/lib/pdf/document";
import { renderTemplateText } from "@/lib/templates";
import { formatDate } from "@/lib/format";
import { sendPdfByPostForSource, type PostalShipmentActionState } from "@/lib/postal-shipments";
import type { TemplatePreviewState } from "./preview-state";

const DOCUMENT_TEMPLATE_CATEGORIES: DocumentTemplateCategory[] = ["WARNING", "BILLING", "GENERAL", "TERMINATION", "OTHER"];

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

// ============================================================
// CRUD für Dokumentvorlagen (DocumentTemplate)
// ============================================================

export async function saveDocumentTemplateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const title = getString(formData, "title");
	const categoryRaw = getString(formData, "category") as DocumentTemplateCategory;
	const subject = getString(formData, "subject");
	const body = getString(formData, "body");

	if (!title || !body) {
		return { error: t("templates.errors.titleBodyRequired") };
	}

	const category: DocumentTemplateCategory = DOCUMENT_TEMPLATE_CATEGORIES.includes(categoryRaw) ? categoryRaw : "GENERAL";

	const data = {
		title,
		category,
		subject: subject || null,
		body,
	};

	try {
		if (id) {
			updateDocumentTemplate(id, data);
			logActivity(user, "UPDATE", "vorlagen", `Vorlage „${title}“ bearbeitet`, id);
		} else {
			const created = createDocumentTemplate(data);
			logActivity(user, "CREATE", "vorlagen", `Vorlage „${title}“ angelegt`, created.id);
		}
	} catch (error) {
		console.error("saveDocumentTemplateAction failed", error);
		return { error: t("templates.errors.saveFailed") };
	}

	revalidatePath("/vorlagen");
	return { success: true };
}

export async function deleteDocumentTemplateAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const template = getDocumentTemplate(id);
	try {
		// Bereits erzeugte Schreiben bleiben erhalten (templateId wird auf
		// null gesetzt, siehe ON DELETE SET NULL im Schema) - sie sind
		// eigene, dauerhaft eingefrorene Dokumente unabhängig von der Vorlage.
		deleteDocumentTemplate(id);
	} catch (error) {
		console.error("deleteDocumentTemplateAction failed", error);
		return { error: t("templates.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "vorlagen", `Vorlage „${template ? template.title : id}“ gelöscht`, id);

	revalidatePath("/vorlagen");
	return { success: true };
}

// ============================================================
// Live-Vorschau: rendert die Vorlage für einen gewählten Mietvertrag, ohne
// bereits ein PDF zu erzeugen oder etwas zu speichern (reine Anzeige, damit
// der Nutzer den Text vor der endgültigen Erzeugung noch prüfen/anpassen
// kann).
// ============================================================

export async function previewTemplateAction(_prevState: TemplatePreviewState, formData: FormData): Promise<TemplatePreviewState> {
	await requireUser();
	const t = await getT();
	const templateId = getString(formData, "templateId");
	const leaseId = getString(formData, "leaseId");

	const template = getDocumentTemplate(templateId);
	if (!template) {
		return { error: t("templates.errors.templateNotFound") };
	}

	const leaseContext = leaseId ? getLeaseTemplateContext(leaseId) : null;

	const context = {
		lease: leaseContext?.lease ?? null,
		tenant: leaseContext?.tenant ?? null,
		unit: leaseContext?.unit ?? null,
	};

	return {
		subject: template.subject ? renderTemplateText(template.subject, context) : null,
		body: renderTemplateText(template.body, context),
		leaseId,
	};
}

// ============================================================
// Erzeugen eines konkreten Schreibens (GeneratedDocument) aus einer Vorlage
// ============================================================

export async function generateDocumentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const templateId = getString(formData, "templateId");
	const leaseId = getString(formData, "leaseId");
	const subjectOverride = getString(formData, "subject");
	const bodyOverride = getString(formData, "body");

	const template = getDocumentTemplate(templateId);
	if (!template) {
		return { error: t("templates.errors.templateNotFound") };
	}

	const leaseContext = leaseId ? getLeaseTemplateContext(leaseId) : null;

	if (leaseId && !leaseContext) {
		return { error: t("templates.errors.leaseNotFound") };
	}

	// Die Live-Vorschau im Dialog erlaubt es, den gerenderten Text vor der
	// Erzeugung noch anzupassen - genutzt wird hier bewusst der ggf. bereits
	// editierte Text (bodyOverride/subjectOverride) statt der Vorlage erneut
	// frisch zu rendern, damit Anpassungen im Vorschau-Editor nicht verloren
	// gehen.
	const context = {
		lease: leaseContext?.lease ?? null,
		tenant: leaseContext?.tenant ?? null,
		unit: leaseContext?.unit ?? null,
	};

	const renderedSubject = subjectOverride ? renderTemplateText(subjectOverride, context) : template.subject ? renderTemplateText(template.subject, context) : null;

	const renderedBody = bodyOverride ? renderTemplateText(bodyOverride, context) : renderTemplateText(template.body, context);

	const recipientLines = leaseContext
		? [
				`${leaseContext.tenant.firstName} ${leaseContext.tenant.lastName}`,
				leaseContext.unit.property.street,
				`${leaseContext.unit.property.zipCode} ${leaseContext.unit.property.city}`,
			]
		: [];

	let pdfBuffer: Buffer;
	try {
		pdfBuffer = await generateLetterPdf({
			recipientLines,
			dateLine: formatDate(new Date()),
			subject: renderedSubject,
			body: renderedBody,
		});
	} catch (error) {
		console.error("generateDocumentAction: PDF-Erzeugung fehlgeschlagen", error);
		return { error: t("templates.errors.pdfFailed") };
	}

	try {
		const saved = await saveGeneratedFile(pdfBuffer, "generated-documents", `${template.title}.pdf`);

		const document = createGeneratedDocument({
			templateId: template.id,
			templateTitle: template.title,
			leaseId: leaseContext?.lease.id ?? null,
			tenantId: leaseContext?.lease.tenantId ?? null,
			subject: renderedSubject,
			renderedBody,
			filePath: saved.relativePath,
			fileSize: saved.fileSize,
		});
		logActivity(user, "CREATE", "vorlagen", `Dokument „${renderedSubject ?? template.title}“ aus Vorlage „${template.title}“ generiert`, document.id);
	} catch (error) {
		console.error("generateDocumentAction: Speichern fehlgeschlagen", error);
		return { error: t("templates.errors.generatedSaveFailed") };
	}

	revalidatePath("/vorlagen");
	revalidatePath(`/vorlagen/${templateId}`);
	return { success: true };
}

// ============================================================
// Postversand: erzeugtes Schreiben per LetterXpress verschicken
// ============================================================

export async function sendGeneratedDocumentByPostAction(generatedDocumentId: string): Promise<PostalShipmentActionState> {
	const user = await requireUser();
	const t = await getT();
	const document = getGeneratedDocument(generatedDocumentId);
	if (!document) {
		return { error: t("templates.errors.documentNotFoundDetailed") };
	}

	const result = await sendPdfByPostForSource("GENERATED_DOCUMENT", generatedDocumentId, user.id, t);

	if ("success" in result) {
		logActivity(user, "CREATE", "postversand", `Dokument „${document.subject ?? document.templateTitle}“ per Post versendet`, generatedDocumentId);
	}

	revalidatePath(`/vorlagen/${document.templateId ?? ""}`);
	return result;
}

export async function deleteGeneratedDocumentAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	try {
		const document = getGeneratedDocument(id);
		if (!document) return { error: t("templates.errors.documentNotFound") };
		deleteGeneratedDocument(id);
		await deleteUploadedFile(document.filePath);
		logActivity(user, "DELETE", "vorlagen", `Dokument „${document.subject ?? document.templateTitle}“ gelöscht`, id);
	} catch (error) {
		console.error("deleteGeneratedDocumentAction failed", error);
		return { error: t("templates.errors.documentDeleteFailed") };
	}

	revalidatePath("/vorlagen");
	return { success: true };
}
