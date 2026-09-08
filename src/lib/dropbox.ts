import "server-only";
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";

/**
 * Dropbox-API-Client für die Cloud-Sicherung (Backup-Upload nach Dropbox) -
 * wie src/lib/letterxpress.ts bewusst OHNE SDK, nur natives fetch() gegen
 * die offizielle REST-API (https://www.dropbox.com/developers/documentation).
 *
 * OAuth 2.0 mit PKCE und "offline"-Zugang (Refresh-Token), damit Backups
 * unbeaufsichtigt hochgeladen werden können. Da die Desktop-App ihren
 * lokalen Server auf einem DYNAMISCHEN Port betreibt, kommt der Code-Flow
 * OHNE redirect_uri zum Einsatz: Dropbox zeigt den Autorisierungscode nach
 * der Freigabe im Browser zum Kopieren an, der Nutzer fügt ihn in der App
 * ein (Einstellungen → Dropbox-Backup). Ein vorregistrierter Redirect auf
 * localhost wäre wegen des dynamischen Ports nicht möglich.
 *
 * Die Verwaltung der gespeicherten Zugangsdaten (app_settings) liegt in
 * src/lib/dropbox-backup.ts - diese Datei kennt nur die reine API.
 *
 * Der Upload großer Backups läuft über Upload-Sessions mit 8-MiB-Chunks
 * (Multi-GB-tauglich, Vollpuffer-frei). Beim bekannten Fehler
 * "upload_session_lookup_error/incorrect_offset" wird mit dem von Dropbox
 * gemeldeten correct_offset fortgesetzt (Wiederaufsetzen statt Neustart).
 * Netzwerkfehler und 429/5xx-Antworten werden mit einfachem Backoff
 * wiederholt (Retry-After-Header wird beachtet).
 */

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API_BASE_URL = "https://api.dropboxapi.com/2";
const CONTENT_BASE_URL = "https://content.dropboxapi.com/2";

/** Zielordner für die Sicherungen (bei "App folder"-Apps relativ zum App-Ordner). */
export const DROPBOX_BACKUP_FOLDER = "/ImmoBase-Backups";

/** Dateiname-Präfix, an dem die Aufbewahrungslogik eigene Backups erkennt. */
export const DROPBOX_BACKUP_FILE_PREFIX = "immobase-backup-";

/** Dropbox-Limit pro Upload-Request: 150 MiB - wir bleiben weit darunter. */
const DEFAULT_UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024;

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Fehler beim Aufruf der Dropbox-API (HTTP-Fehler, OAuth-Fehler oder ungültige Antwort). */
export class DropboxError extends Error {
	/** HTTP-Statuscode der Antwort, falls vorhanden. */
	readonly status: number | null;
	/** OAuth-Fehlercode (z. B. "invalid_grant"), falls vorhanden. */
	readonly oauthError: string | null;

	constructor(message: string, status: number | null = null, oauthError: string | null = null) {
		super(message);
		this.name = "DropboxError";
		this.status = status;
		this.oauthError = oauthError;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() mit einfachem Backoff für Netzwerkfehler und 429/5xx-Antworten
 * (Dropbox empfiehlt bei 429 den Retry-After-Header). Nicht idempotente
 * Endpunkte werden hier bewusst trotzdem wiederholt: upload_session/append
 * mit Cursor-Offset ist faktisch idempotent, Token-/RPC-Endpunkte ohnehin.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
	let lastNetworkError: unknown = null;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const response = await fetch(url, init);
			if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
				return response;
			}
			const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "");
			const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1000, 30_000) : 1000 * attempt;
			await sleep(waitMs);
		} catch (error) {
			lastNetworkError = error;
			if (attempt === MAX_ATTEMPTS) break;
			await sleep(1000 * attempt);
		}
	}
	throw new DropboxError(
		`Dropbox ist nicht erreichbar: ${lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError)}`
	);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

/** Liest die Dropbox-Fehlerzusammenfassung aus einer Fehlerantwort (z. B. "path/not_found/."). */
function extractErrorSummary(payload: unknown): string | null {
	if (isRecord(payload) && typeof payload.error_summary === "string") {
		return payload.error_summary.replace(/[/.]+$/, "");
	}
	return null;
}

// ------------------------------------------------------------
// OAuth 2.0 (PKCE, Code-Flow ohne Redirect)
// ------------------------------------------------------------

/** Erzeugt ein PKCE-Paar (Verifier + S256-Challenge). */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
	const codeVerifier = randomBytes(48).toString("base64url");
	const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
	return { codeVerifier, codeChallenge };
}

/** Zufälliger state-Parameter für die Authorize-URL. */
export function generateOAuthState(): string {
	return randomBytes(16).toString("base64url");
}

/**
 * Baut die Dropbox-Authorize-URL. Bewusst OHNE redirect_uri: Dropbox zeigt
 * den Code dann nach der Freigabe zum Kopieren an (Desktop-App mit
 * dynamischem lokalem Port, siehe Dateikopf). "token_access_type=offline"
 * liefert zusätzlich zum kurzlebigen Access-Token ein Refresh-Token.
 */
export function buildAuthorizeUrl(appKey: string, state: string, codeChallenge: string): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: appKey,
		token_access_type: "offline",
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		state,
	});
	return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface DropboxTokens {
	accessToken: string;
	/** Gültigkeitsdauer des Access-Tokens in Sekunden (Dropbox: typ. 14400). */
	expiresInSeconds: number;
	/** Nur beim Code-Tausch bzw. bei Rotation vorhanden. */
	refreshToken?: string;
}

async function postTokenRequest(params: Record<string, string>): Promise<DropboxTokens> {
	const response = await fetchWithRetry(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});
	const payload = await parseJsonResponse(response);
	if (!response.ok) {
		const oauthError = isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
		const description = isRecord(payload) && typeof payload.error_description === "string" ? payload.error_description : null;
		throw new DropboxError(
			`Dropbox-Anmeldung fehlgeschlagen: ${description ?? oauthError ?? `HTTP ${response.status}`}`,
			response.status,
			oauthError
		);
	}
	if (!isRecord(payload) || typeof payload.access_token !== "string") {
		throw new DropboxError("Die Antwort der Dropbox-Anmeldung enthielt kein Zugriffstoken.", response.status);
	}
	return {
		accessToken: payload.access_token,
		expiresInSeconds: typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 4 * 60 * 60,
		refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
	};
}

/** Tauscht den kopierten Autorisierungscode gegen Access- + Refresh-Token. */
export function exchangeCodeForTokens(appKey: string, code: string, codeVerifier: string): Promise<DropboxTokens> {
	return postTokenRequest({
		grant_type: "authorization_code",
		code,
		client_id: appKey,
		code_verifier: codeVerifier,
	});
}

/** Holt mit dem Refresh-Token ein neues Access-Token. */
export function refreshAccessToken(appKey: string, refreshToken: string): Promise<DropboxTokens> {
	return postTokenRequest({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: appKey,
	});
}

// ------------------------------------------------------------
// Account-Info
// ------------------------------------------------------------

/** Liest das verbundene Dropbox-Konto aus (für die Statusanzeige nach dem Verbinden). */
export async function getCurrentAccount(accessToken: string): Promise<{ email: string; displayName: string }> {
	const response = await fetchWithRetry(`${API_BASE_URL}/users/get_current_account`, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: "null",
	});
	const payload = await parseJsonResponse(response);
	if (!response.ok) {
		throw new DropboxError(
			`Dropbox-Kontoinformationen konnten nicht gelesen werden: ${extractErrorSummary(payload) ?? `HTTP ${response.status}`}`,
			response.status
		);
	}
	if (!isRecord(payload) || typeof payload.email !== "string") {
		throw new DropboxError("Die Antwort von Dropbox enthielt keine E-Mail-Adresse des Kontos.", response.status);
	}
	const name = isRecord(payload.name) && typeof payload.name.display_name === "string" ? payload.name.display_name : payload.email;
	return { email: payload.email, displayName: name };
}

// ------------------------------------------------------------
// Upload (Upload-Session mit Chunks + Wiederaufsetzen)
// ------------------------------------------------------------

interface UploadApiArg {
	[key: string]: unknown;
}

async function contentUpload<T>(accessToken: string, path: string, apiArg: UploadApiArg, body: Uint8Array<ArrayBuffer> | null): Promise<T> {
	const response = await fetchWithRetry(`${CONTENT_BASE_URL}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Dropbox-API-Arg": JSON.stringify(apiArg),
			"Content-Type": "application/octet-stream",
		},
		body,
	});
	const payload = await parseJsonResponse(response);
	if (!response.ok) {
		throw new DropboxError(`Dropbox-Upload fehlgeschlagen: ${extractErrorSummary(payload) ?? `HTTP ${response.status}`}`, response.status);
	}
	return payload as T;
}

/** Liest das correct_offset aus einem upload_session_lookup_error/incorrect_offset (409). */
function extractCorrectOffset(payload: unknown): number | null {
	if (!isRecord(payload) || !isRecord(payload.error)) return null;
	const lookup = payload.error.upload_session_lookup_error;
	if (!isRecord(lookup) || lookup[".tag"] !== "incorrect_offset") return null;
	return typeof lookup.correct_offset === "number" ? lookup.correct_offset : null;
}

/**
 * Hängt einen Chunk an die Upload-Session. Liefert null bei Erfolg oder das
 * von Dropbox gemeldete correct_offset, mit dem fortgesetzt werden soll.
 */
async function appendSessionChunk(accessToken: string, sessionId: string, offset: number, chunk: Uint8Array<ArrayBuffer>): Promise<number | null> {
	const response = await fetchWithRetry(`${CONTENT_BASE_URL}/files/upload_session/append_v2`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Dropbox-API-Arg": JSON.stringify({ cursor: { session_id: sessionId, offset }, close: false }),
			"Content-Type": "application/octet-stream",
		},
		body: chunk,
	});
	if (response.ok) return null;
	const payload = await parseJsonResponse(response);
	if (response.status === 409) {
		const correctOffset = extractCorrectOffset(payload);
		if (correctOffset !== null) return correctOffset;
	}
	throw new DropboxError(`Dropbox-Upload fehlgeschlagen: ${extractErrorSummary(payload) ?? `HTTP ${response.status}`}`, response.status);
}

/**
 * Lädt eine lokale Datei chunked nach Dropbox hoch (Upload-Session,
 * 8-MiB-Chunks; bei incorrect_offset wird mit dem gemeldeten Offset
 * fortgesetzt statt neu zu starten). `chunkSize` ist nur für Tests
 * parametrisierbar.
 */
export async function uploadFileToDropbox(
	accessToken: string,
	dropboxPath: string,
	filePath: string,
	chunkSize: number = DEFAULT_UPLOAD_CHUNK_SIZE
): Promise<void> {
	const size = fs.statSync(filePath).size;
	const fd = fs.openSync(filePath, "r");
	try {
		const start = await contentUpload<{ session_id?: string }>(accessToken, "/files/upload_session/start", { close: false }, null);
		if (!start.session_id) {
			throw new DropboxError("Dropbox hat keine Upload-Session geliefert.");
		}
		const sessionId = start.session_id;

		let offset = 0;
		const buffer = Buffer.alloc(chunkSize);
		while (offset < size) {
			const toRead = Math.min(chunkSize, size - offset);
			fs.readSync(fd, buffer, 0, toRead, offset);
			// Kopie des gelesenen Abschnitts: Der Puffer wird wiederverwendet und
			// darf nicht als ganzes an fetch() gehen (falsche Länge am Rest-Chunk).
			const chunk = Uint8Array.from(buffer.subarray(0, toRead));
			const resumeOffset = await appendSessionChunk(accessToken, sessionId, offset, chunk);
			offset = resumeOffset === null ? offset + toRead : resumeOffset;
		}

		await contentUpload(accessToken, "/files/upload_session/finish", {
			cursor: { session_id: sessionId, offset },
			commit: { path: dropboxPath, mode: { ".tag": "overwrite" }, autorename: false, mute: true },
		}, null);
	} finally {
		fs.closeSync(fd);
	}
}

// ------------------------------------------------------------
// Auflisten / Löschen (Aufbewahrung)
// ------------------------------------------------------------

export interface DropboxFileEntry {
	path: string;
	name: string;
	/** ISO-Zeitstempel der serverseitigen Änderung. */
	serverModified: string;
	size: number;
}

function mapFileEntry(raw: unknown): DropboxFileEntry | null {
	if (!isRecord(raw) || raw[".tag"] !== "file") return null;
	if (typeof raw.name !== "string" || typeof raw.path_display !== "string") return null;
	return {
		path: raw.path_display,
		name: raw.name,
		serverModified: typeof raw.server_modified === "string" ? raw.server_modified : "",
		size: typeof raw.size === "number" ? raw.size : 0,
	};
}

async function rpcCall(accessToken: string, path: string, body: unknown): Promise<{ status: number; payload: unknown }> {
	const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const payload = await parseJsonResponse(response);
	return { status: response.status, payload };
}

/**
 * Listet die ImmoBase-Sicherungsdateien im Backup-Ordner (paginiert über
 * list_folder/continue; ein fehlender Ordner liefert eine leere Liste).
 */
export async function listBackupFiles(accessToken: string, folderPath: string = DROPBOX_BACKUP_FOLDER): Promise<DropboxFileEntry[]> {
	const entries: DropboxFileEntry[] = [];
	let result = await rpcCall(accessToken, "/files/list_folder", { path: folderPath, limit: 200 });

	// Ordner existiert (noch) nicht - z. B. vor dem allerersten Upload.
	if (result.status === 409 && extractErrorSummary(result.payload)?.startsWith("path/not_found")) {
		return [];
	}

	for (;;) {
		if (result.status < 200 || result.status >= 300 || !isRecord(result.payload)) {
			throw new DropboxError(
				`Dropbox-Dateiliste konnte nicht gelesen werden: ${extractErrorSummary(result.payload) ?? `HTTP ${result.status}`}`,
				result.status
			);
		}
		const pageEntries = Array.isArray(result.payload.entries) ? result.payload.entries : [];
		for (const raw of pageEntries) {
			const entry = mapFileEntry(raw);
			if (entry && entry.name.startsWith(DROPBOX_BACKUP_FILE_PREFIX)) entries.push(entry);
		}
		if (result.payload.has_more !== true || typeof result.payload.cursor !== "string") break;
		result = await rpcCall(accessToken, "/files/list_folder/continue", { cursor: result.payload.cursor });
	}
	return entries;
}

/** Löscht eine Datei in Dropbox (Aufbewahrung alter Sicherungen). */
export async function deleteDropboxFile(accessToken: string, dropboxPath: string): Promise<void> {
	const result = await rpcCall(accessToken, "/files/delete_v2", { path: dropboxPath });
	if (result.status < 200 || result.status >= 300) {
		throw new DropboxError(
			`Dropbox-Datei konnte nicht gelöscht werden: ${extractErrorSummary(result.payload) ?? `HTTP ${result.status}`}`,
			result.status
		);
	}
}
