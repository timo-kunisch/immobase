import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Workbook } from "exceljs";
import JSZip from "jszip";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb } from "@/data/db";
import { getSetting, setSetting } from "@/data/app-settings";
import { AttachmentError, processAttachment } from "@/lib/ai/attachments";
import { ChatError, runChat } from "@/lib/ai/chat";
import { getAiConfig, getAiProvider, isAiConfigured } from "@/lib/ai/config";
import { AI_PARTNER_BASE_URL, AI_PARTNER_MODEL } from "@/lib/ai/partner";
import { registerTool } from "@/lib/mcp/registry";
import { OcrEngineError, ocrPdfPages } from "@/lib/ai/ocr";

// Die OCR-Engine (tesseract.js/@napi-rs/canvas) wird in dieser Testdatei
// gemockt - die PDF-Fälle laufen so schnell und deterministisch. Ein
// echter End-to-End-Durchstich (Rastern + Erkennen) liegt in ocr.test.ts.
vi.mock("@/lib/ai/ocr", () => {
	class MockOcrEngineError extends Error {}
	return {
		OcrEngineError: MockOcrEngineError,
		ocrPdfPages: vi.fn(async () => new Map<number, string>()),
	};
});
const ocrPdfPagesMock = vi.mocked(ocrPdfPages);

/**
 * Tests für den KI-Assistenten (src/lib/ai/): Konfiguration (app_settings +
 * Secret-Verschlüsselung), Anhang-Textextraktion (Excel via exceljs, Text,
 * Fehlerfälle) und der Chat-Tool-Loop gegen einen gemockten
 * OpenAI-kompatiblen Endpunkt (fetch wird per vi.stubGlobal gemockt - es
 * findet KEIN echter Netzwerkzugriff statt; Muster wie in
 * src/lib/dropbox.test.ts) inkl. der rollenbasierten Werkzeug-Einschränkung
 * (normale Nutzer ohne Administrations-Werkzeuge) und der Batch-Ausführung
 * (batch_execute: Einzelaufrufe werden in der UI-Liste flach ausgewiesen).
 * Werkzeug-Aufrufe laufen gegen ein eigens registriertes Test-Werkzeug bzw.
 * die echten Werkzeuge der MCP-Registry.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-ai-test-"));
	process.env.APP_DATA_DIR = testDir;
	// Standard-Verhalten des OCR-Mocks: kein Text erkannt (leere Map).
	ocrPdfPagesMock.mockReset();
	ocrPdfPagesMock.mockResolvedValue(new Map());
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** Einmalig registriertes Test-Werkzeug (Registry wirft bei Duplikaten). */
let testToolRegistered = false;
function ensureTestTool(): void {
	if (testToolRegistered) return;
	registerTool({
		name: "test_echo_tool",
		description: "Test-Werkzeug: gibt die Argumente unverändert zurück.",
		inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
		handler: (args) => ({ echo: args.text ?? null }),
	});
	testToolRegistered = true;
}

function configureAi(): void {
	setSetting("ai.base_url", "https://ki.example.test/v1");
	setSetting("ai.model", "test-modell");
	setSetting("ai.apikey", "geheimer-schluessel");
}

function completionResponse(message: unknown): Response {
	return new Response(JSON.stringify({ choices: [{ message }] }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function mockFetchSequence(messages: unknown[]) {
	const fetchMock = vi.fn(async () => {
		const next = messages.shift();
		if (!next) throw new Error("Unerwarteter zusätzlicher Endpunkt-Aufruf im Test.");
		return completionResponse(next);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("KI-Konfiguration (src/lib/ai/config.ts)", () => {
	it("ist standardmäßig nicht konfiguriert", () => {
		expect(isAiConfigured()).toBe(false);
		expect(getAiConfig()).toBeNull();
	});

	it("ist erst mit Basis-URL UND Modell vollständig (Schlüssel optional)", () => {
		setSetting("ai.base_url", "https://api.openai.com/v1");
		expect(isAiConfigured()).toBe(false);
		setSetting("ai.model", "gpt-4o-mini");
		expect(isAiConfigured()).toBe(true);
		const config = getAiConfig();
		expect(config).toEqual({ baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", apiKey: null });
	});

	it("entfernt abschließende Schrägstriche der Basis-URL", () => {
		setSetting("ai.base_url", "http://localhost:1234/v1/");
		setSetting("ai.model", "lokal");
		expect(getAiConfig()?.baseUrl).toBe("http://localhost:1234/v1");
	});

	it("speichert den API-Schlüssel feldverschlüsselt", () => {
		setSetting("ai.apikey", "sk-test-123");
		// Roher DB-Wert ist der verschlüsselte Container, getSetting entschlüsselt.
		const raw = getDb().prepare("SELECT value FROM app_settings WHERE key = 'ai.apikey'").get() as { value: string };
		expect(raw.value.startsWith("enc:v1:")).toBe(true);
		expect(getSetting("ai.apikey")).toBe("sk-test-123");
	});

	it("Partner-Modus: nur API-Schlüssel nötig, ohne Schlüssel nicht konfiguriert", () => {
		setSetting("ai.provider", "arbeitskraft");
		expect(isAiConfigured()).toBe(false);
		expect(getAiConfig()).toBeNull();
		setSetting("ai.apikey", "partner-schluessel");
		expect(isAiConfigured()).toBe(true);
		expect(getAiConfig()).toEqual({
			baseUrl: AI_PARTNER_BASE_URL,
			model: AI_PARTNER_MODEL,
			apiKey: "partner-schluessel",
		});
		expect(getAiProvider()).toBe("arbeitskraft");
	});

	it("Partner-Modus hat Vorrang vor einem gespeicherten benutzerdefinierten Endpunkt", () => {
		setSetting("ai.base_url", "https://api.openai.com/v1");
		setSetting("ai.model", "gpt-4o-mini");
		setSetting("ai.provider", "arbeitskraft");
		setSetting("ai.apikey", "partner-schluessel");
		expect(getAiConfig()?.baseUrl).toBe(AI_PARTNER_BASE_URL);
	});

	it("Legacy-Konfiguration ohne provider-Eintrag gilt als benutzerdefinierter Endpunkt", () => {
		setSetting("ai.base_url", "https://api.openai.com/v1");
		setSetting("ai.model", "gpt-4o-mini");
		expect(getAiProvider()).toBe("custom");
		expect(isAiConfigured()).toBe(true);
		expect(getAiConfig()?.baseUrl).toBe("https://api.openai.com/v1");
	});

	it("getAiProvider meldet leer, wenn nichts konfiguriert ist", () => {
		expect(getAiProvider()).toBe("");
	});
});

describe("Anhang-Verarbeitung (src/lib/ai/attachments.ts)", () => {
	it("wandelt Excel-Arbeitsmappen in Semikolon-CSV-Text um (inkl. Datumswerten)", async () => {
		const workbook = new Workbook();
		const sheet = workbook.addWorksheet("Mieter");
		sheet.addRow(["Name", "Einheit", "Miete", "Beginn"]);
		sheet.addRow(["Max Mustermann", "Whg 1", 650.5, new Date(Date.UTC(2026, 0, 1))]);
		const buffer = await workbook.xlsx.writeBuffer();

		const result = await processAttachment("mieter.xlsx", Buffer.from(buffer).toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text).toContain('Tabellenblatt "Mieter"');
		expect(result.text).toContain("Name;Einheit;Miete;Beginn");
		expect(result.text).toContain("Max Mustermann;Whg 1;650.5;2026-01-01");
	});

	it("extrahiert Text aus PDFs (Roundtrip mit pdfkit-erzeugtem Dokument)", async () => {
		// Test-PDF mit pdfkit erzeugen (pdfkit ist bereits Projekt-Abhängigkeit).
		const chunks: Buffer[] = [];
		const pdfDoc = new PDFDocument({ bufferPages: true });
		pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
		const done = new Promise<void>((resolve) => pdfDoc.on("end", resolve));
		pdfDoc.fontSize(14).text("Nebenkostenabrechnung Musterweg 5");
		pdfDoc.moveDown().text("Gesamtkosten: 1.234,56 EUR");
		pdfDoc.addPage().fontSize(12).text("Seite zwei: Heizkosten 45 Prozent");
		pdfDoc.end();
		await done;
		const buffer = Buffer.concat(chunks);

		const result = await processAttachment("abrechnung.pdf", buffer.toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text).toContain("Nebenkostenabrechnung Musterweg 5");
		expect(result.text).toContain("Seite zwei: Heizkosten 45 Prozent");
		expect(result.text).toContain("--- Seite 1 ---");
		expect(result.text).toContain("--- Seite 2 ---");
	});

	it("lehnt PDFs ohne Textebene ab, wenn auch die OCR keinen Text findet", async () => {
		// PDF ohne Textinhalt erzeugen (nur leere Seite); der OCR-Mock
		// liefert standardmäßig eine leere Map (kein Text erkannt).
		const chunks: Buffer[] = [];
		const pdfDoc = new PDFDocument({ bufferPages: true });
		pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
		const done = new Promise<void>((resolve) => pdfDoc.on("end", resolve));
		pdfDoc.addPage();
		pdfDoc.end();
		await done;

		await expect(processAttachment("scan.pdf", Buffer.concat(chunks).toString("base64"))).rejects.toThrow(
			/auch die automatische Texterkennung \(OCR\) konnte keinen Text erkennen/
		);
		// Beide Seiten ohne Textebene wurden der OCR-Engine zur
		// Nachverarbeitung angeboten (pdfkit erzeugt die erste Seite
		// automatisch, die zweite per addPage).
		expect(ocrPdfPagesMock).toHaveBeenCalledTimes(1);
		expect(ocrPdfPagesMock.mock.calls[0][1]).toEqual([1, 2]);
	});

	it("liest gescannte PDFs ohne Textebene automatisch per OCR", async () => {
		const chunks: Buffer[] = [];
		const pdfDoc = new PDFDocument({ bufferPages: true });
		pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
		const done = new Promise<void>((resolve) => pdfDoc.on("end", resolve));
		pdfDoc.addPage();
		pdfDoc.end();
		await done;
		ocrPdfPagesMock.mockResolvedValue(new Map([[1, "Mietvertrag Musterweg 5, Kaltmiete 845,30 EUR"]]));

		const result = await processAttachment("scan.pdf", Buffer.concat(chunks).toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		// OCR-Seiten sind als solche markiert und der Hinweis auf
		// mögliche Erkennungsfehler steht am Anfang.
		expect(result.text).toContain("--- Seite 1 (per OCR erkannt) ---");
		expect(result.text).toContain("Mietvertrag Musterweg 5, Kaltmiete 845,30 EUR");
		expect(result.text.startsWith("Hinweis:")).toBe(true);
	});

	it("nutzt in gemischten PDFs die Textebene und ergänzt fehlende Seiten per OCR", async () => {
		// Seite 1 mit Textebene (pdfkit), Seite 2 ohne (leer).
		const chunks: Buffer[] = [];
		const pdfDoc = new PDFDocument({ bufferPages: true });
		pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
		const done = new Promise<void>((resolve) => pdfDoc.on("end", resolve));
		pdfDoc.fontSize(14).text("Anschreiben mit echter Textebene und genügend Zeichen");
		pdfDoc.addPage();
		pdfDoc.end();
		await done;
		ocrPdfPagesMock.mockResolvedValue(new Map([[2, "Eingescannter Anhang ohne Textebene"]]));

		const result = await processAttachment("gemischt.pdf", Buffer.concat(chunks).toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text).toContain("--- Seite 1 ---\nAnschreiben mit echter Textebene");
		expect(result.text).toContain("--- Seite 2 (per OCR erkannt) ---\nEingescannter Anhang ohne Textebene");
		// Nur die seitenlose Seite 2 wurde der OCR-Engine angeboten.
		expect(ocrPdfPagesMock).toHaveBeenCalledTimes(1);
		expect(ocrPdfPagesMock.mock.calls[0][1]).toEqual([2]);
	});

	it("meldet Scans ohne Textebene gewohnt ab, wenn die OCR-Engine nicht verfügbar ist", async () => {
		const chunks: Buffer[] = [];
		const pdfDoc = new PDFDocument({ bufferPages: true });
		pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
		const done = new Promise<void>((resolve) => pdfDoc.on("end", resolve));
		pdfDoc.addPage();
		pdfDoc.end();
		await done;
		ocrPdfPagesMock.mockRejectedValue(new OcrEngineError("Binary fehlt"));

		await expect(processAttachment("scan.pdf", Buffer.concat(chunks).toString("base64"))).rejects.toThrow(
			/OCR-Komponente steht auf dieser Installation nicht zur Verfügung/
		);
	});

	it("extrahiert Text aus DOCX (word/document.xml)", async () => {
		const zip = new JSZip();
		zip.file(
			"word/document.xml",
			'<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Sehr geehrte Damen &amp; Herren,</w:t></w:r></w:p><w:p><w:r><w:t>zweiter Absatz</w:t></w:r></w:p></w:body></w:document>'
		);
		const buffer = await zip.generateAsync({ type: "nodebuffer" });

		const result = await processAttachment("brief.docx", buffer.toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text).toContain("Sehr geehrte Damen & Herren,");
		expect(result.text).toContain("zweiter Absatz");
	});

	it("extrahiert Text aus PPTX-Folien (nummeriert, sortiert)", async () => {
		const zip = new JSZip();
		zip.file("ppt/slides/slide2.xml", '<p:sld><p:cSld><p:spTree><a:p><a:r><a:t>Folie zwei</a:t></a:r></a:p></p:spTree></p:cSld></p:sld>');
		zip.file("ppt/slides/slide1.xml", '<p:sld><p:cSld><p:spTree><a:p><a:r><a:t>Folie eins</a:t></a:r></a:p></p:spTree></p:cSld></p:sld>');
		const buffer = await zip.generateAsync({ type: "nodebuffer" });

		const result = await processAttachment("praesentation.pptx", buffer.toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text.indexOf("Folie eins")).toBeLessThan(result.text.indexOf("Folie zwei"));
		expect(result.text).toContain("--- Folie 1 ---");
		expect(result.text).toContain("--- Folie 2 ---");
	});

	it("extrahiert Text aus OpenDocument-Dateien (content.xml, Tabellen als CSV-Näherung)", async () => {
		const zip = new JSZip();
		zip.file(
			"content.xml",
			'<?xml version="1.0"?><office:document-content><office:body><office:text><text:p>Erster Absatz</text:p></office:text><office:spreadsheet><table:table><table:table-row><table:table-cell><text:p>Name</text:p></table:table-cell><table:table-cell><text:p>Wert</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>'
		);
		const buffer = await zip.generateAsync({ type: "nodebuffer" });

		const result = await processAttachment("liste.ods", buffer.toString("base64"));

		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text).toContain("Erster Absatz");
		expect(result.text).toContain("Name");
		expect(result.text).toContain("Wert");
	});

	it("reicht Bilder als Vision-Input unverändert durch", async () => {
		const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]); // PNG-Magic + Dummy-Daten
		const result = await processAttachment("foto.png", pngBytes.toString("base64"));
		expect(result).toEqual({ kind: "image", mimeType: "image/png", dataBase64: pngBytes.toString("base64") });

		const jpgResult = await processAttachment("scan.JPG", pngBytes.toString("base64"));
		expect(jpgResult.kind).toBe("image");
		if (jpgResult.kind !== "image") return;
		expect(jpgResult.mimeType).toBe("image/jpeg");
	});

	it("übernimmt Textdateien direkt (auch Code-Dateien)", async () => {
		const result = await processAttachment("skript.ts", Buffer.from("const x = 1;", "utf8").toString("base64"));
		expect(result).toEqual({ kind: "text", text: "const x = 1;" });
	});

	it("lehnt die alten Office-Formate mit Hinweis ab", async () => {
		await expect(processAttachment("alt.xls", Buffer.from("irgendwas").toString("base64"))).rejects.toThrow(AttachmentError);
		await expect(processAttachment("alt.xls", Buffer.from("irgendwas").toString("base64"))).rejects.toThrow(/xlsx speichern/);
		await expect(processAttachment("alt.doc", Buffer.from("irgendwas").toString("base64"))).rejects.toThrow(/docx speichern/);
		await expect(processAttachment("alt.ppt", Buffer.from("irgendwas").toString("base64"))).rejects.toThrow(/pptx speichern/);
	});

	it("lehnt nicht unterstützte Dateitypen ab", async () => {
		await expect(processAttachment("archiv.zip", Buffer.from("irgendwas").toString("base64"))).rejects.toThrow(/nicht unterstützt/);
		await expect(processAttachment("film.mp4", Buffer.from("irgendwas").toString("base64"))).rejects.toThrow(/nicht unterstützt/);
	});

	it("kürzt übergroße Texte mit Hinweis", async () => {
		const result = await processAttachment("gross.txt", Buffer.from("x".repeat(70_000)).toString("base64"));
		expect(result.kind).toBe("text");
		if (result.kind !== "text") return;
		expect(result.text.length).toBeLessThan(62_000);
		expect(result.text).toContain("gekürzt");
	});
});

describe("Chat-Tool-Loop (src/lib/ai/chat.ts)", () => {
	it("wirft ChatError, wenn kein Endpunkt konfiguriert ist", async () => {
		await expect(
			runChat({ messages: [{ role: "user", content: "Hallo" }], attachments: [], userEmail: "a@b.c", userRole: "ADMIN" })
		).rejects.toThrow(ChatError);
	});

	it("nutzt im Partner-Modus automatisch den arbeitskraft.app-Endpunkt mit dem Empfehlungsmodell", async () => {
		setSetting("ai.provider", "arbeitskraft");
		setSetting("ai.apikey", "partner-schluessel");
		const fetchMock = mockFetchSequence([{ role: "assistant", content: "Alles klar." }]);

		const result = await runChat({
			messages: [{ role: "user", content: "Sag alles klar." }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toBe("Alles klar.");
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(`${AI_PARTNER_BASE_URL}/chat/completions`);
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer partner-schluessel");
		const body = JSON.parse(String(init.body)) as { model: string };
		expect(body.model).toBe(AI_PARTNER_MODEL);
	});

	it("führt vom Modell angeforderte Werkzeuge aus und liefert die Abschlussantwort", async () => {
		ensureTestTool();
		configureAi();
		const fetchMock = mockFetchSequence([
			{
				role: "assistant",
				content: null,
				tool_calls: [
					{ id: "call_1", type: "function", function: { name: "test_echo_tool", arguments: '{"text":"hallo"}' } },
				],
			},
			{ role: "assistant", content: "Das Echo lautet: hallo." },
		]);

		const result = await runChat({
			messages: [{ role: "user", content: "Echo bitte." }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toBe("Das Echo lautet: hallo.");
		expect(result.toolCalls).toEqual([{ name: "test_echo_tool", ok: true }]);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		// Erster Request: System-Prompt + Nutzernachricht + Werkzeugliste + Auth-Header.
		const [url1, init1] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url1).toBe("https://ki.example.test/v1/chat/completions");
		expect((init1.headers as Record<string, string>).Authorization).toBe("Bearer geheimer-schluessel");
		const body1 = JSON.parse(String(init1.body)) as {
			model: string;
			messages: { role: string; content: string }[];
			tools: { function: { name: string } }[];
		};
		expect(body1.model).toBe("test-modell");
		expect(body1.messages[0].role).toBe("system");
		expect(body1.messages[0].content).toContain("admin@test.de");
		expect(body1.messages[1]).toEqual({ role: "user", content: "Echo bitte." });
		expect(body1.tools.some((tool) => tool.function.name === "test_echo_tool")).toBe(true);
		// Die MCP-Werkzeuge stehen dem Modell ebenfalls zur Verfügung.
		expect(body1.tools.some((tool) => tool.function.name === "properties_list")).toBe(true);

		// Zweiter Request: enthält die Assistant-Nachricht mit tool_calls und
		// die Tool-Antwort (role "tool", Bezug über tool_call_id).
		const body2 = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
			messages: { role: string; content: string | null; tool_call_id?: string; tool_calls?: unknown[] }[];
		};
		const toolMessage = body2.messages.find((message) => message.role === "tool");
		expect(toolMessage?.tool_call_id).toBe("call_1");
		expect(toolMessage?.content).toContain('"echo": "hallo"');
	});

	it("meldet Werkzeug-Fehler als Tool-Ergebnis ans Modell (statt abzubrechen)", async () => {
		configureAi();
		mockFetchSequence([
			{
				role: "assistant",
				content: null,
				tool_calls: [{ id: "call_9", type: "function", function: { name: "unbekanntes_tool", arguments: "{}" } }],
			},
			{ role: "assistant", content: "Das Werkzeug existiert nicht." },
		]);

		const result = await runChat({
			messages: [{ role: "user", content: "Test" }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toBe("Das Werkzeug existiert nicht.");
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls[0].ok).toBe(false);
		expect(result.toolCalls[0].detail).toContain("Unbekanntes Werkzeug");
	});

	it("fügt Anhang-Text in die letzte Nutzernachricht ein", async () => {
		configureAi();
		const fetchMock = mockFetchSequence([{ role: "assistant", content: "Verstanden." }]);

		const result = await runChat({
			messages: [{ role: "user", content: "Lies die Datei." }],
			attachments: [{ name: "werte.csv", dataBase64: Buffer.from("Name;Wert\nA;1", "utf8").toString("base64") }],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toBe("Verstanden.");
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { messages: { role: string; content: string }[] };
		const userMessage = body.messages.find((message) => message.role === "user");
		expect(userMessage?.content).toContain("Lies die Datei.");
		expect(userMessage?.content).toContain('Beginn Datei-Anhang "werte.csv"');
		expect(userMessage?.content).toContain("Name;Wert");
	});

	it("sendet Bild-Anhänge als image_url-Content-Parts (Vision-Format)", async () => {
		configureAi();
		const fetchMock = mockFetchSequence([{ role: "assistant", content: "Ich sehe das Bild." }]);
		const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64");

		const result = await runChat({
			messages: [{ role: "user", content: "Was ist auf dem Bild?" }],
			attachments: [
				{ name: "foto.png", dataBase64: pngBase64 },
				{ name: "notizen.txt", dataBase64: Buffer.from("Begleittext zur Datei", "utf8").toString("base64") },
			],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toBe("Ich sehe das Bild.");
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
			messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[];
		};
		const userMessage = body.messages.find((message) => message.role === "user");
		expect(Array.isArray(userMessage?.content)).toBe(true);
		const parts = userMessage!.content as { type: string; text?: string; image_url?: { url: string } }[];
		expect(parts[0].type).toBe("text");
		expect(parts[0].text).toContain("Was ist auf dem Bild?");
		// Text-Anhang landet im Text-Part...
		expect(parts[0].text).toContain('Beginn Datei-Anhang "notizen.txt"');
		expect(parts[0].text).toContain("Begleittext zur Datei");
		// ...das Bild als eigener image_url-Part mit Data-URL.
		expect(parts[1]).toEqual({ type: "image_url", image_url: { url: `data:image/png;base64,${pngBase64}` } });
	});

	it("wirft AiClientError bei HTTP-Fehlern des Endpunkts", async () => {
		configureAi();
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ error: { message: "invalid api key" } }), { status: 401 })
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			runChat({ messages: [{ role: "user", content: "Hallo" }], attachments: [], userEmail: "admin@test.de", userRole: "ADMIN" })
		).rejects.toThrow(/HTTP 401.*API-Schlüssel prüfen/);
		// Fachliche Fehler (4xx außer 408/429) werden NICHT wiederholt.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("wiederholt vorübergehende Upstream-Timeouts (HTTP 524) und liefert dann die Antwort", async () => {
		configureAi();
		let attempts = 0;
		const fetchMock = vi.fn(async () => {
			attempts++;
			// Die ersten beiden Aufrufe: Cloudflare-Timeout (HTML-Fehlerseite,
			// kein JSON); der dritte geht durch.
			if (attempts <= 2) {
				return new Response("<html>524: A Timeout Occurred</html>", { status: 524 });
			}
			return completionResponse({ role: "assistant", content: "Antwort nach Wiederholung." });
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await runChat({
			messages: [{ role: "user", content: "Hallo" }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toBe("Antwort nach Wiederholung.");
		expect(fetchMock).toHaveBeenCalledTimes(3);
		// Echter Backoff (1 s + 2 s) - daher großzügiges Test-Timeout.
	}, 15_000);

	it("wirft AiClientError mit Timeout-Hinweis, wenn der Endpunkt dauerhaft 524 meldet", async () => {
		configureAi();
		const fetchMock = vi.fn(async () => new Response("<html>524: A Timeout Occurred</html>", { status: 524 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			runChat({ messages: [{ role: "user", content: "Hallo" }], attachments: [], userEmail: "admin@test.de", userRole: "ADMIN" })
		).rejects.toThrow(/HTTP 524.*Timeout/);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	}, 15_000);

	it("schränkt die Werkzeuge für normale Nutzer ein (keine Admin-Werkzeuge)", async () => {
		ensureTestTool();
		configureAi();
		const fetchMock = mockFetchSequence([
			// Das Modell versucht trotz eingeschränktem Angebot ein Admin-Werkzeug.
			{
				role: "assistant",
				content: null,
				tool_calls: [{ id: "call_7", type: "function", function: { name: "users_list", arguments: "{}" } }],
			},
			{ role: "assistant", content: "Dafür ist ein Administratorkonto nötig." },
		]);

		const result = await runChat({
			messages: [{ role: "user", content: "Liste alle Benutzerkonten." }],
			attachments: [],
			userEmail: "user@test.de",
			userRole: "USER",
		});

		// Dem Endpunkt werden keine Admin-Werkzeuge angeboten...
		const body1 = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
			messages: { role: string; content: string }[];
			tools: { function: { name: string } }[];
		};
		const offeredToolNames = body1.tools.map((tool) => tool.function.name);
		expect(offeredToolNames).toContain("properties_list");
		expect(offeredToolNames).not.toContain("users_list");
		expect(offeredToolNames).not.toContain("users_set_approval");
		expect(offeredToolNames).not.toContain("company_settings_update");
		// ...und der System-Prompt erklärt die Einschränkung.
		expect(body1.messages[0].content).toContain("KEIN Administrator");

		// Ein dennoch angefordertes Admin-Werkzeug wird als Fehler ans Modell gemeldet.
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls[0].ok).toBe(false);
		expect(result.toolCalls[0].detail).toContain("nur Administratoren");
		expect(result.reply).toBe("Dafür ist ein Administratorkonto nötig.");
	});

	it("führt batch_execute aus und schlüsselt die Einzelaufrufe in der UI-Liste auf", async () => {
		configureAi();
		const fetchMock = mockFetchSequence([
			{
				role: "assistant",
				content: null,
				tool_calls: [
					{
						id: "call_batch",
						type: "function",
						function: {
							name: "batch_execute",
							arguments: JSON.stringify({
								calls: [
									{ name: "properties_create", arguments: { name: "Haus A", street: "S", zipCode: "1", city: "C", country: "D" } },
									// Bewusst fehlerhafter Unteraufruf (Pflichtfeld fehlt).
									{ name: "properties_create", arguments: { street: "S" } },
								],
							}),
						},
					},
				],
			},
			{ role: "assistant", content: "Haus A wurde angelegt, der zweite Eintrag war fehlerhaft." },
		]);

		const result = await runChat({
			messages: [{ role: "user", content: "Lege zwei Liegenschaften an." }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toContain("Haus A wurde angelegt");
		// Statt eines pauschalen batch_execute-Eintrags werden die beiden
		// Unteraufrufe mit ihrem eigenen Status ausgewiesen.
		expect(result.toolCalls).toHaveLength(2);
		expect(result.toolCalls[0]).toEqual({ name: "properties_create", ok: true });
		expect(result.toolCalls[1].name).toBe("properties_create");
		expect(result.toolCalls[1].ok).toBe(false);
		expect(result.toolCalls[1].detail).toContain('Pflichtfeld "name"');

		// Das Batch-Werkzeug wird dem Modell angeboten...
		const body1 = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { tools: { function: { name: string } }[] };
		expect(body1.tools.some((tool) => tool.function.name === "batch_execute")).toBe(true);

		// ...und das Batch-Ergebnis geht als Tool-Antwort zurück ans Modell.
		const body2 = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
			messages: { role: string; content: string | null; tool_call_id?: string }[];
		};
		const toolMessage = body2.messages.find((message) => message.role === "tool");
		expect(toolMessage?.tool_call_id).toBe("call_batch");
		expect(toolMessage?.content).toContain('"succeeded": 1');
		expect(toolMessage?.content).toContain('"failed": 1');
	});

	it("liefert bei Budget-Erschöpfung eine Schlussrunde ohne Werkzeuge (statt hartem Fehler)", async () => {
		ensureTestTool();
		configureAi();
		// Das Modell fordert das Maximum von 25 Werkzeug-Runden aus und
		// liefert erst in der Schlussrunde (ohne Werkzeugangebot) Text.
		const toolRoundMessages = Array.from({ length: 25 }, (_, index) => ({
			role: "assistant",
			content: null,
			tool_calls: [
				{ id: `call_${index}`, type: "function", function: { name: "test_echo_tool", arguments: '{"text":"x"}' } },
			],
		}));
		const fetchMock = mockFetchSequence([
			...toolRoundMessages,
			{ role: "assistant", content: "Zwischenbilanz: 12 von 20 Mietern angelegt, Rest offen." },
		]);

		const result = await runChat({
			messages: [{ role: "user", content: "Lege alle Mieter aus der Tabelle an." }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		// Kein Fehler: Die Schlussrunde liefert die Zwischenbilanz als Antwort.
		expect(result.reply).toBe("Zwischenbilanz: 12 von 20 Mietern angelegt, Rest offen.");
		expect(result.toolCalls).toHaveLength(25);
		expect(result.toolCalls.every((call) => call.ok)).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(26);

		// Die Budget-Frühwarnung erscheint im Request nach der 20. Runde
		// (ab 5 verbleibenden Runden) als system-Nachricht.
		const warningRequest = JSON.parse(String(fetchMock.mock.calls[20][1]?.body)) as {
			messages: { role: string; content: string }[];
		};
		const warning = warningRequest.messages.find(
			(message) => message.role === "system" && message.content.includes("verbleiben nur noch 5 Werkzeug-Runden")
		);
		expect(warning).toBeDefined();

		// Der letzte Request (Schlussrunde) enthält den Erschöpfungs-Hinweis
		// und KEIN Werkzeugangebot mehr (weder tools noch tool_choice).
		const finalRequest = JSON.parse(String(fetchMock.mock.calls[25][1]?.body)) as {
			messages: { role: string; content: string }[];
			tools?: unknown;
			tool_choice?: unknown;
		};
		expect(finalRequest.tools).toBeUndefined();
		expect(finalRequest.tool_choice).toBeUndefined();
		const finalNote = finalRequest.messages.find(
			(message) => message.role === "system" && message.content.includes("Werkzeug-Budget ist erschöpft")
		);
		expect(finalNote).toBeDefined();
	});

	it("greift auf eine eigene Bilanz zurück, wenn auch die Schlussrunde keine Antwort liefert", async () => {
		ensureTestTool();
		configureAi();
		const toolRoundMessages = Array.from({ length: 25 }, (_, index) => ({
			role: "assistant",
			content: null,
			tool_calls: [
				{ id: `call_${index}`, type: "function", function: { name: "test_echo_tool", arguments: '{"text":"x"}' } },
			],
		}));
		mockFetchSequence([...toolRoundMessages, { role: "assistant", content: null }]);

		const result = await runChat({
			messages: [{ role: "user", content: "Lege alles an." }],
			attachments: [],
			userEmail: "admin@test.de",
			userRole: "ADMIN",
		});

		expect(result.reply).toContain("Werkzeug-Budget von 25 Runden ist erschöpft");
		expect(result.reply).toContain("25 Werkzeugaufrufe");
		expect(result.reply).toContain("weiter");
		expect(result.toolCalls).toHaveLength(25);
	});
});
