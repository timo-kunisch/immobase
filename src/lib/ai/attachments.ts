import { Workbook } from "exceljs";
import type { CellValue } from "exceljs";

/**
 * Textextraktion aus Datei-Anhängen des KI-Chats (src/lib/ai/chat.ts):
 * Damit das Modell mit angehängten Dateien arbeiten kann (z. B. eine
 * Excel-Tabelle mit Mietern, aus der Datensätze angelegt werden sollen),
 * wird der Inhalt serverseitig in Text umgewandelt und der Nachricht
 * beigelegt - die wenigsten OpenAI-kompatiblen Endpunkte akzeptieren
 * Datei-Uploads direkt.
 *
 * Unterstützt:
 * - Excel-Arbeitsmappen (.xlsx/.xlsm/.xltx/.xltm) via exceljs: Jedes
 *   Tabellenblatt wird als CSV-Text (Semikolon-getrennt, deutsche
 *   Excel-Konvention) abgelegt. Legacy-.xls wird von exceljs nicht
 *   gelesen - die Fehlermeldung weist auf "Als .xlsx speichern" hin.
 * - Textdateien (.csv/.tsv/.txt/.md/.json/.xml/.log): direkte Übernahme.
 *
 * Schutz vor übergroßen Kontexten: harte Obergrenzen für Dateigröße,
 * Zeilen je Tabellenblatt und extrahierte Zeichen je Datei (mit
 * Kürzungshinweis im Text).
 */

/** Fachlicher Fehler bei der Anhang-Verarbeitung (wird dem Nutzer gemeldet). */
export class AttachmentError extends Error {}

/** Maximale Rohgröße je Anhang (nach Base64-Dekodierung). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Maximale Tabellenzeilen je Tabellenblatt (Überschuss wird abgeschnitten). */
const MAX_ROWS_PER_SHEET = 500;
/** Maximale Textlänge je Anhang (Überschuss wird abgeschnitten). */
const MAX_CHARS_PER_ATTACHMENT = 60_000;

const TEXT_EXTENSIONS = new Set(["csv", "tsv", "txt", "md", "json", "xml", "log"]);
const EXCEL_EXTENSIONS = new Set(["xlsx", "xlsm", "xltx", "xltm"]);

function fileExtension(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

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

/**
 * Extrahiert den Textinhalt eines Anhangs. Wirft AttachmentError bei
 * nicht unterstützten Dateitypen, unlesbaren Dateien oder Überschreitung
 * der Größenobergrenze.
 */
export async function extractAttachmentText(name: string, dataBase64: string): Promise<string> {
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
	let text: string;
	if (EXCEL_EXTENSIONS.has(extension)) {
		text = await excelToText(buffer, name);
	} else if (extension === "xls") {
		throw new AttachmentError(
			`Das alte .xls-Format ("${name}") wird nicht unterstützt - bitte in Excel als .xlsx speichern und erneut anhängen.`
		);
	} else if (TEXT_EXTENSIONS.has(extension)) {
		text = buffer.toString("utf8");
	} else {
		throw new AttachmentError(
			`Der Dateityp von "${name}" wird nicht unterstützt. Erlaubt: Excel (.xlsx), CSV und Textdateien (.csv, .tsv, .txt, .md, .json, .xml, .log).`
		);
	}

	if (text.length > MAX_CHARS_PER_ATTACHMENT) {
		text = `${text.slice(0, MAX_CHARS_PER_ATTACHMENT)}\n[... gekürzt: Der Anhang überschreitet die maximale Textlänge von ${MAX_CHARS_PER_ATTACHMENT} Zeichen ...]`;
	}
	return text;
}
