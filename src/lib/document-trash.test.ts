import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/data/db";
import {
	createDocument,
	getDocument,
	getTrashedDocument,
	listUploadedDocumentOverviewRows,
	restoreDocument,
	trashDocument,
} from "@/data/documents";
import {
	createGeneratedDocument,
	getGeneratedDocument,
	getTrashedGeneratedDocument,
	listGeneratedDocumentsFiltered,
	restoreGeneratedDocument,
	trashGeneratedDocument,
} from "@/data/templates";
import { createProperty } from "@/data/properties";
import { createTenant } from "@/data/tenants";
import { DOCUMENT_TRASH_RETENTION_DAYS, loadTrashedDocuments, purgeExpiredDocuments, trashCutoff } from "@/lib/document-trash";
import { saveGeneratedFile, saveUploadedFile } from "@/lib/storage";

/**
 * Tests für den Dokumenten-Papierkorb (src/lib/document-trash.ts und die
 * Repository-Erweiterungen in src/data/documents.ts bzw.
 * src/data/templates.ts): Verschieben/Wiederherstellen, Sichtbarkeiten der
 * regulären Lesezugriffe und die automatische Endlöschung nach Ablauf der
 * Aufbewahrungsfrist (inkl. Datei-Entfernung aus der Ablage).
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-document-trash-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function seedDocument(fileName: string) {
	const property = createProperty({ name: "Haus", street: "S", zipCode: "1", city: "C", country: "D", notes: null });
	return createDocument({
		propertyId: property.id,
		unitId: null,
		tenantId: null,
		type: "INVOICE",
		fileName,
		filePath: `documents/${fileName}.pdf`,
		mimeType: "application/pdf",
		fileSize: 1234,
	});
}

function seedGeneratedDocument(subject: string, filePath: string) {
	return createGeneratedDocument({
		templateId: null,
		templateTitle: "Mahnung",
		leaseId: null,
		tenantId: null,
		subject,
		renderedBody: "<p>Text</p>",
		filePath,
		fileSize: 500,
	});
}

describe("Dokumenten-Papierkorb", () => {
	it("DMS-Dokument: Verschieben in den Papierkorb, Sichtbarkeiten, Wiederherstellen", () => {
		const document = seedDocument("rechnung.pdf");
		expect(getDocument(document.id)?.deletedAt).toBeNull();
		expect(getTrashedDocument(document.id)).toBeNull();

		// Verschieben: aktive Sichtbarkeiten verschwinden, Papierkorb-Get greift.
		expect(trashDocument(document.id)).toBe(true);
		expect(getDocument(document.id)).toBeNull();
		expect(listUploadedDocumentOverviewRows({})).toHaveLength(0);
		const trashed = getTrashedDocument(document.id);
		expect(trashed?.deletedAt).toBeTruthy();

		// Idempotenz: erneutes Verschieben/Wiederherstellen ohne Zustand schlägt fehl.
		expect(trashDocument(document.id)).toBe(false);
		expect(restoreDocument(document.id)).toBe(true);
		expect(restoreDocument(document.id)).toBe(false);

		// Wiederhergestellt: aktive Sichtbarkeiten sind zurück.
		expect(getDocument(document.id)?.fileName).toBe("rechnung.pdf");
		expect(getTrashedDocument(document.id)).toBeNull();
		expect(listUploadedDocumentOverviewRows({})).toHaveLength(1);
	});

	it("Vorlagen-Schreiben: analoges Verschieben/Wiederherstellen inkl. Listen-Filter", () => {
		const tenant = createTenant({ firstName: "Max", lastName: "Muster", email: null, phone: null, notes: null });
		const generated = createGeneratedDocument({
			templateId: null,
			templateTitle: "Mahnung",
			leaseId: null,
			tenantId: tenant.id,
			subject: "Zahlungserinnerung",
			renderedBody: "<p>Text</p>",
			filePath: "generated-documents/mahnung.pdf",
			fileSize: 500,
		});
		expect(getGeneratedDocument(generated.id)?.deletedAt).toBeNull();

		expect(trashGeneratedDocument(generated.id)).toBe(true);
		expect(getGeneratedDocument(generated.id)).toBeNull();
		expect(getTrashedGeneratedDocument(generated.id)?.deletedAt).toBeTruthy();
		expect(listGeneratedDocumentsFiltered({})).toHaveLength(0);

		expect(trashGeneratedDocument(generated.id)).toBe(false);
		expect(restoreGeneratedDocument(generated.id)).toBe(true);
		expect(restoreGeneratedDocument(generated.id)).toBe(false);
		expect(listGeneratedDocumentsFiltered({})).toHaveLength(1);
		expect(getTrashedGeneratedDocument(generated.id)).toBeNull();
	});

	it("loadTrashedDocuments: einheitliche Liste beider Quellen mit Löschfrist", () => {
		const document = seedDocument("vertrag.pdf");
		const generated = seedGeneratedDocument("Kündigung", "generated-documents/kuendigung.pdf");
		trashDocument(document.id);
		trashGeneratedDocument(generated.id);

		const rows = loadTrashedDocuments();
		expect(rows).toHaveLength(2);
		expect(new Set(rows.map((row) => row.sourceType))).toEqual(new Set(["DOCUMENT", "GENERATED_DOCUMENT"]));

		const generatedRow = rows.find((row) => row.sourceType === "GENERATED_DOCUMENT")!;
		expect(generatedRow.fileName).toBe("Kündigung.pdf");

		// Löschfrist = Löschzeitpunkt + 28 Tage (beide Zeilen).
		for (const row of rows) {
			const expected = Date.parse(row.deletedAt) + DOCUMENT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
			expect(Date.parse(row.permanentDeleteAt)).toBe(expected);
		}

		// Wiederherstellen nimmt den Eintrag aus der Papierkorb-Liste.
		restoreDocument(document.id);
		expect(loadTrashedDocuments()).toHaveLength(1);
	});

	it("purgeExpiredDocuments: löscht nur abgelaufene Einträge endgültig (DB-Zeile und Datei)", async () => {
		const now = new Date("2026-09-12T12:00:00.000Z");
		const cutoff = trashCutoff(now);
		expect(Date.parse(cutoff)).toBe(now.getTime() - DOCUMENT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

		// Abgelaufenenes DMS-Dokument MIT echter Datei in der Ablage.
		const savedUpload = await saveUploadedFile(
			new File([Buffer.from("Rechnungsinhalt")], "rechnung.pdf", { type: "application/pdf" }),
			"documents"
		);
		const expiredDocument = createDocument({
			propertyId: null,
			unitId: null,
			tenantId: null,
			type: "INVOICE",
			fileName: "rechnung.pdf",
			filePath: savedUpload.relativePath,
			mimeType: "application/pdf",
			fileSize: 16,
		});
		// Abgelaufenenes Schreiben MIT echter Datei in der Ablage.
		const savedLetter = await saveGeneratedFile(Buffer.from("Mahnungsinhalt"), "generated-documents", "mahnung.pdf");
		const expiredGenerated = seedGeneratedDocument("Mahnung", savedLetter.relativePath);
		// Frisch gelöschtes Dokument (Frist läuft noch, MIT echter Datei) und
		// Grenzfall "exakt zum Stichtag gelöscht" (bleibt erhalten, nur
		// strikt älter als der Stichtag zählt als abgelaufen).
		const savedFresh = await saveUploadedFile(
			new File([Buffer.from("Frischer Inhalt")], "frisch.pdf", { type: "application/pdf" }),
			"documents"
		);
		const freshDocument = createDocument({
			propertyId: null,
			unitId: null,
			tenantId: null,
			type: "OTHER",
			fileName: "frisch.pdf",
			filePath: savedFresh.relativePath,
			mimeType: "application/pdf",
			fileSize: 15,
		});
		const boundaryDocument = seedDocument("grenzfall.pdf");
		const activeDocument = seedDocument("aktiv.pdf");

		trashDocument(expiredDocument.id);
		trashGeneratedDocument(expiredGenerated.id);
		trashDocument(freshDocument.id);
		trashDocument(boundaryDocument.id);

		getDb().prepare("UPDATE documents SET deleted_at = ? WHERE id = ?").run(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString(), expiredDocument.id);
		getDb().prepare("UPDATE generated_documents SET deleted_at = ? WHERE id = ?").run(new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), expiredGenerated.id);
		getDb().prepare("UPDATE documents SET deleted_at = ? WHERE id = ?").run(cutoff, boundaryDocument.id);

		const result = await purgeExpiredDocuments(now);
		expect(result).toEqual({ documents: 1, generatedDocuments: 1 });

		// DB: nur die beiden abgelaufenen Einträge sind endgültig weg.
		expect(getTrashedDocument(expiredDocument.id)).toBeNull();
		expect(getTrashedGeneratedDocument(expiredGenerated.id)).toBeNull();
		expect(getTrashedDocument(freshDocument.id)).not.toBeNull();
		expect(getTrashedDocument(boundaryDocument.id)).not.toBeNull();
		expect(getDocument(activeDocument.id)).not.toBeNull();
		expect(loadTrashedDocuments()).toHaveLength(2);

		// Ablage: Dateien (inkl. Sidecar) der endgültig gelöschten Einträge
		// sind entfernt, die der verbleibenden unangetastet.
		expect(fs.existsSync(path.join(testDir, "files", savedUpload.relativePath))).toBe(false);
		expect(fs.existsSync(path.join(testDir, "files", savedLetter.relativePath))).toBe(false);
		expect(fs.existsSync(path.join(testDir, "files", freshDocument.filePath))).toBe(true);

		// Erneuter Aufruf ist idempotent (nichts mehr zu tun).
		expect(await purgeExpiredDocuments(now)).toEqual({ documents: 0, generatedDocuments: 0 });
	});
});
