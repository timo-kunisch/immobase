import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests für die generische Postversand-Orchestrierung
 * (src/lib/postal-shipments.ts). Sowohl der LetterXpress-API-Aufruf
 * (src/lib/letterxpress.ts) als auch der Repository-Layer (@/data/postal-shipments)
 * und die Dateiablage (@/lib/storage) werden gemockt - kein echter Request,
 * keine echte SQLite-/Dateisystem-Anbindung in diesem Test.
 */

const insertedRows: unknown[] = [];

const getTenantStatementPdfFile = vi.fn();
const getGeneratedDocumentPdfFile = vi.fn();
const getDocumentPdfFile = vi.fn();
const getHoaAnnualStatementPdfFile = vi.fn();
const getOwnerMeetingInvitationPdfFile = vi.fn();
const getOwnerMeetingMinutesPdfFile = vi.fn();

vi.mock("@/data/postal-shipments", () => ({
	getTenantStatementPdfFile: (...args: unknown[]) => getTenantStatementPdfFile(...args),
	getGeneratedDocumentPdfFile: (...args: unknown[]) => getGeneratedDocumentPdfFile(...args),
	getDocumentPdfFile: (...args: unknown[]) => getDocumentPdfFile(...args),
	getHoaAnnualStatementPdfFile: (...args: unknown[]) => getHoaAnnualStatementPdfFile(...args),
	getOwnerMeetingInvitationPdfFile: (...args: unknown[]) => getOwnerMeetingInvitationPdfFile(...args),
	getOwnerMeetingMinutesPdfFile: (...args: unknown[]) => getOwnerMeetingMinutesPdfFile(...args),
	createPostalShipment: (values: unknown) => {
		insertedRows.push(values);
		return values;
	},
	getLatestPostalShipmentForSource: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
	getUploadedFile: vi.fn(),
}));

vi.mock("@/lib/letterxpress", async () => {
	const actual = await vi.importActual<typeof import("@/lib/letterxpress")>("@/lib/letterxpress");
	return {
		...actual,
		getLetterXpressMode: vi.fn(() => "test"),
		isLetterXpressConfigured: vi.fn(() => true),
		sendPdfByPost: vi.fn(),
	};
});

import { getUploadedFile } from "@/lib/storage";
import { getLetterXpressMode, isLetterXpressConfigured, sendPdfByPost, LetterXpressError } from "@/lib/letterxpress";
import { sendPdfByPostForSource } from "@/lib/postal-shipments";

const mockedGetUploadedFile = getUploadedFile as unknown as ReturnType<typeof vi.fn>;
const mockedSendPdfByPost = sendPdfByPost as unknown as ReturnType<typeof vi.fn>;
const mockedGetMode = getLetterXpressMode as unknown as ReturnType<typeof vi.fn>;
const mockedIsConfigured = isLetterXpressConfigured as unknown as ReturnType<typeof vi.fn>;

function fakeUploadedFile(bytes: Uint8Array) {
	return { body: new Response(bytes as BodyInit).body!, mimeType: "application/pdf" };
}

beforeEach(() => {
	insertedRows.length = 0;
	getTenantStatementPdfFile.mockReset();
	getGeneratedDocumentPdfFile.mockReset();
	getDocumentPdfFile.mockReset();
	getHoaAnnualStatementPdfFile.mockReset();
	getOwnerMeetingInvitationPdfFile.mockReset();
	getOwnerMeetingMinutesPdfFile.mockReset();
	mockedGetUploadedFile.mockReset();
	mockedSendPdfByPost.mockReset();
	mockedGetMode.mockReset().mockReturnValue("test");
	mockedIsConfigured.mockReset().mockReturnValue(true);
});

describe("sendPdfByPostForSource", () => {
	it("bricht ohne LetterXpress-Konfiguration ab, ohne die Quelle zu laden oder einen Protokoll-Eintrag zu erzeugen", async () => {
		mockedIsConfigured.mockReturnValue(false);

		const result = await sendPdfByPostForSource("TENANT_STATEMENT", "s1", "user-1");

		expect(result).toEqual({ error: expect.stringContaining("nicht eingerichtet") });
		expect(getTenantStatementPdfFile).not.toHaveBeenCalled();
		expect(mockedSendPdfByPost).not.toHaveBeenCalled();
		expect(insertedRows).toHaveLength(0);
	});

	it("gibt einen Fehler zurück, wenn die Quelle kein pdfPath hat (TenantStatement ohne erzeugtes PDF)", async () => {
		getTenantStatementPdfFile.mockReturnValue(null);

		const result = await sendPdfByPostForSource("TENANT_STATEMENT", "s1", "user-1");

		expect(result).toEqual({ error: expect.stringContaining("kein versandfertiges PDF") });
		expect(mockedSendPdfByPost).not.toHaveBeenCalled();
		expect(insertedRows).toHaveLength(0);
	});

	it("versendet ein TenantStatement-PDF erfolgreich und speichert einen REGISTERED-Eintrag", async () => {
		getTenantStatementPdfFile.mockReturnValue({ filePath: "billing-statements/abc.pdf", fileName: "abc.pdf" });
		mockedGetUploadedFile.mockResolvedValue(fakeUploadedFile(new Uint8Array([1, 2, 3])));
		mockedSendPdfByPost.mockResolvedValue({ jobId: "999", status: "created", mode: "test" });

		const result = await sendPdfByPostForSource("TENANT_STATEMENT", "s1", "user-1");

		expect(result).toEqual({ success: true, jobId: "999", externalStatus: "created", mode: "test" });
		expect(insertedRows).toEqual([
			{
				sourceType: "TENANT_STATEMENT",
				sourceId: "s1",
				externalJobId: "999",
				externalStatus: "created",
				mode: "test",
				status: "REGISTERED",
				errorMessage: null,
				requestedByUserId: "user-1",
			},
		]);
	});

	it("speichert einen FAILED-Eintrag und gibt die Fehlermeldung zurück, wenn die LetterXpress-API einen Fehler wirft", async () => {
		getTenantStatementPdfFile.mockReturnValue({ filePath: "billing-statements/abc.pdf", fileName: "abc.pdf" });
		mockedGetUploadedFile.mockResolvedValue(fakeUploadedFile(new Uint8Array([1, 2, 3])));
		mockedSendPdfByPost.mockRejectedValue(new LetterXpressError("LetterXpress-Fehler: Unauthorized.", 401));

		const result = await sendPdfByPostForSource("TENANT_STATEMENT", "s1", "user-1");

		expect(result).toEqual({ error: "Der Postversand ist fehlgeschlagen: LetterXpress-Fehler: Unauthorized." });
		expect(insertedRows).toEqual([
			expect.objectContaining({
				sourceType: "TENANT_STATEMENT",
				sourceId: "s1",
				status: "FAILED",
				errorMessage: "LetterXpress-Fehler: Unauthorized.",
				externalJobId: null,
			}),
		]);
	});

	it("gibt einen Fehler zurück, wenn die PDF-Datei nicht in der Dateiablage gefunden wird", async () => {
		getTenantStatementPdfFile.mockReturnValue({ filePath: "billing-statements/missing.pdf", fileName: "missing.pdf" });
		mockedGetUploadedFile.mockResolvedValue(null);

		const result = await sendPdfByPostForSource("TENANT_STATEMENT", "s1", "user-1");

		expect(result).toEqual({ error: expect.stringContaining("nicht gefunden") });
		expect(mockedSendPdfByPost).not.toHaveBeenCalled();
		expect(insertedRows).toEqual([expect.objectContaining({ status: "FAILED" })]);
	});

	it("löst ein GENERATED_DOCUMENT korrekt über generated_documents auf", async () => {
		getGeneratedDocumentPdfFile.mockReturnValue({ filePath: "generated-documents/x.pdf", fileName: "Mahnung.pdf" });
		mockedGetUploadedFile.mockResolvedValue(fakeUploadedFile(new Uint8Array([9])));
		mockedSendPdfByPost.mockResolvedValue({ jobId: "42", status: null, mode: "test" });

		const result = await sendPdfByPostForSource("GENERATED_DOCUMENT", "g1", null);

		expect(result).toEqual({ success: true, jobId: "42", externalStatus: null, mode: "test" });
		expect(mockedSendPdfByPost).toHaveBeenCalledWith(expect.objectContaining({ fileName: "Mahnung.pdf" }));
	});

	it("löst ein DOCUMENT (DMS-Upload) korrekt über documents auf", async () => {
		getDocumentPdfFile.mockReturnValue({ filePath: "documents/y.pdf", fileName: "Vertrag.pdf" });
		mockedGetUploadedFile.mockResolvedValue(fakeUploadedFile(new Uint8Array([9])));
		mockedSendPdfByPost.mockResolvedValue({ jobId: "7", status: "created", mode: "test" });

		const result = await sendPdfByPostForSource("DOCUMENT", "d1", "user-2");

		expect(result).toEqual({ success: true, jobId: "7", externalStatus: "created", mode: "test" });
		expect(mockedSendPdfByPost).toHaveBeenCalledWith(expect.objectContaining({ fileName: "Vertrag.pdf" }));
	});

	it("gibt einen Fehler zurück, wenn die Quelle (z. B. gelöschtes Dokument) nicht gefunden wird", async () => {
		getDocumentPdfFile.mockReturnValue(null);

		const result = await sendPdfByPostForSource("DOCUMENT", "missing", null);

		expect(result).toEqual({ error: expect.any(String) });
		expect(mockedSendPdfByPost).not.toHaveBeenCalled();
	});
});
