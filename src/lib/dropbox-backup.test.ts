import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSetting, getSetting, setSetting } from "@/data/app-settings";
import { closeDb, getDb } from "@/data/db";
import {
	DEFAULT_BACKUP_RETENTION,
	beginDropboxConnect,
	cancelDropboxConnect,
	completeDropboxConnect,
	disconnectDropbox,
	getDropboxBackupSettings,
	getDropboxUiState,
	getValidAccessToken,
	isDropboxConnected,
	maybeRunScheduledDropboxBackup,
	pickBackupsToDelete,
	runDropboxBackup,
	saveDropboxBackupSettings,
} from "@/lib/dropbox-backup";
import type { DropboxFileEntry } from "@/lib/dropbox";

/**
 * Tests für die Dropbox-Backup-Orchestrierung (src/lib/dropbox-backup.ts):
 * Einstellungen, Verbindungs-Flow (OAuth copy/paste), Token-Cache/Refresh,
 * kompletter Backup-Durchlauf (echter Export in ein Temp-Verzeichnis,
 * Upload/Aufbewahrung mit gemocktem fetch) und Scheduler-Fälligkeit.
 */

const ORIGINAL_ENV = { ...process.env };

let testDir: string;

type MockResponse = { status?: number; body?: unknown };

function jsonResponse({ status = 200, body = {} }: MockResponse): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockDropboxRouter(handlers: Record<string, (init: RequestInit) => MockResponse>) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init: init ?? {} });
		for (const [suffix, handler] of Object.entries(handlers)) {
			if (url.endsWith(suffix)) {
				return jsonResponse(handler(init ?? {}));
			}
		}
		throw new Error(`Unerwarteter Request im Test: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	return { fetchMock, calls };
}

/** Erfolgreiche Upload-Session + leere Ordnerliste (kein Retention-Delete nötig). */
function uploadSuccessHandlers(): Record<string, (init: RequestInit) => MockResponse> {
	return {
		"/files/upload_session/start": () => ({ body: { session_id: "sess-1" } }),
		"/files/upload_session/append_v2": () => ({ body: {} }),
		"/files/upload_session/finish": () => ({ body: { name: "ok" } }),
		"/files/list_folder": () => ({ body: { entries: [], cursor: "", has_more: false } }),
	};
}

/** Richtet eine verbundene Dropbox-Konfiguration mit noch gültigem Access-Token ein. */
function seedConnected(): void {
	setSetting("dropbox.appkey", "test-app-key");
	setSetting("dropbox.refresh_token", "rt-test");
	setSetting("dropbox.access_token", "at-valid");
	setSetting("dropbox.access_token_expires_at", new Date(Date.now() + 3600_000).toISOString());
}

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-dbx-backup-test-"));
	process.env.APP_DATA_DIR = testDir;
	delete process.env.DROPBOX_APP_KEY;
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Backup-Konfiguration", () => {
	it("liefert Standardwerte ohne Konfiguration", () => {
		expect(getDropboxBackupSettings()).toEqual({
			enabled: false,
			interval: "daily",
			retention: DEFAULT_BACKUP_RETENTION,
			passwordSet: false,
		});
	});

	it("speichert und liest die Konfiguration; Passwort-Semantik: undefined = unverändert, encrypt=false = entfernen", () => {
		saveDropboxBackupSettings({ enabled: true, interval: "weekly", retention: 5, encrypt: true, password: "geheim-123" });
		expect(getDropboxBackupSettings()).toEqual({ enabled: true, interval: "weekly", retention: 5, passwordSet: true });
		// Das Passwort liegt feldverschlüsselt vor (kein Klartext in der DB).
		const raw = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get("dropbox.backup_password") as { value: string };
		expect(raw.value).toMatch(/^enc:v1:/);

		// Ohne Passwort-Angabe bleibt das gespeicherte Passwort erhalten.
		saveDropboxBackupSettings({ enabled: true, interval: "daily", retention: 3, encrypt: true });
		expect(getDropboxBackupSettings().passwordSet).toBe(true);
		expect(getSetting("dropbox.backup_password")).toBe("geheim-123");

		// Verschlüsselung aus -> Passwort entfernt.
		saveDropboxBackupSettings({ enabled: false, interval: "daily", retention: 3, encrypt: false });
		expect(getDropboxBackupSettings().passwordSet).toBe(false);
	});

	it("begrenzt die Aufbewahrung auf 1-100", () => {
		saveDropboxBackupSettings({ enabled: false, interval: "daily", retention: 0, encrypt: false });
		expect(getDropboxBackupSettings().retention).toBeGreaterThanOrEqual(1);
		saveDropboxBackupSettings({ enabled: false, interval: "daily", retention: 500, encrypt: false });
		expect(getDropboxBackupSettings().retention).toBe(100);
	});
});

describe("Verbindungs-Flow", () => {
	it("beginDropboxConnect speichert App-Schlüssel + ausstehenden Vorgang und liefert die Authorize-URL", () => {
		const url = beginDropboxConnect("mein-app-key");
		expect(url).toContain("https://www.dropbox.com/oauth2/authorize?");
		expect(url).toContain("client_id=mein-app-key");
		expect(getSetting("dropbox.appkey")).toBe("mein-app-key");
		expect(getSetting("dropbox.oauth_pending")).toBeTruthy();
		expect(getDropboxUiState().connectPending).toBe(true);
	});

	it("cancelDropboxConnect verwirft den ausstehenden Vorgang", () => {
		beginDropboxConnect("mein-app-key");
		cancelDropboxConnect();
		expect(getDropboxUiState().connectPending).toBe(false);
	});

	it("completeDropboxConnect tauscht den Code, speichert Tokens verschlüsselt und liest die Konto-E-Mail", async () => {
		beginDropboxConnect("mein-app-key");
		const { fetchMock } = mockDropboxRouter({
			"/oauth2/token": (init) => {
				const body = new URLSearchParams(String(init.body));
				expect(body.get("grant_type")).toBe("authorization_code");
				expect(body.get("code")).toBe("der-kopierte-code");
				expect(body.get("client_id")).toBe("mein-app-key");
				expect(body.get("code_verifier")).toBeTruthy();
				return { body: { access_token: "at-1", refresh_token: "rt-1", expires_in: 14400 } };
			},
			"/users/get_current_account": () => ({ body: { email: "ich@example.com", name: { display_name: "Ich" } } }),
		});

		const result = await completeDropboxConnect("der-kopierte-code");

		expect(result.email).toBe("ich@example.com");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(isDropboxConnected()).toBe(true);
		expect(getSetting("dropbox.account_email")).toBe("ich@example.com");
		expect(getSetting("dropbox.oauth_pending")).toBeUndefined();
		// Refresh-Token liegt feldverschlüsselt vor.
		const raw = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get("dropbox.refresh_token") as { value: string };
		expect(raw.value).toMatch(/^enc:v1:/);
		expect(raw.value).not.toContain("rt-1");
	});

	it("completeDropboxConnect ohne ausstehenden Vorgang schlägt verständlich fehl", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(completeDropboxConnect("irgendwas")).rejects.toThrow("Verbindungsvorgang");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("disconnectDropbox löscht Zugangsdaten + Status, behält aber die Backup-Konfiguration", () => {
		seedConnected();
		setSetting("dropbox.account_email", "ich@example.com");
		saveDropboxBackupSettings({ enabled: true, interval: "weekly", retention: 7, encrypt: true, password: "geheim-123" });

		disconnectDropbox();

		expect(isDropboxConnected()).toBe(false);
		expect(getSetting("dropbox.account_email")).toBeUndefined();
		expect(getSetting("dropbox.access_token")).toBeUndefined();
		const settings = getDropboxBackupSettings();
		expect(settings).toMatchObject({ enabled: true, interval: "weekly", retention: 7, passwordSet: true });
	});
});

describe("getValidAccessToken", () => {
	it("nutzt das gespeicherte Access-Token, solange es gültig ist (kein Request)", async () => {
		seedConnected();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(getValidAccessToken()).resolves.toBe("at-valid");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("erneuert ein abgelaufenes Access-Token per Refresh-Token und speichert es", async () => {
		seedConnected();
		setSetting("dropbox.access_token_expires_at", new Date(Date.now() - 1000).toISOString());
		const { fetchMock } = mockDropboxRouter({
			"/oauth2/token": (init) => {
				const body = new URLSearchParams(String(init.body));
				expect(body.get("grant_type")).toBe("refresh_token");
				expect(body.get("refresh_token")).toBe("rt-test");
				return { body: { access_token: "at-frisch", expires_in: 14400 } };
			},
		});

		await expect(getValidAccessToken()).resolves.toBe("at-frisch");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(getSetting("dropbox.access_token")).toBe("at-frisch");
	});

	it("hebt die Verbindung auf, wenn Dropbox das Refresh-Token ablehnt (invalid_grant)", async () => {
		seedConnected();
		deleteSetting("dropbox.access_token");
		deleteSetting("dropbox.access_token_expires_at");
		mockDropboxRouter({
			"/oauth2/token": () => ({ status: 400, body: { error: "invalid_grant", error_description: "revoked" } }),
		});

		await expect(getValidAccessToken()).rejects.toThrow("nicht mehr gültig");
		expect(isDropboxConnected()).toBe(false);
	});

	it("wirft ohne Verbindung einen verständlichen Fehler", async () => {
		await expect(getValidAccessToken()).rejects.toThrow("nicht verbunden");
	});
});

describe("runDropboxBackup", () => {
	it("führt Export + Upload durch und protokolliert den Erfolg", async () => {
		seedConnected();
		const { calls } = mockDropboxRouter(uploadSuccessHandlers());

		const result = await runDropboxBackup("manual");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.fileName).toMatch(/^immobase-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/);
		}
		// Upload-Session wurde gestartet, mindestens ein Chunk gesendet, abgeschlossen.
		expect(calls.some((c) => c.url.endsWith("/files/upload_session/start"))).toBe(true);
		expect(calls.some((c) => c.url.endsWith("/files/upload_session/append_v2"))).toBe(true);
		const finishCall = calls.find((c) => c.url.endsWith("/files/upload_session/finish"));
		const finishArg = JSON.parse((finishCall!.init.headers as Record<string, string>)["Dropbox-API-Arg"]) as {
			commit: { path: string };
		};
		expect(finishArg.commit.path).toMatch(/^\/ImmoBase-Backups\/immobase-backup-.*\.zip$/);
		expect(getSetting("dropbox.last_backup_at")).toBeTruthy();
		expect(getSetting("dropbox.last_backup_error")).toBeUndefined();
	});

	it("erzeugt einen .imbak-Container, wenn ein Verschlüsselungspasswort hinterlegt ist", async () => {
		seedConnected();
		saveDropboxBackupSettings({ enabled: true, interval: "daily", retention: 10, encrypt: true, password: "geheim-123" });
		mockDropboxRouter(uploadSuccessHandlers());

		const result = await runDropboxBackup("manual");

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.fileName).toMatch(/\.imbak$/);
	});

	it("löscht nach dem Upload alte Sicherungen gemäß Aufbewahrung", async () => {
		seedConnected();
		saveDropboxBackupSettings({ enabled: true, interval: "daily", retention: 1, encrypt: false });
		const deleted: string[] = [];
		mockDropboxRouter({
			...uploadSuccessHandlers(),
			"/files/list_folder": () => ({
				body: {
					entries: [
						{ ".tag": "file", name: "immobase-backup-2026-01-03T00-00-00.zip", path_display: "/ImmoBase-Backups/immobase-backup-2026-01-03T00-00-00.zip" },
						{ ".tag": "file", name: "immobase-backup-2026-01-02T00-00-00.zip", path_display: "/ImmoBase-Backups/immobase-backup-2026-01-02T00-00-00.zip" },
						{ ".tag": "file", name: "immobase-backup-2026-01-01T00-00-00.zip", path_display: "/ImmoBase-Backups/immobase-backup-2026-01-01T00-00-00.zip" },
					],
					cursor: "",
					has_more: false,
				},
			}),
			"/files/delete_v2": (init) => {
				deleted.push((JSON.parse(String(init.body)) as { path: string }).path);
				return { body: {} };
			},
		});

		const result = await runDropboxBackup("manual");

		expect(result.ok).toBe(true);
		// Aufbewahrung 1: Die beiden ÄLTESTEN vorhandenen Sicherungen werden gelöscht
		// (die gerade hochgeladene trägt den aktuellen Zeitstempel und ist nicht in der Liste).
		expect([...deleted].sort()).toEqual([
			"/ImmoBase-Backups/immobase-backup-2026-01-01T00-00-00.zip",
			"/ImmoBase-Backups/immobase-backup-2026-01-02T00-00-00.zip",
		]);
	});

	it("meldet einen Upload-Fehler als Ergebnis und protokolliert ihn in den Einstellungen", async () => {
		seedConnected();
		mockDropboxRouter({
			...uploadSuccessHandlers(),
			"/files/upload_session/finish": () => ({ status: 409, body: { error_summary: "path/conflict/file/.." } }),
		});

		const result = await runDropboxBackup("manual");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("path/conflict");
		expect(getSetting("dropbox.last_backup_at")).toBeUndefined();
		expect(getSetting("dropbox.last_backup_error")).toContain("path/conflict");
		expect(getSetting("dropbox.last_error_at")).toBeTruthy();
	});

	it("schlägt ohne Verbindung fehl, ohne einen Request zu senden", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const result = await runDropboxBackup("manual");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("nicht verbunden");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("Scheduler-Fälligkeit", () => {
	it("tut nichts, wenn die Sicherung deaktiviert oder nicht verbunden ist", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await maybeRunScheduledDropboxBackup();
		expect(fetchMock).not.toHaveBeenCalled();

		saveDropboxBackupSettings({ enabled: true, interval: "daily", retention: 10, encrypt: false });
		await maybeRunScheduledDropboxBackup(); // aktiviert, aber nicht verbunden
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("überspringt die Sicherung, wenn das Intervall noch nicht erreicht ist", async () => {
		seedConnected();
		saveDropboxBackupSettings({ enabled: true, interval: "daily", retention: 10, encrypt: false });
		setSetting("dropbox.last_backup_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()); // vor 1 h
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await maybeRunScheduledDropboxBackup(new Date());
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("führt die Sicherung aus, wenn das Intervall überschritten ist", async () => {
		seedConnected();
		saveDropboxBackupSettings({ enabled: true, interval: "daily", retention: 10, encrypt: false });
		setSetting("dropbox.last_backup_at", new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()); // vor 25 h
		const { fetchMock } = mockDropboxRouter(uploadSuccessHandlers());

		await maybeRunScheduledDropboxBackup(new Date());

		expect(fetchMock).toHaveBeenCalled();
		expect(getSetting("dropbox.last_backup_error")).toBeUndefined();
	});
});

describe("pickBackupsToDelete", () => {
	it("behält die neuesten N Einträge (Sortierung über den Zeitstempel im Dateinamen)", () => {
		const entries: DropboxFileEntry[] = [
			{ name: "immobase-backup-2026-01-02T00-00-00.zip", path: "/b2", serverModified: "", size: 0 },
			{ name: "immobase-backup-2026-01-01T00-00-00.zip", path: "/b1", serverModified: "", size: 0 },
			{ name: "immobase-backup-2026-01-03T00-00-00.zip", path: "/b3", serverModified: "", size: 0 },
		];
		expect(pickBackupsToDelete(entries, 2).map((e) => e.path)).toEqual(["/b1"]);
		expect(pickBackupsToDelete(entries, 5)).toEqual([]);
		// keep = 0 wird auf 1 gehoben: das frisch hochgeladene Backup nie löschen.
		expect(pickBackupsToDelete(entries, 0).map((e) => e.path)).toEqual(["/b2", "/b1"]);
	});
});
