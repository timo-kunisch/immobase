import { Workbook } from "exceljs";
import type { CellValue } from "exceljs";
import JSZip from "jszip";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

import {
	EXCEL_ATTACHMENT_EXTENSIONS,
	IMAGE_ATTACHMENT_MIME_TYPES,
	MAX_ATTACHMENT_BYTES,
	OFFICE_ATTACHMENT_EXTENSIONS,
	PDF_ATTACHMENT_EXTENSIONS,
	SUPPORTED_TYPES_HINT,
	TEXT_ATTACHMENT_EXTENSIONS,
} from "./attachment-types";

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
 *   legacy-Build). Gescannte PDFs ohne Textebene liefern einen Hinweis.
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

const TEXT_EXTENSIONS = new Set<string>(TEXT_ATTACHMENT_EXTENSIONS);
const EXCEL_EXTENSIONS = new Set<string>(EXCEL_ATTACHMENT_EXTENSIONS);
const OFFICE_EXTENSIONS = new Set<string>(OFFICE_ATTACHMENT_EXTENSIONS);

function fileExtension(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function truncateText(text: string): string {
	if (text.length <= MAX_CHARS_PER_ATTACHMENT) return text;
	return `${text.slice(0, MAX_CHARS_PER_ATTACHMENT)}\n[... gekürzt: Der Anhang überschreitet die maximale Textlänge von ${MAX_CHARS_PER_ATTACHMENT} Zeichen ...]`;
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

async function excelToText(buffer: Buffer, name: string): Promise<string> {
	const workbook = new Workbook();
	try {
		await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
	} catch (error) {
		console.warn("[ai] Excel-Datei konnte nicht gelesen werden:", error);
		throw new AttachmentError(
			`Die Datei "${name}" konnte nicht als Excel-Arbeitsmappe gelesen werden. Hinweis: Das alte .xls-Format wird nicht unterstützt - bitte in Excel als .xlsx speichern.`
		);
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
			`Tabellenblatt "${worksheet.name}" (${rows.length} Zeilen${truncated ? `, auf die ersten ${MAX_ROWS_PER_SHEET} Zeilen gekürzt` : ""}):\n${rows.join("\n")}`
		);
	});

	if (parts.length === 0) {
		throw new AttachmentError(`Die Datei "${name}" enthält keine auswertbaren Tabellendaten.`);
	}
	return parts.join("\n\n");
}

// ------------------------------------------------------------
// PDF (pdfjs-dist, legacy-Node-Build)
// ------------------------------------------------------------

async function pdfToText(buffer: Buffer, name: string): Promise<string> {
	let task: ReturnType<typeof getDocument>;
	try {
		task = getDocument({
			data: new Uint8Array(buffer),
			// Keine Font-Einbettung nötig (reine Textextraktion) - vermeidet
			// unnötige Dateisystem-/Netzwerkzugriffe der Engine.
			useSystemFonts: true,
			disableFontFace: true,
		});
	} catch (error) {
		console.warn("[ai] PDF-Initialisierung fehlgeschlagen:", error);
		throw new AttachmentError(`Die PDF-Datei "${name}" konnte nicht geöffnet werden.`);
	}

	try {
		const pdf = await task.promise;
		const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
		const parts: string[] = [];
		for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
			const page = await pdf.getPage(pageNumber);
			const content = await page.getTextContent();
			const text = content.items
				.map((item) => ("str" in item ? (item as TextItem).str : ""))
				// Leerzeichen zwischen Textstücken: pdf.js liefert die Items oft
				// wort-/fragmentweise, ein schlichter Abstand ist die robusteste
				// Näherung (zeilengetreue Rekonstruktion wäre erheblich aufwendiger).
				.join(" ")
				.replace(/\s{2,}/g, " ")
				.trim();
			if (text) parts.push(`--- Seite ${pageNumber} ---\n${text}`);
		}
		const truncated = pdf.numPages > MAX_PDF_PAGES;
		if (parts.length === 0) {
			throw new AttachmentError(
				`Die PDF-Datei "${name}" enthält keinen extrahierbaren Text (vermutlich ein Scan ohne Textebene). Hinweis: Als Workaround die PDF in Bilder umwandeln und diese anhängen.`
			);
		}
		return (
			parts.join("\n\n") + (truncated ? `\n\n[... gekürzt: Nur die ersten ${MAX_PDF_PAGES} von ${pdf.numPages} Seiten wurden übernommen ...]` : "")
		);
	} catch (error) {
		if (error instanceof AttachmentError) throw error;
		const message = error instanceof Error ? error.message : String(error);
		if (/password/i.test(message)) {
			throw new AttachmentError(`Die PDF-Datei "${name}" ist passwortgeschützt - bitte den Schutz entfernen und erneut anhängen.`);
		}
		console.warn("[ai] PDF-Extraktion fehlgeschlagen:", error);
		throw new AttachmentError(`Die PDF-Datei "${name}" konnte nicht gelesen werden (beschädigt oder kein gültiges PDF).`);
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

async function officeToText(buffer: Buffer, name: string, extension: string): Promise<string> {
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(buffer);
	} catch (error) {
		console.warn("[ai] Office-Datei konnte nicht als ZIP geöffnet werden:", error);
		throw new AttachmentError(`Die Datei "${name}" ist beschädigt oder keine gültige ${extension.toUpperCase()}-Datei.`);
	}

	try {
		switch (extension) {
			case "docx": {
				const xml = await readZipTextFile(zip, "word/document.xml");
				if (xml === null) throw new AttachmentError(`Die Datei "${name}" enthält kein word/document.xml - keine gültige DOCX-Datei.`);
				return officeXmlToText(xml);
			}
			case "pptx": {
				const slideNames = Object.keys(zip.files)
					.filter((filePath) => /^ppt\/slides\/slide\d+\.xml$/.test(filePath))
					.sort((a, b) => Number(/slide(\d+)\.xml$/.exec(a)![1]) - Number(/slide(\d+)\.xml$/.exec(b)![1]));
				const parts: string[] = [];
				for (const [index, filePath] of slideNames.entries()) {
					const text = officeXmlToText((await readZipTextFile(zip, filePath)) ?? "");
					if (text) parts.push(`--- Folie ${index + 1} ---\n${text}`);
				}
				if (parts.length === 0) throw new AttachmentError(`Die Datei "${name}" enthält keinen extrahierbaren Folientext.`);
				return parts.join("\n\n");
			}
			default: {
				// OpenDocument (odt/ods/odp): gesamter Inhalt in content.xml
				const xml = await readZipTextFile(zip, "content.xml");
				if (xml === null) {
					throw new AttachmentError(`Die Datei "${name}" enthält kein content.xml - keine gültige OpenDocument-Datei.`);
				}
				return officeXmlToText(xml);
			}
		}
	} catch (error) {
		if (error instanceof AttachmentError) throw error;
		console.warn("[ai] Office-Extraktion fehlgeschlagen:", error);
		throw new AttachmentError(`Die Datei "${name}" konnte nicht gelesen werden (beschädigtes Office-Dokument).`);
	}
}

// ------------------------------------------------------------
// Einstiegspunkt
// ------------------------------------------------------------

/**
 * Verarbeitet einen Anhang: liefert extrahierten Text oder ein Bild
 * (Vision-Input). Wirft AttachmentError bei nicht unterstützten Dateitypen,
 * unlesbaren Dateien oder Überschreitung der Größenobergrenze.
 */
export async function processAttachment(name: string, dataBase64: string): Promise<ProcessedAttachment> {
	let buffer: Buffer;
	try {
		buffer = Buffer.from(dataBase64, "base64");
	} catch {
		throw new AttachmentError(`Der Anhang "${name}" ist beschädigt (ungültige Base64-Kodierung).`);
	}
	if (buffer.length === 0) {
		throw new AttachmentError(`Der Anhang "${name}" ist leer.`);
	}
	if (buffer.length > MAX_ATTACHMENT_BYTES) {
		throw new AttachmentError(
			`Der Anhang "${name}" ist zu groß (${(buffer.length / 1024 / 1024).toFixed(1)} MB - erlaubt sind höchstens ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB).`
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
		text = await pdfToText(buffer, name);
	} else if (EXCEL_EXTENSIONS.has(extension)) {
		text = await excelToText(buffer, name);
	} else if (OFFICE_EXTENSIONS.has(extension)) {
		text = await officeToText(buffer, name, extension);
	} else if (TEXT_EXTENSIONS.has(extension)) {
		text = buffer.toString("utf8");
	} else if (extension === "xls") {
		throw new AttachmentError(
			`Das alte .xls-Format ("${name}") wird nicht unterstützt - bitte in Excel als .xlsx speichern und erneut anhängen.`
		);
	} else if (extension === "doc" || extension === "ppt") {
		throw new AttachmentError(
			`Das alte .${extension}-Format ("${name}") wird nicht unterstützt - bitte als .${extension}x speichern und erneut anhängen.`
		);
	} else {
		throw new AttachmentError(`Der Dateityp von "${name}" wird nicht unterstützt. Erlaubt sind: ${SUPPORTED_TYPES_HINT}.`);
	}

	if (!text.trim()) {
		throw new AttachmentError(`Aus der Datei "${name}" konnte kein Text extrahiert werden (leer oder nur nicht-textuelle Inhalte).`);
	}
	return { kind: "text", text: truncateText(text) };
}
