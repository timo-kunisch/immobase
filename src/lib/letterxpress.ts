import "server-only";
import { createHash } from "node:crypto";

import { getSettingWithEnvFallback } from "@/data/app-settings";

/**
 * Postversand von PDFs über die LetterXpress API v3
 * (https://api.letterxpress.de/v3) - Druck, Kuvertierung, Frankierung und
 * Zustellung eines Briefs aus einem base64-kodierten PDF.
 *
 * Diese Datei ist die einzige Stelle im Projekt, die direkt mit der
 * LetterXpress-REST-API spricht - und der einzige verbliebene `fetch()`-
 * Aufruf gegen einen externen Drittanbieter. Der Postversand ist eine
 * OPTIONALE Online-Funktion (nicht Teil des Offline-Kernpfads der
 * Desktop-App): Ohne hinterlegte Zugangsdaten meldet sendPdfByPost() einen
 * verständlichen Fehler, und die UI blendet die Versand-Schaltflächen ab
 * (siehe isLetterXpressConfigured()).
 *
 * Zugangsdaten werden bewusst NICHT hardcodiert und NICHT im Repo abgelegt,
 * sondern in den App-Einstellungen (Tabelle app_settings, siehe
 * src/data/app-settings.ts; Fallback: Umgebungsvariablen für
 * Dev-/Test-Szenarien).
 */

const API_BASE_URL = "https://api.letterxpress.de/v3";

// Laut Vorgabe: max. 50 MB Dateigröße, 120 Requests/Minute Rate-Limit.
// Die Größenprüfung erfolgt hier defensiv VOR dem Request (schnellerer,
// verständlicherer Fehler statt eines rohen HTTP-413/500 der Gegenseite);
// das Rate-Limit wird von LetterXpress selbst durchgesetzt (siehe
// LetterXpressError.status bei einer entsprechenden Fehlerantwort).
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export type LetterXpressColor = "1" | "4";
export type LetterXpressPrintMode = "simplex" | "duplex";
export type LetterXpressShipping = "national" | "international";
export type LetterXpressAuthMode = "test" | "live";

export type LetterXpressSpecification = {
	color: LetterXpressColor;
	mode: LetterXpressPrintMode;
	shipping: LetterXpressShipping;
};

export type SendPdfByPostOptions = {
	pdfBuffer: Uint8Array;
	fileName: string;
	specification?: Partial<LetterXpressSpecification>;
};

export type SendPdfByPostResult = {
	jobId: string;
	status: string | null;
	mode: LetterXpressAuthMode;
};

/** Fehler beim Aufruf der LetterXpress-API (HTTP-Fehler oder ungültige Antwort). */
export class LetterXpressError extends Error {
	/** HTTP-Statuscode der Antwort, falls vorhanden (z. B. 401, 413, 429). */
	readonly status: number | null;

	constructor(message: string, status: number | null = null) {
		super(message);
		this.name = "LetterXpressError";
		this.status = status;
	}
}

const DEFAULT_SPECIFICATION: LetterXpressSpecification = {
	color: "1",
	mode: "simplex",
	shipping: "national",
};

/**
 * Liest den Versandmodus aus den App-Einstellungen (Fallback:
 * Umgebungsvariable LETTERXPRESS_MODE). Bewusst "test" als sicherer
 * Standardwert, falls kein Wert hinterlegt ist oder der Wert unerwartet
 * ist - ein versehentlicher Live-Versand ohne explizite Konfiguration muss
 * ausgeschlossen sein.
 */
export function getLetterXpressMode(): LetterXpressAuthMode {
	return getSettingWithEnvFallback("letterxpress.mode", "LETTERXPRESS_MODE", "test") === "live" ? "live" : "test";
}

function getCredentials(): { username: string; apikey: string } | null {
	const username = getSettingWithEnvFallback("letterxpress.username", "LETTERXPRESS_USERNAME");
	const apikey = getSettingWithEnvFallback("letterxpress.apikey", "LETTERXPRESS_API_KEY");
	if (!username || !apikey) return null;
	return { username, apikey };
}

/**
 * Prüft, ob LetterXpress-Zugangsdaten hinterlegt sind. Dient der UI zum
 * Ein-/Ausblenden der Postversand-Schaltflächen (der Postversand ist eine
 * optionale Online-Funktion, siehe Dateikopf-Kommentar).
 */
export function isLetterXpressConfigured(): boolean {
	return getCredentials() !== null;
}

/**
 * Base64-kodiert den PDF-Inhalt und berechnet den laut API-Vorgabe
 * geforderten MD5-Hash ÜBER DEM BASE64-STRING (nicht über den Rohbytes).
 */
function encodeFileForApi(pdfBuffer: Uint8Array): { base64File: string; checksum: string } {
	const base64File = Buffer.from(pdfBuffer).toString("base64");
	const checksum = createHash("md5").update(base64File).digest("hex");
	return { base64File, checksum };
}

/**
 * Versendet ein PDF als Brief über die LetterXpress API (POST /v3/printjobs).
 *
 * Nutzt bewusst kein SDK/HTTP-Client-Paket (siehe src/lib/email/mailer.ts
 * für das analoge Minimalismus-Prinzip dieses Projekts) - reines,
 * natives `fetch()`.
 *
 * Wirft `LetterXpressError` bei fehlender Konfiguration, HTTP-Fehlern
 * (Non-2xx) oder einer Antwort ohne verwertbare Auftrags-ID - der Aufrufer
 * (Server Action) fängt diesen Fehler und wandelt ihn in eine
 * nutzerverständliche deutsche Fehlermeldung um.
 */
export async function sendPdfByPost(options: SendPdfByPostOptions): Promise<SendPdfByPostResult> {
	const { pdfBuffer, fileName, specification } = options;

	if (pdfBuffer.byteLength === 0) {
		throw new LetterXpressError("Die PDF-Datei ist leer.");
	}
	if (pdfBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
		throw new LetterXpressError(`Die PDF-Datei ist zu groß (max. ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB).`);
	}

	const credentials = getCredentials();
	if (!credentials) {
		throw new LetterXpressError("LetterXpress ist nicht konfiguriert (LETTERXPRESS_USERNAME/LETTERXPRESS_API_KEY fehlen).");
	}

	const mode = getLetterXpressMode();
	const { base64File, checksum } = encodeFileForApi(pdfBuffer);

	const requestBody = {
		auth: { username: credentials.username, apikey: credentials.apikey, mode },
		letter: {
			base64_file: base64File,
			base64_file_checksum: checksum,
			specification: { ...DEFAULT_SPECIFICATION, ...specification },
			filename_original: fileName,
		},
	};

	let response: Response;
	try {
		response = await fetch(`${API_BASE_URL}/printjobs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(requestBody),
		});
	} catch (error) {
		// Netzwerkfehler (z. B. DNS, Timeout) - kein HTTP-Statuscode vorhanden.
		throw new LetterXpressError(`LetterXpress-API nicht erreichbar: ${error instanceof Error ? error.message : String(error)}`);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new LetterXpressError("Die Antwort der LetterXpress-API konnte nicht als JSON gelesen werden.", response.status);
	}

	if (!response.ok) {
		// Bei einem Auth-Fehler (401) hat die Antwort laut API-Dokumentation
		// die flache Form { "message": "Unauthorized." } (kein "data"-Objekt).
		const apiMessage = isRecord(payload) && typeof payload.message === "string" ? payload.message : null;
		throw new LetterXpressError(apiMessage ? `LetterXpress-Fehler: ${apiMessage}` : `LetterXpress-Fehler (HTTP ${response.status}).`, response.status);
	}

	// Bei Erfolg liefert die API laut Dokumentation
	// { "status": 200, "message": "OK", "data": { "id": ..., "status": ..., ... } } -
	// die eigentliche Auftrags-ID/den Auftragsstatus liegen also verschachtelt
	// unter "data", NICHT auf oberster Ebene (dort steht unter "status" nur
	// der HTTP-Statuscode als Zahl, siehe API-PDF Seite 14).
	const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
	if (!data || (typeof data.id !== "string" && typeof data.id !== "number")) {
		throw new LetterXpressError("Die Antwort der LetterXpress-API enthielt keine gültige Auftrags-ID.", response.status);
	}

	return {
		jobId: String(data.id),
		status: typeof data.status === "string" ? data.status : data.status != null ? String(data.status) : null,
		mode,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
