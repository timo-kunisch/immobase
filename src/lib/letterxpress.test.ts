import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { getLetterXpressMode, LetterXpressError, sendPdfByPost } from "@/lib/letterxpress";

/**
 * Tests für den LetterXpress-Postversand-Client (src/lib/letterxpress.ts).
 * `fetch()` wird in JEDEM Testfall gemockt (vi.stubGlobal) - es findet
 * ausdrücklich KEIN echter Request gegen die LetterXpress-API statt (siehe
 * Anforderung 5 der Aufgabenstellung).
 */

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(vars)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function mockFetchResponse(status: number, body: unknown) {
	return vi.fn().mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		})
	);
}

const samplePdf = new Uint8Array([1, 2, 3, 4, 5]);

beforeEach(() => {
	setEnv({
		LETTERXPRESS_USERNAME: "test-user",
		LETTERXPRESS_API_KEY: "test-key",
		LETTERXPRESS_MODE: undefined,
	});
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("getLetterXpressMode", () => {
	it("liefert standardmäßig 'test', wenn LETTERXPRESS_MODE nicht gesetzt ist", () => {
		setEnv({ LETTERXPRESS_MODE: undefined });
		expect(getLetterXpressMode()).toBe("test");
	});

	it("liefert 'test' bei einem unbekannten Wert (sicherer Standard statt versehentlichem Live-Versand)", () => {
		setEnv({ LETTERXPRESS_MODE: "irgendwas" });
		expect(getLetterXpressMode()).toBe("test");
	});

	it("liefert 'live' nur bei explizitem LETTERXPRESS_MODE=live", () => {
		setEnv({ LETTERXPRESS_MODE: "live" });
		expect(getLetterXpressMode()).toBe("live");
	});
});

describe("sendPdfByPost", () => {
	it("sendet den Request an POST /v3/printjobs mit korrektem Body (auth, base64, MD5-Checksum über dem base64-String, specification, filename_original)", async () => {
		// Reale Response-Struktur laut LXP-API-Dokumentation (v3.0): Auftrags-ID
		// und -Status liegen verschachtelt unter "data" - "status" auf oberster
		// Ebene ist NUR der HTTP-Statuscode (als Zahl), nicht der Auftragsstatus.
		const fetchMock = mockFetchResponse(200, { status: 200, message: "OK", data: { id: 12345, status: "queue" } });
		vi.stubGlobal("fetch", fetchMock);

		const result = await sendPdfByPost({ pdfBuffer: samplePdf, fileName: "Abrechnung-123.pdf" });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://api.letterxpress.de/v3/printjobs");
		expect(init.method).toBe("POST");
		expect(init.headers["Content-Type"]).toBe("application/json");

		const body = JSON.parse(init.body as string);
		expect(body.auth).toEqual({ username: "test-user", apikey: "test-key", mode: "test" });

		const expectedBase64 = Buffer.from(samplePdf).toString("base64");
		expect(body.letter.base64_file).toBe(expectedBase64);
		expect(body.letter.base64_file_checksum).toBe(createHash("md5").update(expectedBase64).digest("hex"));
		expect(body.letter.specification).toEqual({ color: "1", mode: "simplex", shipping: "national" });
		expect(body.letter.filename_original).toBe("Abrechnung-123.pdf");

		expect(result).toEqual({ jobId: "12345", status: "queue", mode: "test" });
	});

	it("verwendet den Modus aus LETTERXPRESS_MODE=live im auth-Objekt und im Ergebnis", async () => {
		setEnv({ LETTERXPRESS_MODE: "live" });
		const fetchMock = mockFetchResponse(200, { status: 200, message: "OK", data: { id: "abc", status: "queue" } });
		vi.stubGlobal("fetch", fetchMock);

		const result = await sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" });

		const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		expect(body.auth.mode).toBe("live");
		expect(result.mode).toBe("live");
	});

	it("übernimmt eine übergebene Teil-Spezifikation und ergänzt sie um die Standardwerte", async () => {
		const fetchMock = mockFetchResponse(200, { status: 200, message: "OK", data: { id: 1, status: "queue" } });
		vi.stubGlobal("fetch", fetchMock);

		await sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf", specification: { color: "4", mode: "duplex" } });

		const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		expect(body.letter.specification).toEqual({ color: "4", mode: "duplex", shipping: "national" });
	});

	it("wirft LetterXpressError bei fehlenden Zugangsdaten, ohne einen Request zu senden", async () => {
		setEnv({ LETTERXPRESS_USERNAME: undefined, LETTERXPRESS_API_KEY: undefined });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" })).rejects.toThrow(LetterXpressError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("wirft LetterXpressError bei einer leeren PDF-Datei, ohne einen Request zu senden", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: new Uint8Array(), fileName: "leer.pdf" })).rejects.toThrow(LetterXpressError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("wirft LetterXpressError bei einer zu großen PDF-Datei (> 50 MB), ohne einen Request zu senden", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const oversized = new Uint8Array(50 * 1024 * 1024 + 1);
		await expect(sendPdfByPost({ pdfBuffer: oversized, fileName: "riesig.pdf" })).rejects.toThrow(LetterXpressError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("wirft LetterXpressError mit HTTP-Status und API-Fehlermeldung bei einer Non-2xx-Antwort (z. B. 401 Unauthorized)", async () => {
		const fetchMock = mockFetchResponse(401, { message: "Unauthorized." });
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" })).rejects.toMatchObject({
			name: "LetterXpressError",
			status: 401,
			message: expect.stringContaining("Unauthorized."),
		});
	});

	it("wirft LetterXpressError bei einer Antwort ohne 'data'-Objekt (ungültige Antwort)", async () => {
		const fetchMock = mockFetchResponse(200, { foo: "bar" });
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" })).rejects.toThrow(LetterXpressError);
	});

	it("wirft LetterXpressError, wenn 'data' vorhanden ist, aber keine Auftrags-ID enthält", async () => {
		const fetchMock = mockFetchResponse(200, { status: 200, message: "OK", data: { shipping: "national" } });
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" })).rejects.toThrow(LetterXpressError);
	});

	it("wirft LetterXpressError, wenn die Antwort kein valides JSON ist", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response("<html>not json</html>", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" })).rejects.toThrow(LetterXpressError);
	});

	it("wirft LetterXpressError bei einem Netzwerkfehler (fetch() lehnt ab)", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(sendPdfByPost({ pdfBuffer: samplePdf, fileName: "brief.pdf" })).rejects.toMatchObject({
			name: "LetterXpressError",
			message: expect.stringContaining("network down"),
		});
	});
});
