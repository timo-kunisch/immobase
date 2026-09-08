import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { deleteSetting, getSetting, getSettingWithEnvFallback, setSetting } from "@/data/app-settings";
import { exportBackup } from "@/data/backup";

import {
	DROPBOX_BACKUP_FILE_PREFIX,
	DROPBOX_BACKUP_FOLDER,
	DropboxError,
	buildAuthorizeUrl,
	createPkcePair,
	deleteDropboxFile,
	exchangeCodeForTokens,
	generateOAuthState,
	getCurrentAccount,
	listBackupFiles,
	refreshAccessToken,
	uploadFileToDropbox,
	type DropboxFileEntry,
} from "./dropbox";

/**
 * Orchestrierung der Dropbox-Cloud-Sicherung:
 * - Verbindung des Dropbox-Kontos (OAuth-PKCE-Flow ohne Redirect, siehe
 *   src/lib/dropbox.ts): Zugangsdaten liegen als feldverschlüsselte
 *   Geheimnisse in app_settings (dropbox.refresh_token, dropbox.access_token,
 *   dropbox.oauth_pending, dropbox.backup_password - siehe
 *   SECRET_SETTING_KEYS in src/data/app-settings.ts).
 * - Regelmäßige AUTOMATISCHE Backups: startDropboxBackupScheduler() wird vom
 *   geschützten App-Layout (src/app/(app)/layout.tsx) bei der ersten
 *   authentifizierten Seitenanzeige gestartet und prüft periodisch, ob eine
 *   Sicherung fällig ist. Die Sicherung selbst nutzt denselben Export wie
 *   die manuelle Datensicherung (src/data/backup.ts), optional
 *   passwortverschlüsselt (.imbak, src/lib/backup-crypto.ts).
 * - Aufbewahrung: Nach jedem erfolgreichen Upload werden ältere Sicherungen
 *   im Dropbox-Ordner bis auf die letzten N gelöscht.
 *
 * OPTIONALE Online-Funktion (nicht Teil des Offline-Kernpfads): Ohne
 * verbundenes Konto/aktivierte Sicherung passiert schlicht nichts.
 *
 * Alle Einstellungen werden bei jeder Prüfung frisch gelesen - Änderungen
 * in der UI greifen ohne Server-Neustart.
 */

// ------------------------------------------------------------
// Einstellungen (app_settings-Schlüssel)
// ------------------------------------------------------------

const KEY_APPKEY = "dropbox.appkey";
const KEY_REFRESH_TOKEN = "dropbox.refresh_token";
const KEY_ACCESS_TOKEN = "dropbox.access_token";
const KEY_ACCESS_TOKEN_EXPIRES = "dropbox.access_token_expires_at";
const KEY_OAUTH_PENDING = "dropbox.oauth_pending";
const KEY_ACCOUNT_EMAIL = "dropbox.account_email";
const KEY_CONNECTED_AT = "dropbox.connected_at";
const KEY_BACKUP_ENABLED = "dropbox.backup_enabled";
const KEY_BACKUP_INTERVAL = "dropbox.backup_interval";
const KEY_BACKUP_RETENTION = "dropbox.backup_retention";
const KEY_BACKUP_PASSWORD = "dropbox.backup_password";
const KEY_LAST_BACKUP_AT = "dropbox.last_backup_at";
const KEY_LAST_ERROR = "dropbox.last_backup_error";
const KEY_LAST_ERROR_AT = "dropbox.last_error_at";

export type DropboxBackupInterval = "daily" | "weekly";

export const DEFAULT_BACKUP_RETENTION = 10;
const MAX_BACKUP_RETENTION = 100;

/** Zeitfenster, in dem ein begonnener Verbindungsvorgang gültig bleibt. */
const OAUTH_PENDING_MAX_AGE_MS = 30 * 60 * 1000;

/** Sicherheitsabstand, ab dem ein Access-Token proaktiv erneuert wird. */
const ACCESS_TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;

// ------------------------------------------------------------
// App-Schlüssel + Verbindungsstatus
// ------------------------------------------------------------

/** Dropbox-App-Schlüssel (app_settings, Fallback: Umgebungsvariable). */
export function getDropboxAppKey(): string {
	return getSettingWithEnvFallback(KEY_APPKEY, "DROPBOX_APP_KEY");
}

/** Stammt der App-Schlüssel aus der Umgebungsvariable (nicht editierbar in der UI)? */
export function isDropboxAppKeyFromEnv(): boolean {
	return getSetting(KEY_APPKEY) === undefined && Boolean(process.env.DROPBOX_APP_KEY);
}

function requireDropboxAppKey(): string {
	const appKey = getDropboxAppKey();
	if (!appKey) {
		throw new DropboxError("Es ist kein Dropbox-App-Schlüssel hinterlegt (Einstellungen → Dropbox-Backup).");
	}
	return appKey;
}

/** Ist ein Dropbox-Konto verbunden (Refresh-Token vorhanden und entschlüsselbar)? */
export function isDropboxConnected(): boolean {
	return Boolean(getSetting(KEY_REFRESH_TOKEN));
}

/** Entfernt alle Verbindungsdaten (Tokens + Kontoinfo + Status), behält App-Schlüssel und Backup-Konfiguration. */
export function disconnectDropbox(): void {
	for (const key of [
		KEY_REFRESH_TOKEN,
		KEY_ACCESS_TOKEN,
		KEY_ACCESS_TOKEN_EXPIRES,
		KEY_OAUTH_PENDING,
		KEY_ACCOUNT_EMAIL,
		KEY_CONNECTED_AT,
		KEY_LAST_BACKUP_AT,
		KEY_LAST_ERROR,
		KEY_LAST_ERROR_AT,
	]) {
		deleteSetting(key);
	}
}

/** Entfernt nur die Zugangsdaten (z. B. nach einem widerrufenen Refresh-Token). */
function clearDropboxCredentials(): void {
	for (const key of [KEY_REFRESH_TOKEN, KEY_ACCESS_TOKEN, KEY_ACCESS_TOKEN_EXPIRES, KEY_ACCOUNT_EMAIL, KEY_CONNECTED_AT]) {
		deleteSetting(key);
	}
}

// ------------------------------------------------------------
// Verbindungs-Flow (OAuth, Code zum Kopieren)
// ------------------------------------------------------------

interface OAuthPending {
	state?: string;
	codeVerifier?: string;
	createdAt?: number;
}

/**
 * Startet den Verbindungsvorgang: erzeugt PKCE-Paar + state, hinterlegt sie
 * (feldverschlüsselt) als ausstehenden Vorgang und liefert die
 * Authorize-URL, die der Nutzer im Browser öffnen muss.
 */
export function beginDropboxConnect(appKey: string): string {
	const { codeVerifier, codeChallenge } = createPkcePair();
	const state = generateOAuthState();
	setSetting(KEY_APPKEY, appKey);
	setSetting(KEY_OAUTH_PENDING, JSON.stringify({ state, codeVerifier, createdAt: Date.now() } satisfies OAuthPending));
	return buildAuthorizeUrl(appKey, state, codeChallenge);
}

/** Liegt ein (noch gültiger) ausstehender Verbindungsvorgang vor? */
export function hasPendingDropboxConnect(): boolean {
	const pending = readPending();
	return pending !== null;
}

/** Bricht einen ausstehenden Verbindungsvorgang ab (verwirft das PKCE-Paar). */
export function cancelDropboxConnect(): void {
	deleteSetting(KEY_OAUTH_PENDING);
}

function readPending(): { codeVerifier: string; createdAt: number } | null {
	const raw = getSetting(KEY_OAUTH_PENDING);
	if (!raw) return null;
	let parsed: OAuthPending;
	try {
		parsed = JSON.parse(raw) as OAuthPending;
	} catch {
		return null;
	}
	if (!parsed.codeVerifier || typeof parsed.createdAt !== "number") return null;
	if (Date.now() - parsed.createdAt > OAUTH_PENDING_MAX_AGE_MS) return null;
	return { codeVerifier: parsed.codeVerifier, createdAt: parsed.createdAt };
}

/**
 * Schließt den Verbindungsvorgang ab: tauscht den vom Nutzer kopierten Code
 * gegen Tokens, speichert sie (feldverschlüsselt) und liest zur Anzeige die
 * Konto-E-Mail aus. Wirft DropboxError mit verständlicher Meldung.
 */
export async function completeDropboxConnect(code: string): Promise<{ email: string }> {
	const pending = readPending();
	if (!pending) {
		deleteSetting(KEY_OAUTH_PENDING);
		throw new DropboxError("Es liegt kein (gültiger) Verbindungsvorgang vor - bitte zuerst „Mit Dropbox verbinden“ starten.");
	}
	const appKey = requireDropboxAppKey();
	const tokens = await exchangeCodeForTokens(appKey, code.trim(), pending.codeVerifier);
	if (!tokens.refreshToken) {
		throw new DropboxError("Dropbox hat kein Refresh-Token geliefert - die Verbindung kann nicht dauerhaft eingerichtet werden.");
	}

	setSetting(KEY_REFRESH_TOKEN, tokens.refreshToken);
	setSetting(KEY_ACCESS_TOKEN, tokens.accessToken);
	setSetting(KEY_ACCESS_TOKEN_EXPIRES, new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString());
	deleteSetting(KEY_OAUTH_PENDING);

	try {
		const account = await getCurrentAccount(tokens.accessToken);
		setSetting(KEY_ACCOUNT_EMAIL, account.email);
		setSetting(KEY_CONNECTED_AT, new Date().toISOString());
		return { email: account.email };
	} catch (error) {
		// Die Verbindung steht (Tokens sind gespeichert) - die Kontoinfo ist
		// nur Anzeige. Fehler hier also nicht fatal, nur protokollieren.
		console.error("Dropbox-Kontoinformationen konnten nach dem Verbinden nicht gelesen werden", error);
		setSetting(KEY_CONNECTED_AT, new Date().toISOString());
		return { email: "" };
	}
}

// ------------------------------------------------------------
// Zugriffstoken (Cache + Refresh)
// ------------------------------------------------------------

let refreshInFlight: Promise<string> | null = null;

/**
 * Liefert ein gültiges Access-Token: das gespeicherte, solange es noch > 1
 * Minute gültig ist, sonst per Refresh-Token erneuert (und wieder
 * gespeichert). Gleichzeitige Aufrufe teilen sich denselben Refresh.
 */
export function getValidAccessToken(): Promise<string> {
	const cached = getSetting(KEY_ACCESS_TOKEN);
	const expiresAt = getSetting(KEY_ACCESS_TOKEN_EXPIRES);
	if (cached && expiresAt && Date.parse(expiresAt) - Date.now() > ACCESS_TOKEN_EXPIRY_MARGIN_MS) {
		return Promise.resolve(cached);
	}
	refreshInFlight ??= refreshAccessTokenNow().finally(() => {
		refreshInFlight = null;
	});
	return refreshInFlight;
}

async function refreshAccessTokenNow(): Promise<string> {
	const refreshToken = getSetting(KEY_REFRESH_TOKEN);
	if (!refreshToken) {
		throw new DropboxError("Dropbox ist nicht verbunden - bitte zuerst in den Einstellungen verbinden.");
	}
	try {
		const tokens = await refreshAccessToken(requireDropboxAppKey(), refreshToken);
		setSetting(KEY_ACCESS_TOKEN, tokens.accessToken);
		setSetting(KEY_ACCESS_TOKEN_EXPIRES, new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString());
		if (tokens.refreshToken) {
			// Dropbox kann das Refresh-Token rotieren - dann ersetzen.
			setSetting(KEY_REFRESH_TOKEN, tokens.refreshToken);
		}
		return tokens.accessToken;
	} catch (error) {
		if (error instanceof DropboxError && error.oauthError === "invalid_grant") {
			// Refresh-Token wurde widerrufen/ist ungültig: Verbindung klar
			// aufheben, damit die UI "nicht verbunden" zeigt statt dauerhaft
			// gegen eine tote Verbindung zu laufen.
			clearDropboxCredentials();
			throw new DropboxError(
				"Die Dropbox-Verbindung ist nicht mehr gültig (Token wurde widerrufen?). Bitte in den Einstellungen erneut verbinden."
			);
		}
		throw error;
	}
}

// ------------------------------------------------------------
// Backup-Konfiguration
// ------------------------------------------------------------

export interface DropboxBackupSettings {
	enabled: boolean;
	interval: DropboxBackupInterval;
	/** Anzahl der in Dropbox aufzubewahrenden Sicherungen (>= 1). */
	retention: number;
	/** Ist ein Verschlüsselungspasswort hinterlegt? */
	passwordSet: boolean;
}

export function getDropboxBackupSettings(): DropboxBackupSettings {
	const retentionRaw = Number(getSetting(KEY_BACKUP_RETENTION));
	return {
		enabled: getSetting(KEY_BACKUP_ENABLED) === "true",
		interval: getSetting(KEY_BACKUP_INTERVAL) === "weekly" ? "weekly" : "daily",
		retention: Number.isInteger(retentionRaw) && retentionRaw >= 1 ? Math.min(retentionRaw, MAX_BACKUP_RETENTION) : DEFAULT_BACKUP_RETENTION,
		passwordSet: Boolean(getSetting(KEY_BACKUP_PASSWORD)),
	};
}

/**
 * Speichert die Backup-Konfiguration. `password`-Semantik wie bei den
 * anderen Geheimnissen in der UI: undefined = unverändert lassen, "" bzw.
 * encrypt=false = entfernen, Wert = neu setzen.
 */
export function saveDropboxBackupSettings(input: {
	enabled: boolean;
	interval: DropboxBackupInterval;
	retention: number;
	encrypt: boolean;
	password?: string;
}): void {
	setSetting(KEY_BACKUP_ENABLED, input.enabled ? "true" : "false");
	setSetting(KEY_BACKUP_INTERVAL, input.interval);
	setSetting(KEY_BACKUP_RETENTION, String(Math.min(Math.max(Math.trunc(input.retention), 1), MAX_BACKUP_RETENTION)));
	if (!input.encrypt) {
		deleteSetting(KEY_BACKUP_PASSWORD);
	} else if (input.password) {
		setSetting(KEY_BACKUP_PASSWORD, input.password);
	}
}

// ------------------------------------------------------------
// Backup-Durchlauf (manuell + automatisch)
// ------------------------------------------------------------

export type DropboxBackupTrigger = "auto" | "manual";

export type DropboxBackupRunResult = { ok: true; fileName: string } | { ok: false; error: string };

let runInFlight: Promise<DropboxBackupRunResult> | null = null;

/**
 * Führt einen kompletten Backup-Durchlauf aus (Export → Upload →
 * Aufbewahrung). Gleichzeitige Auslöser (Scheduler + manueller Klick) teilen
 * sich denselben Lauf. Fehler werden als Ergebnis gemeldet UND in
 * app_settings protokolliert (Anzeige in den Einstellungen).
 */
export function runDropboxBackup(trigger: DropboxBackupTrigger): Promise<DropboxBackupRunResult> {
	runInFlight ??= performBackup(trigger).finally(() => {
		runInFlight = null;
	});
	return runInFlight;
}

async function performBackup(trigger: DropboxBackupTrigger): Promise<DropboxBackupRunResult> {
	const settings = getDropboxBackupSettings();
	const password = getSetting(KEY_BACKUP_PASSWORD);
	const extension = password ? "imbak" : "zip";
	const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const fileName = `${DROPBOX_BACKUP_FILE_PREFIX}${stamp}.${extension}`;
	const tmpPath = path.join(os.tmpdir(), `iv-dropbox-${crypto.randomUUID()}.${extension}`);

	try {
		if (!isDropboxConnected()) {
			throw new DropboxError("Dropbox ist nicht verbunden - bitte zuerst in den Einstellungen verbinden.");
		}
		const accessToken = await getValidAccessToken();

		await exportBackup(tmpPath, password ? { password } : undefined);
		await uploadFileToDropbox(accessToken, `${DROPBOX_BACKUP_FOLDER}/${fileName}`, tmpPath);

		setSetting(KEY_LAST_BACKUP_AT, new Date().toISOString());
		deleteSetting(KEY_LAST_ERROR);
		deleteSetting(KEY_LAST_ERROR_AT);
		console.info(`Dropbox-Backup (${trigger}): „${fileName}“ wurde hochgeladen.`);

		// Aufbewahrung: Fehler hier lassen das erfolgreiche Backup erfolgreich
		// bleiben - nur protokollieren.
		try {
			await enforceRetention(accessToken, settings.retention);
		} catch (retentionError) {
			console.error("Dropbox-Backup: Aufbewahrung alter Sicherungen fehlgeschlagen", retentionError);
		}

		return { ok: true, fileName };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setSetting(KEY_LAST_ERROR, message);
		setSetting(KEY_LAST_ERROR_AT, new Date().toISOString());
		console.error(`Dropbox-Backup (${trigger}) fehlgeschlagen`, error);
		return { ok: false, error: message };
	} finally {
		try {
			fs.rmSync(tmpPath, { force: true });
		} catch {
			// Temp-Datei - Fehler beim Aufräumen ignorieren.
		}
	}
}

/**
 * Wählt die zu löschenden Sicherungen aus: Dateinamen enthalten den
 * ISO-Zeitstempel (sortierbar) - absteigend sortiert bleiben die neuesten
 * `keep` Einträge, der Rest wird gelöscht.
 */
export function pickBackupsToDelete(entries: DropboxFileEntry[], keep: number): DropboxFileEntry[] {
	const sorted = [...entries].sort((a, b) => b.name.localeCompare(a.name));
	return sorted.slice(Math.max(keep, 1));
}

async function enforceRetention(accessToken: string, keep: number): Promise<void> {
	const entries = await listBackupFiles(accessToken);
	for (const entry of pickBackupsToDelete(entries, keep)) {
		await deleteDropboxFile(accessToken, entry.path);
		console.info(`Dropbox-Backup: alte Sicherung „${entry.name}“ gelöscht (Aufbewahrung: ${keep}).`);
	}
}

// ------------------------------------------------------------
// Scheduler (periodische automatische Sicherung)
// ------------------------------------------------------------

/** Prüfintervall: ob eine Sicherung fällig ist (die eigentliche Fälligkeit hängt am Intervall täglich/wöchentlich). */
const SCHEDULER_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Verzögerung der ersten Prüfung nach dem Server-Start. */
const SCHEDULER_INITIAL_DELAY_MS = 2 * 60 * 1000;

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Startet den Hintergrund-Scheduler für automatische Dropbox-Backups.
 * Idempotent; Timer sind unref'd, damit sie den Prozess nicht am Beenden
 * hindern.
 *
 * Aufruf aus src/app/(app)/layout.tsx (bei der ersten authentifizierten
 * Seitenanzeige - in der Desktop-App also unmittelbar nach dem Start).
 * NICHT aus src/instrumentation.ts: Der Instrumentation-Entry wird von den
 * outputFileTracingExcludes in next.config.ts NICHT abgedeckt (Next wendet
 * sie nur auf Route-Entries an) - die Backup-Kette (archiver/Streams)
 * würde dort das komplette Projektverzeichnis (inkl. dist/) in den
 * Standalone-Trace ziehen. Route-Traces dagegen werden korrekt gefiltert.
 */
export function startDropboxBackupScheduler(): void {
	if (schedulerTimer) return;
	schedulerTimer = setInterval(() => {
		void maybeRunScheduledDropboxBackup();
	}, SCHEDULER_CHECK_INTERVAL_MS);
	schedulerTimer.unref();
	const initial = setTimeout(() => {
		void maybeRunScheduledDropboxBackup();
	}, SCHEDULER_INITIAL_DELAY_MS);
	initial.unref();
}

/**
 * Führt eine Sicherung aus, wenn sie fällig ist (aktiviert + verbunden +
 * Intervall seit dem letzten Erfolg überschritten). Fehler werden nur
 * protokolliert - der Scheduler darf den Server niemals stören.
 */
export async function maybeRunScheduledDropboxBackup(now: Date = new Date()): Promise<void> {
	try {
		const settings = getDropboxBackupSettings();
		if (!settings.enabled || !isDropboxConnected()) return;
		const intervalMs = settings.interval === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
		const lastBackupAt = getSetting(KEY_LAST_BACKUP_AT);
		if (lastBackupAt && now.getTime() - Date.parse(lastBackupAt) < intervalMs) return;
		await runDropboxBackup("auto");
	} catch (error) {
		console.error("Dropbox-Backup-Scheduler: Fälligkeitsprüfung fehlgeschlagen", error);
	}
}

// ------------------------------------------------------------
// UI-Status (Einstellungen-Seite)
// ------------------------------------------------------------

export interface DropboxUiState {
	appKey: string;
	/** App-Schlüssel stammt aus der Umgebungsvariable (Feld in der UI gesperrt). */
	appKeyFromEnv: boolean;
	connected: boolean;
	accountEmail: string | null;
	connectedAt: string | null;
	/** Ein Verbindungsvorgang wurde gestartet und wartet auf den Code. */
	connectPending: boolean;
	enabled: boolean;
	interval: DropboxBackupInterval;
	retention: number;
	passwordSet: boolean;
	lastBackupAt: string | null;
	lastError: string | null;
	lastErrorAt: string | null;
}

/** Sammelt den kompletten Status für die Einstellungen-Seite (keine Geheimnisse!). */
export function getDropboxUiState(): DropboxUiState {
	const settings = getDropboxBackupSettings();
	return {
		appKey: getDropboxAppKey(),
		appKeyFromEnv: isDropboxAppKeyFromEnv(),
		connected: isDropboxConnected(),
		accountEmail: getSetting(KEY_ACCOUNT_EMAIL) ?? null,
		connectedAt: getSetting(KEY_CONNECTED_AT) ?? null,
		connectPending: hasPendingDropboxConnect(),
		enabled: settings.enabled,
		interval: settings.interval,
		retention: settings.retention,
		passwordSet: settings.passwordSet,
		lastBackupAt: getSetting(KEY_LAST_BACKUP_AT) ?? null,
		lastError: getSetting(KEY_LAST_ERROR) ?? null,
		lastErrorAt: getSetting(KEY_LAST_ERROR_AT) ?? null,
	};
}
