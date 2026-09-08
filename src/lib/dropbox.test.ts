import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
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
} from "@/lib/dropbox";

/**
 * Tests für den Dropbox-API-Client (src/lib/dropbox.ts). fetch() wird in
 * JEDEM Testfall gemockt (vi.stubGlobal) - es findet ausdrücklich KEIN
 * echter Request gegen die Dropbox-API statt (Muster wie in
 * src/lib/letterxpress.test.ts).
 */

type MockResponse = { status?: number; body?: unknown };

function jsonResponse({ status = 200, body = {} }: MockResponse): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Router-Mock: bildet URL-Endungen auf Antwort-Funktionen ab und protokolliert
 * alle Requests für spätere Assertions.
 */
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

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("OAuth-Hilfsfunktionen", () => {
	it("createPkcePair erzeugt Verifier und passenden S256-Challenge", () => {
		const { codeVerifier, codeChallenge } = createPkcePair();
		expect(codeVerifier).not.toBe(codeChallenge);
		expect(codeVerifier.length).toBeGreaterThan(40);
		expect(codeChallenge).toBe(createHash("sha256").update(codeVerifier).digest("base64url"));
		// base64url: keine +-Zeichen (URL-sicher)
		expect(codeChallenge).not.toMatch(/[+/=]/);
	});

	it("buildAuthorizeUrl enthält client_id, offline-Zugang und PKCE - aber bewusst KEINEN redirect_uri", () => {
		const url = buildAuthorizeUrl("test-app-key", "state-123", "challenge-456");
		expect(url.startsWith("https://www.dropbox.com/oauth2/authorize?")).toBe(true);
		const params = new URL(url).searchParams;
		expect(params.get("response_type")).toBe("code");
		expect(params.get("client_id")).toBe("test-app-key");
		expect(params.get("token_access_type")).toBe("offline");
		expect(params.get("code_challenge")).toBe("challenge-456");
		expect(params.get("code_challenge_method")).toBe("S256");
		expect(params.get("state")).toBe("state-123");
		// Copy/Paste-Flow ohne Redirect (Desktop-App mit dynamischem Port).
		expect(params.get("redirect_uri")).toBeNull();
	});

	it("generateOAuthState erzeugt zufällige, unterschiedliche Werte", () => {
		expect(generateOAuthState()).not.toBe(generateOAuthState());
	});
});

describe("Token-Endpunkte", () => {
	it("exchangeCodeForTokens sendet grant_type=authorization_code mit PKCE-Verifier und parst die Antwort", async () => {
		const { fetchMock } = mockDropboxRouter({
			"/oauth2/token": () => ({ body: { access_token: "at-1", refresh_token: "rt-1", expires_in: 14400, token_type: "bearer" } }),
		});

		const tokens = await exchangeCodeForTokens("app-key", "code-abc", "verifier-xyz");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe("https://api.dropboxapi.com/oauth2/token");
		expect(init?.method).toBe("POST");
		const body = new URLSearchParams(String(init?.body));
		expect(body.get("grant_type")).toBe("authorization_code");
		expect(body.get("code")).toBe("code-abc");
		expect(body.get("client_id")).toBe("app-key");
		expect(body.get("code_verifier")).toBe("verifier-xyz");
		expect(tokens).toEqual({ accessToken: "at-1", refreshToken: "rt-1", expiresInSeconds: 14400 });
	});

	it("refreshAccessToken sendet grant_type=refresh_token", async () => {
		const { fetchMock } = mockDropboxRouter({
			"/oauth2/token": () => ({ body: { access_token: "at-2", expires_in: 14400 } }),
		});

		const tokens = await refreshAccessToken("app-key", "rt-1");

		const body = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));
		expect(body.get("grant_type")).toBe("refresh_token");
		expect(body.get("refresh_token")).toBe("rt-1");
		expect(tokens.accessToken).toBe("at-2");
		expect(tokens.refreshToken).toBeUndefined();
	});

	it("wirft DropboxError mit oauthError bei einer OAuth-Fehlerantwort (z. B. invalid_grant)", async () => {
		mockDropboxRouter({
			"/oauth2/token": () => ({ status: 400, body: { error: "invalid_grant", error_description: "refresh token is invalid" } }),
		});

		await expect(refreshAccessToken("app-key", "tot")).rejects.toMatchObject({
			name: "DropboxError",
			status: 400,
			oauthError: "invalid_grant",
			message: expect.stringContaining("refresh token is invalid"),
		});
	});

	it("wirft DropboxError, wenn die Erfolgsantwort kein access_token enthält", async () => {
		mockDropboxRouter({ "/oauth2/token": () => ({ body: { token_type: "bearer" } }) });
		await expect(refreshAccessToken("app-key", "rt")).rejects.toThrow(DropboxError);
	});
});

describe("getCurrentAccount", () => {
	it("ruft users/get_current_account mit Bearer-Token auf und mappt E-Mail/Anzeigename", async () => {
		const { fetchMock } = mockDropboxRouter({
			"/users/get_current_account": () => ({ body: { email: "max@example.com", name: { display_name: "Max Muster" } } }),
		});

		const account = await getCurrentAccount("at-1");

		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe("https://api.dropboxapi.com/2/users/get_current_account");
		expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer at-1");
		expect(account).toEqual({ email: "max@example.com", displayName: "Max Muster" });
	});
});

describe("uploadFileToDropbox", () => {
	let tmpDir: string;

	function writeTempFile(size: number): string {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-dbx-test-"));
		const filePath = path.join(tmpDir, "backup.zip");
		const buffer = Buffer.alloc(size);
		for (let i = 0; i < size; i++) buffer[i] = i % 251;
		fs.writeFileSync(filePath, buffer);
		return filePath;
	}

	afterEach(() => {
		if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	function uploadHandlers(onAppend?: (offset: number, callIndex: number) => MockResponse | null) {
		let appendCalls = 0;
		const appends: { offset: number; sessionId: string; size: number }[] = [];
		const handlers: Record<string, (init: RequestInit) => MockResponse> = {
			"/files/upload_session/start": () => ({ body: { session_id: "sess-1" } }),
			"/files/upload_session/append_v2": (init) => {
				const arg = JSON.parse((init.headers as Record<string, string>)["Dropbox-API-Arg"]) as {
					cursor: { session_id: string; offset: number };
				};
				appends.push({ offset: arg.cursor.offset, sessionId: arg.cursor.session_id, size: (init.body as Uint8Array).length });
				appendCalls++;
				const override = onAppend?.(arg.cursor.offset, appendCalls);
				if (override) return override;
				return { body: {} };
			},
			"/files/upload_session/finish": (init) => {
				const arg = JSON.parse((init.headers as Record<string, string>)["Dropbox-API-Arg"]) as {
					cursor: { offset: number };
					commit: { path: string };
				};
				return { body: { name: path.posix.basename(arg.commit.path), offsetSeen: arg.cursor.offset, path: arg.commit.path } };
			},
		};
		return { handlers, appends };
	}

	it("lädt eine Datei chunked hoch (start -> append je Chunk -> finish mit Commit)", async () => {
		const filePath = writeTempFile(2500); // bei chunkSize 1024: 3 Chunks (1024/1024/452)
		const { handlers, appends } = uploadHandlers();
		const { calls } = mockDropboxRouter(handlers);

		await uploadFileToDropbox("at-1", "/ImmoBase-Backups/immobase-backup-x.zip", filePath, 1024);

		expect(appends).toEqual([
			{ offset: 0, sessionId: "sess-1", size: 1024 },
			{ offset: 1024, sessionId: "sess-1", size: 1024 },
			{ offset: 2048, sessionId: "sess-1", size: 452 },
		]);
		const finishCall = calls.find((c) => c.url.endsWith("/files/upload_session/finish"));
		const finishArg = JSON.parse((finishCall!.init.headers as Record<string, string>)["Dropbox-API-Arg"]) as {
			cursor: { offset: number };
			commit: { path: string; mode: { ".tag": string } };
		};
		expect(finishArg.cursor.offset).toBe(2500);
		expect(finishArg.commit.path).toBe("/ImmoBase-Backups/immobase-backup-x.zip");
		expect(finishArg.commit.mode[".tag"]).toBe("overwrite");
	});

	it("setzt bei incorrect_offset mit dem gemeldeten correct_offset fort", async () => {
		const filePath = writeTempFile(2500);
		// Erster Append meldet: Server hat bereits 1024 Bytes.
		const { handlers, appends } = uploadHandlers((offset, callIndex) =>
			callIndex === 1
				? {
						status: 409,
						body: {
							error_summary: "upload_session_lookup_error/incorrect_offset/...",
							error: {
								".tag": "upload_session_lookup_error",
								upload_session_lookup_error: { ".tag": "incorrect_offset", correct_offset: 1024 },
							},
						},
					}
				: null
		);
		const { calls } = mockDropboxRouter(handlers);

		await uploadFileToDropbox("at-1", "/x.zip", filePath, 1024);

		// Nach dem 409 geht es mit Offset 1024 weiter (Chunk ab 1024 erneut).
		expect(appends.map((a) => a.offset)).toEqual([0, 1024, 2048]);
		const finishCall = calls.find((c) => c.url.endsWith("/files/upload_session/finish"));
		const finishArg = JSON.parse((finishCall!.init.headers as Record<string, string>)["Dropbox-API-Arg"]) as { cursor: { offset: number } };
		expect(finishArg.cursor.offset).toBe(2500);
	});

	it("funktioniert auch bei einer leeren Datei (start + finish ohne Chunks)", async () => {
		const filePath = writeTempFile(0);
		const { handlers, appends } = uploadHandlers();
		mockDropboxRouter(handlers);

		await uploadFileToDropbox("at-1", "/leer.zip", filePath, 1024);

		expect(appends).toEqual([]);
	});

	it("wirft DropboxError bei einem nicht korrigierbaren Upload-Fehler (409 ohne incorrect_offset)", async () => {
		const filePath = writeTempFile(10);
		const { handlers } = uploadHandlers(() => ({
			status: 409,
			body: { error_summary: "upload_session_lookup_error/not_found/..", error: { ".tag": "upload_session_lookup_error" } },
		}));
		mockDropboxRouter(handlers);

		await expect(uploadFileToDropbox("at-1", "/x.zip", filePath, 1024)).rejects.toMatchObject({
			name: "DropboxError",
			status: 409,
			message: expect.stringContaining("upload_session_lookup_error/not_found"),
		});
	});
});

describe("listBackupFiles", () => {
	it("listet nur ImmoBase-Backup-Dateien und folgt der Paginierung (list_folder/continue)", async () => {
		const { fetchMock } = mockDropboxRouter({
			"/files/list_folder": () => ({
				body: {
					entries: [
						{ ".tag": "file", name: "immobase-backup-2026-01-02T00-00-00.zip", path_display: "/ImmoBase-Backups/immobase-backup-2026-01-02T00-00-00.zip", server_modified: "2026-01-02T00:00:00Z", size: 10 },
						{ ".tag": "file", name: "fremd.txt", path_display: "/ImmoBase-Backups/fremd.txt" },
						{ ".tag": "folder", name: "immobase-backup-ordner", path_display: "/ImmoBase-Backups/immobase-backup-ordner" },
					],
					cursor: "cur-1",
					has_more: true,
				},
			}),
			"/files/list_folder/continue": (init) => {
				expect(JSON.parse(String(init.body))).toEqual({ cursor: "cur-1" });
				return {
					body: {
						entries: [
							{ ".tag": "file", name: "immobase-backup-2026-01-01T00-00-00.zip", path_display: "/ImmoBase-Backups/immobase-backup-2026-01-01T00-00-00.zip", server_modified: "2026-01-01T00:00:00Z", size: 5 },
						],
						cursor: "cur-2",
						has_more: false,
					},
				};
			},
		});

		const entries = await listBackupFiles("at-1");

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(entries.map((e) => e.name)).toEqual([
			"immobase-backup-2026-01-02T00-00-00.zip",
			"immobase-backup-2026-01-01T00-00-00.zip",
		]);
	});

	it("liefert eine leere Liste, wenn der Ordner noch nicht existiert (path/not_found)", async () => {
		mockDropboxRouter({
			"/files/list_folder": () => ({ status: 409, body: { error_summary: "path/not_found/.." } }),
		});

		await expect(listBackupFiles("at-1")).resolves.toEqual([]);
	});

	it("wirft DropboxError bei anderen Fehlern", async () => {
		mockDropboxRouter({
			"/files/list_folder": () => ({ status: 401, body: { error_summary: "invalid_access_token/.." } }),
		});

		await expect(listBackupFiles("at-1")).rejects.toMatchObject({ name: "DropboxError", status: 401 });
	});
});

describe("deleteDropboxFile", () => {
	it("löscht die Datei über files/delete_v2", async () => {
		const { fetchMock } = mockDropboxRouter({ "/files/delete_v2": () => ({ body: {} }) });

		await deleteDropboxFile("at-1", "/ImmoBase-Backups/alt.zip");

		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ path: "/ImmoBase-Backups/alt.zip" });
	});
});

describe("fetchWithRetry (über einen öffentlichen Endpunkt getestet)", () => {
	it("wiederholt 429-Antworten und liefert dann die erfolgreiche Antwort", async () => {
		let attempts = 0;
		const fetchMock = vi.fn(async () => {
			attempts++;
			return jsonResponse(
				attempts === 1 ? { status: 429, body: {} } : { status: 200, body: { email: "max@example.com", name: { display_name: "Max" } } }
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const account = await getCurrentAccount("at-1");

		expect(attempts).toBe(2);
		expect(account.email).toBe("max@example.com");
	}, 15_000);

	it("wirft nach wiederholten Netzwerkfehlern einen verständlichen DropboxError", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getCurrentAccount("at-1")).rejects.toMatchObject({
			name: "DropboxError",
			message: expect.stringContaining("network down"),
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	}, 15_000);
});
