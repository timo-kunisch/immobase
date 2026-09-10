import { Workbook } from "exceljs";
import type { CellValue } from "exceljs";
import JSZip from "jszip";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

import { deMessages } from "@/lib/i18n/messages/de";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translator";

import {
	EXCEL_ATTACHMENT_EXTENSIONS,
	IMAGE_ATTACHMENT_MIME_TYPES,
	MAX_ATTACHMENT_BYTES,
	OFFICE_ATTACHMENT_EXTENSIONS,
	PDF_ATTACHMENT_EXTENSIONS,
	TEXT_ATTACHMENT_EXTENSIONS,
} from "./attachment-types";
import { OcrEngineError, ocrPdfPages } from "./ocr";

/**
 * Standard-Übersetzer (Deutsch) für Aufrufe ohne eigenen t()-Parameter -
 * u. a. die Unit-Tests, die ohne next/headers-Kontext laufen. Der Chat
 * (src/lib/ai/chat.ts) übergibt den Übersetzer der gewählten App-Sprache.
 */
const defaultT = createTranslator(deMessages);

/**
 * Verarbeitung von Datei-Anhängen des KI-Chats (src/lib/ai/chat.ts): Damit
 * das Modell mit angehängten Dateien arbeiten kann, wird der Inhalt
 * serverseitig aufbereitet - die wenigsten OpenAI-kompatiblen Endpunkte
 * akzeptieren Datei-Uploads direkt.
 *
 * Unterstützte Typen (Listen siehe attachment-types.ts):
 * - Bilder (png/jpg/gif/webp): werden als Vision-Input (image_url mit
 *   Base64-Data-URL) ans Modell durchgereicht - setzt ein multimodales
 *   Modell voraus (OpenAI-kompatible "vision"-fähige Modelle). Hinweis auf
 *   diese Voraussetzung steht in den Einstellungen.
 * - PDF: Textextraktion je Seite via pdfjs-dist (Node-geeigneter
 *   legacy-Build). Seiten ohne (nennenswerte) Textebene - typischerweise
 *   Scans - werden automatisch per OCR nachverarbeitet (src/lib/ai/ocr.ts:
 *   pdfjs-Rasterung + tesseract.js mit gebündeltem deutschen Sprachmodell,
 *   vollständig offline); OCR-Seiten sind im Text als solche markiert.
 * - Excel (.xlsx/.xlsm/.xltx/.xltm) via exceljs: Jedes Tabellenblatt wird
 *   als CSV-Text (Semikolon-getrennt, deutsche Excel-Konvention) abgelegt.
 *   Legacy-.xls wird von exceljs nicht gelesen - Hinweis "Als .xlsx
 *   speichern".
 * - Office-Open-XML/OpenDocument (.docx/.pptx/.odt/.ods/.odp) via jszip:
 *   Textextraktion aus dem XML-Inhalt (Absätze/Zeilen, ODS-Zellen als
 *   Semikolon-CSV-Näherung). Legacy-.doc/.ppt werden mit Hinweis abgelehnt.
 * - Text-/Datendateien (csv, txt, md, json, xml, Code-Dateien u. a.):
 *   direkte Übernahme.
 *
 * Schutz vor übergroßen Kontexten: harte Obergrenzen für Dateigröße,
 * Zeilen je Tabellenblatt, Seiten je PDF und extrahierte Zeichen je Datei
 * (mit Kürzungshinweis im Text).
 */

/** Fachlicher Fehler bei der Anhang-Verarbeitung (wird dem Nutzer gemeldet). */
export class AttachmentError extends Error {}

/** Aufbereiteter Anhang: extrahierter Text ODER Bild für den Vision-Pfad. */
export type ProcessedAttachment =
	| { kind: "text"; text: string }
	| { kind: "image"; mimeType: string; dataBase64: string };

/** Maximale Tabellenzeilen je Tabellenblatt (Überschuss wird abgeschnitten). */
const MAX_ROWS_PER_SHEET = 500;
/** Maximale PDF-Seiten (Überschuss wird abgeschnitten). */
const MAX_PDF_PAGES = 200;
/** Maximale Textlänge je Anhang (Überschuss wird abgeschnitten). */
const MAX_CHARS_PER_ATTACHMENT = 60_000;
/**
 * Ab dieser Zeichenzahl gilt die Textebene einer PDF-Seite als vorhanden;
 * darunter (z. B. reine Scans oder nur eine eingebettete Seitenzahl) läuft
 * die OCR-Nachverarbeitung für die Seite.
 */
const MIN_PAGE_TEXT_CHARS = 20;
/** Maximale Seiten je PDF, für die OCR läuft (Tempo-Schutz; Überschuss wird übersprungen). */
const MAX_OCR_PAGES = 20;

const TEXT_EXTENSIONS = new Set<string>(TEXT_ATTACHMENT_EXTENSIONS);
const EXCEL_EXTENSIONS = new Set<string>(EXCEL_ATTACHMENT_EXTENSIONS);
const OFFICE_EXTENSIONS = new Set<string>(OFFICE_ATTACHMENT_EXTENSIONS);

function fileExtension(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function truncateText(text: string, t: TranslateFn): string {
	if (text.length <= MAX_CHARS_PER_ATTACHMENT) return text;
	return `${text.slice(0, MAX_CHARS_PER_ATTACHMENT)}\n${t("chat.attach.truncatedChars", { max: MAX_CHARS_PER_ATTACHMENT })}`;
}

// ------------------------------------------------------------
// Excel (exceljs)
// ------------------------------------------------------------

/** Wandelt einen exceljs-Zellwert in kompakten Text um (Formeln → Ergebnis). */
function cellToText(value: CellValue): string {
	if (value === null || value === undefined) return "";
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === "object") {
		if ("richText" in value) return value.richText.map((part) => part.text).join("");
		if ("result" in value) return cellToText(value.result as CellValue);
		if ("text" in value) return String(value.text ?? "");
		if ("error" in value) return String(value.error);
		return String(value);
	}
	return String(value);
}

/** CSV-Feld (Semikolon-Delimiter) mit Quote-Escaping. */
function csvField(text: string): string {
	if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
	return text;
}

async function excelToText(buffer: Buffer, name: string, t: TranslateFn): Promise<string> {
	const workbook = new Workbook();
	try {
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
	} catch (error) {
		console.warn("[ai] Excel-Datei konnte nicht gelesen werden:", error);
		throw new AttachmentError(t("chat.attach.excelUnreadable", { name }));
	}

	const parts: string[] = [];
	workbook.eachSheet((worksheet) => {
		const rows: string[] = [];
		let truncated = false;
		worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber > MAX_ROWS_PER_SHEET) {
				truncated = true;
				return;
			}
			const values = row.values as CellValue[];
			// row.values ist 1-basiert (Index 0 ist undefined).
			const fields = values.slice(1).map(cellToText);
			while (fields.length > 0 && fields[fields.length - 1] === "") fields.pop();
			rows.push(fields.map(csvField).join(";"));
		});
		if (rows.length === 0) return;
		parts.push(
			`${t("chat.attach.sheetHeader", {
				sheet: worksheet.name,
				rows: rows.length,
				truncation: truncated ? t("chat.attach.sheetTruncated", { max: MAX_ROWS_PER_SHEET }) : "",
			})}\n${rows.join("\n")}`
		);
	});

	if (parts.length === 0) {
		throw new AttachmentError(t("chat.attach.excelNoData", { name }));
	}
	return parts.join("\n\n");
}

// ------------------------------------------------------------
// PDF (pdfjs-dist, legacy-Node-Build)
// ------------------------------------------------------------

/**
 * pdfjs-dist wird bewusst LAZY importiert: Die Engine setzt je nach Version
 * Browser-Globals voraus (z. B. DOMMatrix - fehlt in älterem Node, u. a. dem
 * eingebetteten Node der Electron-Shell). Schlägt das Laden fehl, soll nur
 * der PDF-Anhang scheitern (AttachmentError), nicht der gesamte Chat.
 *
 * Version bewusst auf der 4.x-Linie halten: Diese lädt im reinen
 * Node-Kontext ohne DOM-Globals (ab 5.x wird DOMMatrix bereits beim
 * Modul-Import zwingend erwartet). Die OCR-Rasterung (src/lib/ai/ocr.ts)
 * nutzt @napi-rs/canvas - genau die Bibliothek, die pdfjs 4.x selbst als
 * optionale Abhängigkeit deklariert; Version daran ausrichten.
 */
async function loadPdfJs(t: TranslateFn): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
	try {
		return await import("pdfjs-dist/legacy/build/pdf.mjs");
	} catch (error) {
		console.error("[ai] pdfjs-dist konnte nicht geladen werden:", error);
		throw new AttachmentError(t("chat.attach.pdfEngineUnavailable"));
	}
}

/** Extrahiert den Text einer einzelnen PDF-Seite (leer, wenn keine Textebene). */
async function extractPageText(page: { getTextContent(): Promise<{ items: unknown[] }> }): Promise<string> {
	const content = await page.getTextContent();
	return content.items
		.map((item) => (typeof item === "object" && item !== null && "str" in item ? String((item as TextItem).str) : ""))
		// Leerzeichen zwischen Textstücken: pdf.js liefert die Items oft
		// wort-/fragmentweise, ein schlichter Abstand ist die robusteste
		// Näherung (zeilengetreue Rekonstruktion wäre erheblich aufwendiger).
		.join(" ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

async function pdfToText(buffer: Buffer, name: string, t: TranslateFn): Promise<string> {
	const { getDocument } = await loadPdfJs(t);

	let task: ReturnType<typeof getDocument>;
	try {
		task = getDocument({
			data: new Uint8Array(buffer),
			isEvalSupported: false,
			// Keine Font-Einbettung nötig (reine Textextraktion) - vermeidet
			// unnötige Dateisystem-/Netzwerkzugriffe der Engine.
			useSystemFonts: true,
			disableFontFace: true,
		});
	} catch (error) {
		console.warn("[ai] PDF-Initialisierung fehlgeschlagen:", error);
		throw new AttachmentError(t("chat.attach.pdfOpenFailed", { name }));
	}

	try {
		const pdf = await task.promise;
		const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);

		// 1) Textebene je Seite extrahieren.
		const pageTexts: string[] = [];
		for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
			const page = await pdf.getPage(pageNumber);
			pageTexts.push(await extractPageText(page));
		}

		// 2) Seiten ohne nennenswerte Textebene (typisch: Scans) per OCR
		// nachverarbeiten - gerastert und lokal durch tesseract.js.
		const ocrCandidates: number[] = [];
		for (let index = 0; index < pageTexts.length; index++) {
			if (pageTexts[index].length < MIN_PAGE_TEXT_CHARS) ocrCandidates.push(index + 1);
		}
		const ocrPageNumbers = ocrCandidates.slice(0, MAX_OCR_PAGES);
		let ocrResults = new Map<number, string>();
		let ocrUnavailable = false;
		if (ocrPageNumbers.length > 0) {
			try {
				ocrResults = await ocrPdfPages(pdf, ocrPageNumbers);
			} catch (error) {
				if (!(error instanceof OcrEngineError)) throw error;
				// OCR-Engine nicht verfügbar (z. B. Plattform-Binary fehlt):
				// Verhalten wie vor Einführung der OCR - Text verwenden, soweit
				// vorhanden, sonst die gewohnte Fehlermeldung.
				console.warn("[ai] OCR-Engine nicht verfügbar - Scans können nicht gelesen werden:", error.message);
				ocrUnavailable = true;
			}
		}

		// 3) Zusammenführen: Textebene hat Vorrang, OCR füllt die Lücken.
		const parts: string[] = [];
		let ocrUsed = false;
		for (let index = 0; index < pageTexts.length; index++) {
			const pageNumber = index + 1;
			const embeddedText = pageTexts[index];
			if (embeddedText.length >= MIN_PAGE_TEXT_CHARS) {
				parts.push(`${t("chat.attach.pageMarker", { page: pageNumber })}\n${embeddedText}`);
				continue;
			}
			const ocrText = ocrResults.get(pageNumber);
			if (ocrText) {
				ocrUsed = true;
				parts.push(`${t("chat.attach.pageMarkerOcr", { page: pageNumber })}\n${ocrText}`);
			} else if (embeddedText) {
				// Winzige Textreste (z. B. eine eingebettete Seitenzahl) trotzdem übernehmen.
				parts.push(`${t("chat.attach.pageMarker", { page: pageNumber })}\n${embeddedText}`);
			}
		}

		if (parts.length === 0) {
			throw new AttachmentError(t(ocrUnavailable ? "chat.attach.pdfOcrUnavailable" : "chat.attach.pdfNoText", { name }));
		}

		let result = parts.join("\n\n");
		if (ocrUsed) {
			result = `${t("chat.attach.ocrNotice")}\n\n${result}`;
		}
		if (ocrCandidates.length > MAX_OCR_PAGES) {
			result += `\n\n${t("chat.attach.ocrPagesTruncated", { max: MAX_OCR_PAGES, total: ocrCandidates.length })}`;
		}
		if (pdf.numPages > MAX_PDF_PAGES) {
			result += `\n\n${t("chat.attach.pdfPagesTruncated", { max: MAX_PDF_PAGES, total: pdf.numPages })}`;
		}
		return result;
	} catch (error) {
		if (error instanceof AttachmentError) throw error;
		const message = error instanceof Error ? error.message : String(error);
		if (/password/i.test(message)) {
			throw new AttachmentError(t("chat.attach.pdfPassword", { name }));
		}
		console.warn("[ai] PDF-Extraktion fehlgeschlagen:", error);
		throw new AttachmentError(t("chat.attach.pdfReadFailed", { name }));
	} finally {
		// Ressourcen (Worker) freigeben - wichtig bei wiederholten Anhängen.
		await task.destroy().catch(() => {});
	}
}

// ------------------------------------------------------------
// ZIP-basierte Office-Formate (docx/pptx + OpenDocument odt/ods/odp)
// ------------------------------------------------------------

/** Dekodiert die XML-Standard-Entities sowie numerische Referenzen. */
function decodeXmlEntities(text: string): string {
	return text
		.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&"); // bewusst zuletzt
}

/**
 * Wandelt Office-XML (docx/pptx/ODF) in lesbaren Text um: Struktur-Elemente
 * (Absätze, Zeilenumbrüche, Tabulatoren, Tabellenzeilen/-zellen) werden auf
 * Zeilenumbrüche/Trenner abgebildet, alle übrigen Tags entfernt.
 */
function officeXmlToText(xml: string): string {
	const text = xml
		// docx: Absätze, Tabulator, Zeilenumbruch, Tabellen
		.replace(/<w:tab\s*\/>/g, "\t")
		.replace(/<w:br\s*\/>/g, "\n")
		.replace(/<\/w:p>/g, "\n")
		.replace(/<\/w:tc>/g, ";\t")
		.replace(/<\/w:tr>/g, "\n")
		// pptx: Absätze und Zeilenumbrüche
		.replace(/<a:br\s*\/>/g, "\n")
		.replace(/<\/a:p>/g, "\n")
		// OpenDocument: Zeilenumbruch, Tabulator, Leerzeichen-Runs, Absätze, Tabellen
		.replace(/<text:line-break\s*\/>/g, "\n")
		.replace(/<text:tab\s*\/>/g, "\t")
		.replace(/<text:s text:c="(\d+)"\s*\/>/g, (_match, count: string) => " ".repeat(Number(count)))
		.replace(/<text:s\s*\/>/g, " ")
		.replace(/<\/text:p>/g, "\n")
		.replace(/<\/text:h>/g, "\n")
		.replace(/<\/table:table-cell>/g, ";\t")
		.replace(/<\/table:table-row>/g, "\n")
		// Alle übrigen Tags entfernen
		.replace(/<[^>]+>/g, "");
	return decodeXmlEntities(text)
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

async function readZipTextFile(zip: JSZip, filePath: string): Promise<string | null> {
	const entry = zip.file(filePath);
	if (!entry) return null;
	return entry.async("string");
}

async function officeToText(buffer: Buffer, name: string, extension: string, t: TranslateFn): Promise<string> {
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(buffer);
	} catch (error) {
		console.warn("[ai] Office-Datei konnte nicht als ZIP geöffnet werden:", error);
		throw new AttachmentError(t("chat.attach.officeInvalid", { name, extension: extension.toUpperCase() }));
	}

	try {
		switch (extension) {
			case "docx": {
				const xml = await readZipTextFile(zip, "word/document.xml");
				if (xml === null) throw new AttachmentError(t("chat.attach.docxInvalid", { name }));
				return officeXmlToText(xml);
			}
			case "pptx": {
				const slideNames = Object.keys(zip.files)
					.filter((filePath) => /^ppt\/slides\/slide\d+\.xml$/.test(filePath))
					.sort((a, b) => Number(/slide(\d+)\.xml$/.exec(a)![1]) - Number(/slide(\d+)\.xml$/.exec(b)![1]));
				const parts: string[] = [];
				for (const [index, filePath] of slideNames.entries()) {
					const text = officeXmlToText((await readZipTextFile(zip, filePath)) ?? "");
					if (text) parts.push(`${t("chat.attach.slideMarker", { index: index + 1 })}\n${text}`);
				}
				if (parts.length === 0) throw new AttachmentError(t("chat.attach.pptxNoText", { name }));
				return parts.join("\n\n");
			}
			default: {
				// OpenDocument (odt/ods/odp): gesamter Inhalt in content.xml
				const xml = await readZipTextFile(zip, "content.xml");
				if (xml === null) {
					throw new AttachmentError(t("chat.attach.odfInvalid", { name }));
				}
				return officeXmlToText(xml);
			}
		}
	} catch (error) {
		if (error instanceof AttachmentError) throw error;
		console.warn("[ai] Office-Extraktion fehlgeschlagen:", error);
		throw new AttachmentError(t("chat.attach.officeReadFailed", { name }));
	}
}

// ------------------------------------------------------------
// Einstiegspunkt
// ------------------------------------------------------------

/**
 * Verarbeitet einen Anhang: liefert extrahierten Text oder ein Bild
 * (Vision-Input). Wirft AttachmentError bei nicht unterstützten Dateitypen,
 * unlesbaren Dateien oder Überschreitung der Größenobergrenze. Die
 * Fehlertexte folgen der Sprache des übergebenen Übersetzers (Default:
 * Deutsch - runChat übergibt die gewählte App-Sprache).
 */
export async function processAttachment(name: string, dataBase64: string, t: TranslateFn = defaultT): Promise<ProcessedAttachment> {
	let buffer: Buffer;
	try {
		buffer = Buffer.from(dataBase64, "base64");
	} catch {
		throw new AttachmentError(t("chat.attach.invalidBase64", { name }));
	}
	if (buffer.length === 0) {
		throw new AttachmentError(t("chat.attach.empty", { name }));
	}
	if (buffer.length > MAX_ATTACHMENT_BYTES) {
		throw new AttachmentError(
			t("chat.attach.tooLarge", {
				name,
				size: (buffer.length / 1024 / 1024).toFixed(1),
				max: MAX_ATTACHMENT_BYTES / 1024 / 1024,
			})
		);
	}

	const extension = fileExtension(name);

	// Bilder: unverändert als Vision-Input durchreichen.
	const imageMimeType = IMAGE_ATTACHMENT_MIME_TYPES[extension];
	if (imageMimeType) {
		return { kind: "image", mimeType: imageMimeType, dataBase64 };
	}

	let text: string;
	if (PDF_ATTACHMENT_EXTENSIONS.includes(extension)) {
		text = await pdfToText(buffer, name, t);
	} else if (EXCEL_EXTENSIONS.has(extension)) {
		text = await excelToText(buffer, name, t);
	} else if (OFFICE_EXTENSIONS.has(extension)) {
		text = await officeToText(buffer, name, extension, t);
	} else if (TEXT_EXTENSIONS.has(extension)) {
		text = buffer.toString("utf8");
	} else if (extension === "xls") {
		throw new AttachmentError(t("chat.attach.legacyXls", { name }));
	} else if (extension === "doc" || extension === "ppt") {
		throw new AttachmentError(t("chat.attach.legacyOffice", { name, extension }));
	} else {
		throw new AttachmentError(t("chat.attach.unsupportedType", { name, types: t("chat.attach.supportedTypesHint") }));
	}

	if (!text.trim()) {
		throw new AttachmentError(t("chat.attach.noTextExtracted", { name }));
	}
	return { kind: "text", text: truncateText(text, t) };
}
