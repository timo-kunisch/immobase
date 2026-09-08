import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { getFilesDir } from "@/data/paths";
import { createPlaintextReadStream, writeEncryptedFile } from "./file-crypto";

/**
 * Dateiablage auf dem lokalen Dateisystem. Wurzelverzeichnis ist
 * `<APP_DATA_DIR>/files/` (in der
 * Desktop-App `app.getPath("userData")/files`, in der Web-Entwicklung
 * `<Projekt>/data-dev/files`, siehe src/data/paths.ts).
 *
 * Die Dateien sind NICHT öffentlich lesbar; alle Downloads laufen über den
 * geschützten Route Handler src/app/api/uploads/[...path]/route.ts, der die
 * Datei von der Platte liest und an angemeldete Nutzer durchreicht (keine
 * öffentliche Auslieferung).
 *
 * Verschlüsselung at rest: Alle NEU abgelegten Dateien werden AES-256-GCM-
 * verschlüsselt gespeichert (Container-Format siehe src/lib/file-crypto.ts,
 * Schlüssel siehe src/lib/data-key.ts). Der Lesepfad (getUploadedFile)
 * entschlüsselt transparent am Container-Magic und kann dadurch auch ältere
 * Klartext-Bestände lesen; die Bestandsmigration
 * (encryptPlaintextFilesInTree) holt diese nach.
 *
 * Diese Datei ist die einzige Stelle im Projekt, die direkt mit dem
 * Dateisystem für Uploads spricht - alle Module (Dokumente, Vorlagen,
 * Abrechnung, WEG) nutzen ausschließlich die hier exportierten Funktionen.
 *
 * Metadaten (Original-Dateiname, MIME-Type)
 * liegen als Sidecar-Datei `<dateiname>.meta.json` neben der eigentlichen
 * Datei, sodass `files/` auch bei einem reinen Dateisystem-Backup
 * selbsterklärend bleibt. Die Sidecars sind bewusst NICHT verschlüsselt
 * (enthalten nur Dateiname + MIME-Type, keinen Inhalt).
 */

const MIME_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	txt: "text/plain",
	csv: "text/csv",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getExtension(fileName: string): string {
	const dotIndex = fileName.lastIndexOf(".");
	return dotIndex >= 0 ? fileName.slice(dotIndex) : "";
}

/** Ermittelt den MIME-Type anhand der Dateiendung (Fallback: application/octet-stream). */
export function getMimeType(fileName: string): string {
	const ext = getExtension(fileName).slice(1).toLowerCase();
	return MIME_TYPES[ext] ?? "application/octet-stream";
}

// Erlaubte Ablage-"Ordner" (Key-Präfixe). Dient als einfache, defensive
// Schranke gegen beliebige Pfade (z. B. aus fehlerhaften/manipulierten
// Segmenten in der Ausliefer-Route).
const ALLOWED_PREFIXES = [
	"documents/",
	"generated-documents/",
	"protocols/",
	"billing-statements/",
	// WEG-Verwaltung: Einzelabrechnungen der Jahresabrechnung sowie
	// Einladungen/Protokolle von Eigentümerversammlungen.
	"hoa-annual-statements/",
	"hoa-meeting-invitations/",
	"hoa-meeting-minutes/",
];

/**
 * Prüft, ob ein relativer Pfad dem erwarteten Schema entspricht (kein "..",
 * kein führender Slash, einer der bekannten Unterordner). Gibt bei Verstoß
 * `false` zurück.
 */
export function isValidObjectKey(key: string): boolean {
	if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return false;
	return ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Löst einen relativen Ablagepfad in einen absoluten Dateisystempfad auf
 * (inkl. Schutz gegen Pfad-Traversal oberhalb des files/-Wurzelverzeichnisses).
 * Gibt `null` bei ungültigen Pfaden zurück.
 */
function resolveAbsolutePath(relativePath: string): string | null {
	if (!isValidObjectKey(relativePath)) return null;
	const root = getFilesDir();
	const absolute = path.resolve(root, relativePath);
	if (!absolute.startsWith(path.resolve(root) + path.sep)) return null;
	return absolute;
}

function buildObjectKey(subdir: string, uniqueName: string): string {
	const cleanSubdir = subdir.replace(/^\/+|\/+$/g, "");
	return `${cleanSubdir}/${uniqueName}`;
}

// ------------------------------------------------------------
// Sidecar-Metadaten (Original-Dateiname + MIME-Type)
// ------------------------------------------------------------

interface FileMeta {
	originalFileName: string;
	mimeType: string;
}

function metaPathFor(absoluteFilePath: string): string {
	return `${absoluteFilePath}.meta.json`;
}

function writeMeta(absoluteFilePath: string, meta: FileMeta): void {
	fs.writeFileSync(metaPathFor(absoluteFilePath), JSON.stringify(meta, null, 2), "utf8");
}

function readMeta(absoluteFilePath: string): FileMeta | null {
	try {
		const raw = fs.readFileSync(metaPathFor(absoluteFilePath), "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			typeof (parsed as FileMeta).originalFileName === "string" &&
			typeof (parsed as FileMeta).mimeType === "string"
		) {
			return parsed as FileMeta;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Speichert eine hochgeladene Datei (aus einer Server-Action-FormData) im
 * angegebenen Unterordner und gibt den relativen Pfad (für die Ablage in
 * der Datenbank) zurück.
 */
export async function saveUploadedFile(
	file: File,
	subdir: string
): Promise<{
	relativePath: string;
	fileName: string;
	mimeType: string;
	fileSize: number;
}> {
	const originalExt = getExtension(file.name);
	const uniqueName = `${crypto.randomUUID()}${originalExt.toLowerCase()}`;
	const key = buildObjectKey(subdir, uniqueName);

	const buffer = await file.arrayBuffer();
	const mimeType = file.type || getMimeType(file.name || uniqueName);
	const originalFileName = file.name || uniqueName;

	// Der Originaldateiname wird in der Sidecar-Metadaten-Datei hinterlegt,
	// da der Ablagename selbst aus einer zufälligen UUID besteht (verhindert
	// Kollisionen/Pfad-Traversal-Risiken bei Nutzer-Dateinamen). Beim
	// Download (siehe src/app/api/uploads/[...path]/route.ts) wird dieser
	// Wert wieder ausgelesen, damit der Download nicht mit der UUID, sondern
	// dem ursprünglichen Dateinamen erfolgt.
	const absolute = resolveAbsolutePath(key);
	if (!absolute) throw new Error(`Ungültiger Ablagepfad: ${key}`);
	// Verschlüsselte Ablage at rest (siehe Dateikopf); fileSize bewusst die
	// KLARTEXT-Größe (für Anzeige/DB), nicht die Container-Größe.
	writeEncryptedFile(absolute, Buffer.from(buffer));
	writeMeta(absolute, { originalFileName, mimeType });

	return {
		relativePath: key,
		fileName: originalFileName,
		mimeType,
		fileSize: buffer.byteLength,
	};
}

/**
 * Speichert einen bereits im Speicher erzeugten Datei-Inhalt (z. B. ein
 * generiertes PDF, siehe src/lib/pdf/) im angegebenen Unterordner - analog
 * zu saveUploadedFile, aber ohne vorhandenes File-Objekt aus einer
 * Server-Action-FormData.
 */
export async function saveGeneratedFile(
	buffer: Uint8Array,
	subdir: string,
	fileName: string
): Promise<{ relativePath: string; fileSize: number }> {
	const ext = getExtension(fileName);
	const uniqueName = `${crypto.randomUUID()}${ext.toLowerCase()}`;
	const key = buildObjectKey(subdir, uniqueName);

	// Siehe Kommentar in saveUploadedFile: Originalname in den Sidecar-
	// Metadaten hinterlegen, damit der Download-Route-Handler ihn statt der
	// UUID verwenden kann.
	const absolute = resolveAbsolutePath(key);
	if (!absolute) throw new Error(`Ungültiger Ablagepfad: ${key}`);
	// Verschlüsselte Ablage at rest (siehe Dateikopf).
	writeEncryptedFile(absolute, buffer);
	writeMeta(absolute, { originalFileName: fileName, mimeType: getMimeType(fileName) });

	return { relativePath: key, fileSize: buffer.byteLength };
}

/** Löscht eine zuvor gespeicherte Upload-Datei inkl. Sidecar (ignoriert "nicht gefunden"). */
export async function deleteUploadedFile(relativePath: string): Promise<void> {
	const absolute = resolveAbsolutePath(relativePath);
	if (!absolute) return;
	try {
		fs.unlinkSync(absolute);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.error("deleteUploadedFile failed", error);
		}
	}
	try {
		fs.unlinkSync(metaPathFor(absolute));
	} catch {
		// Sidecar-Metadaten dürfen fehlen (ältere Dateien) - ignorieren.
	}
}

/** Prüft, ob eine Datei unter dem angegebenen relativen Pfad existiert. */
export async function uploadedFileExists(relativePath: string): Promise<boolean> {
	const absolute = resolveAbsolutePath(relativePath);
	if (!absolute) return false;
	return fs.existsSync(absolute);
}

/**
 * Lädt eine Datei aus der Ablage (für den Ausliefer-Route-Handler und den
 * Postversand). Gibt `null` zurück, wenn die Datei nicht existiert bzw. der
 * Pfad ungültig ist.
 */
export async function getUploadedFile(relativePath: string): Promise<{
	body: ReadableStream;
	mimeType: string;
	fileName: string;
} | null> {
	const absolute = resolveAbsolutePath(relativePath);
	if (!absolute || !fs.existsSync(absolute)) return null;

	try {
		const meta = readMeta(absolute);
		// Fallback auf den Ablagenamen (UUID-Dateiname), falls die Sidecar-
		// Metadaten fehlen (z. B. Datei wurde außerhalb der App abgelegt).
		const fileName = meta?.originalFileName || (relativePath.split("/").pop() ?? "download");
		const mimeType = meta?.mimeType || getMimeType(fileName);
		// Gestreamtes Lesen statt Komplett-Pufferung (große PDFs/Archive).
		// Verschlüsselte Dateien (Erkennung am Container-Magic) werden dabei
		// transparent entschlüsselt; Klartext-Bestandsdateien laufen einfach
		// durch. Ein Integritäts-/Schlüsselfehler bricht den Stream hart ab.
		const body = Readable.toWeb(createPlaintextReadStream(absolute)) as ReadableStream;
		return { body, mimeType, fileName };
	} catch (error) {
		console.error("getUploadedFile failed", error);
		return null;
	}
}
