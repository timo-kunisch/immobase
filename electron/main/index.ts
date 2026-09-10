import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";

import { getOrCreateDataKey } from "./data-key";
import { destroyDiscovery, publishHostService, startDiscovery, type DiscoveredHost } from "./discovery";
import { initMainLog, log } from "./log";
import { checkDataDirNotOnNetworkDrive } from "./network-check";
import { startEmbeddedServer, type RunningServer } from "./server";
import { generateHostToken, SettingsStore, type AppMode } from "./settings";
import { checkForUpdatesQuietly, getUpdateState, installUpdateNow } from "./updater";

/**
 * Electron-Main-Prozess von ImmoBase.
 *
 * Verantwortlichkeiten:
 * - Single-Instance-Lock, Fenster-Lifecycle, Sicherheits-Baselines
 *   (contextIsolation/sandbox/keine nodeIntegration)
 * - Netzlaufwerk-Schutz für das Datenverzeichnis (siehe network-check.ts)
 * - Start des eingebetteten Next.js-Servers (Modi local/host) bzw.
 *   Verbindung zu einem Host (Modus client), inkl. Token-Injektion
 * - mDNS-Discovery, Verbindungsstatus-Events, IPC-Brücke für den Renderer
 * - Auto-Updates (offline-tolerant, siehe updater.ts)
 */

const isDev = !app.isPackaged;

interface ConnectionState {
	mode: AppMode | null;
	localUrl: string | null;
	hostUrl: string | null;
	hostPort: number | null;
	connected: boolean;
	lastError: string | null;
}

let settings: SettingsStore;
let runningServer: RunningServer | null = null;
let unpublishHost: (() => void) | null = null;
let mainWindow: BrowserWindow | null = null;
let discoveredHosts: DiscoveredHost[] = [];
let discoveryActive = false;

const connectionState: ConnectionState = {
	mode: null,
	localUrl: null,
	hostUrl: null,
	hostPort: null,
	connected: false,
	lastError: null,
};

// ------------------------------------------------------------
// Pfade
// ------------------------------------------------------------

function getStandaloneDir(): string {
	// Produktiv: extraResources (siehe electron-builder.yml). Entwicklung:
	// nicht verwendet (dort läuft `next dev` separat auf Port 3000).
	return path.join(process.resourcesPath, "standalone");
}

function getShellPagePath(): string {
	if (isDev) return path.join(app.getAppPath(), "electron", "shell", "connect.html");
	return path.join(process.resourcesPath, "shell", "connect.html");
}

// ------------------------------------------------------------
// Verbindungsstatus
// ------------------------------------------------------------

function setConnectionState(patch: Partial<ConnectionState>): void {
	Object.assign(connectionState, patch);
	for (const win of BrowserWindow.getAllWindows()) {
		if (!win.isDestroyed()) win.webContents.send("iv:connection-state", { ...connectionState });
	}
}

// ------------------------------------------------------------
// Fenster
// ------------------------------------------------------------

/**
 * Prüft, ob eine URL zum Ursprung der App gehört (eingebetteter lokaler
 * Server bzw. verbundener Host im Client-Modus).
 */
function isAppUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	return ([connectionState.localUrl, connectionState.hostUrl].filter(Boolean) as string[]).some((origin) => {
		try {
			return new URL(origin).origin === parsed.origin;
		} catch {
			return false;
		}
	});
}

/**
 * Öffnet eine App-interne URL (z. B. PDF-/Bild-Vorschau über /api/uploads)
 * in einem eigenen App-Fenster. Das Fenster nutzt dieselbe Session wie das
 * Hauptfenster - der eingeloggte Zustand bleibt damit erhalten und die
 * Datei zeigt sich sofort (der System-Browser hätte keine Session und
 * verlangte einen erneuten Login).
 */
function openViewerWindow(url: string): void {
	const preload = path.join(__dirname, "../preload/index.js");
	const win = new BrowserWindow({
		width: 1100,
		height: 800,
		title: "ImmoBase",
		autoHideMenuBar: true,
		webPreferences: {
			preload,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
			allowRunningInsecureContent: false,
		},
	});
	attachNavigationPolicy(win);
	win.loadURL(url).catch((error) => {
		log.error(`Laden von ${url} im Vorschau-Fenster fehlgeschlagen`, error);
		if (!win.isDestroyed()) win.close();
	});
}

/**
 * Fenster-Politik für alle App-Fenster: App-interne target="_blank"-Links
 * (z. B. Dokumente-/PDF-Vorschau) öffnen in einem eigenen App-Fenster
 * derselben Session. Externe Links landen dagegen wie bisher im
 * System-Browser, niemals im App-Fenster (Sicherheit + Konsistenz).
 */
function attachNavigationPolicy(win: BrowserWindow): void {
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (isAppUrl(url)) {
			openViewerWindow(url);
			return { action: "deny" };
		}
		if (url.startsWith("http://") || url.startsWith("https://")) void shell.openExternal(url);
		return { action: "deny" };
	});
	win.webContents.on("will-navigate", (event, url) => {
		// Navigation nur innerhalb der erlaubten Ursprünge (lokaler Server,
		// konfigurierter Host, Shell-Datei).
		const allowed = [connectionState.localUrl, connectionState.hostUrl, "file://"].filter(Boolean) as string[];
		if (!allowed.some((origin) => url.startsWith(origin))) {
			event.preventDefault();
			void shell.openExternal(url);
		}
	});
}

function createMainWindow(): BrowserWindow {
	const preload = path.join(__dirname, "../preload/index.js");
	const win = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 700,
		title: "ImmoBase",
		autoHideMenuBar: true,
		webPreferences: {
			preload,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
			allowRunningInsecureContent: false,
		},
	});

	attachNavigationPolicy(win);

	win.on("closed", () => {
		if (mainWindow === win) mainWindow = null;
	});
	return win;
}

function getOrCreateWindow(): BrowserWindow {
	if (!mainWindow || mainWindow.isDestroyed()) {
		mainWindow = createMainWindow();
	}
	return mainWindow;
}

// ------------------------------------------------------------
// Shell-Seite (Setup / Client-Verbindung / Verbindungsfehler)
// ------------------------------------------------------------

function showShellPage(): void {
	const win = getOrCreateWindow();
	const page = getShellPagePath();
	if (!fs.existsSync(page)) {
		log.error(`Shell-Seite nicht gefunden: ${page}`);
		return;
	}
	void win.loadFile(page);
}

/**
 * Lädt eine App-URL ins Hauptfenster, sofern das Fenster nicht bereits
 * dieselbe Origin zeigt. Bei einem Server-Neustart mit gleichem Port
 * (Moduswechsel local <-> host zur Laufzeit) bleibt die bereits geladene
 * Seite so erhalten und Client-State (z. B. der Setup-Wizard) geht nicht
 * verloren.
 */
async function loadAppUrlIfNeeded(url: string): Promise<void> {
	const win = getOrCreateWindow();
	let sameOrigin = false;
	try {
		sameOrigin = new URL(win.webContents.getURL()).origin === new URL(url).origin;
	} catch {
		// about:blank o. ä. - Origin-Vergleich nicht möglich -> laden
	}
	if (!sameOrigin) await win.loadURL(url);
}

// ------------------------------------------------------------
// Server-Start (Modi local + host)
// ------------------------------------------------------------

async function startLocalServer(mode: "local" | "host"): Promise<void> {
	// Bestehenden Server zuerst sauber beenden (Moduswechsel zur Laufzeit).
	if (runningServer) {
		await runningServer.close();
		runningServer = null;
	}
	if (unpublishHost) {
		unpublishHost();
		unpublishHost = null;
	}

	let hostToken = settings.get().hostToken;
	if (mode === "host" && !hostToken) {
		hostToken = generateHostToken();
		settings.update({ hostToken });
	}

	// Master-Schlüssel für die Datenverschlüsselung at rest aus dem
	// OS-Schlüsselbund auflösen (bzw. beim ersten Start erzeugen) und dem
	// eingebetteten Next-Server übergeben. Schlägt die Auflösung fehl (z. B.
	// Datenverzeichnis von einem anderen Gerät übernommen), wird der Start
	// mit einer klaren Fehlermeldung abgebrochen (siehe boot()).
	process.env.IMMOBASE_DATA_KEY = getOrCreateDataKey(settings, app.getPath("userData"));

	const current = settings.get();
	runningServer = await startEmbeddedServer({
		standaloneDir: getStandaloneDir(),
		preferredPort: current.lastPort,
		preferredHostPort: current.lastHostPort,
		hostMode: mode === "host",
		hostToken,
		dataDir: app.getPath("userData"),
		appVersion: app.getVersion(),
	});

	settings.update({ lastPort: runningServer.port, lastHostPort: runningServer.hostPort });

	if (mode === "host" && runningServer.hostPort) {
		unpublishHost = publishHostService(runningServer.hostPort);
	}

	setConnectionState({
		mode,
		localUrl: runningServer.localUrl,
		hostPort: runningServer.hostPort,
		connected: true,
		lastError: null,
	});

	await loadAppUrlIfNeeded(runningServer.localUrl);
}

// ------------------------------------------------------------
// Client-Modus
// ------------------------------------------------------------

let tokenInjectionRegisteredFor: string | null = null;

function registerClientTokenInjection(hostUrl: string, token: string): void {
	// Token als Header auf alle Requests an den Host (Renderer-Prozess kann
	// keine Header setzen; der Main-Prozess kann es via webRequest).
	if (tokenInjectionRegisteredFor === `${hostUrl}|${token}`) return;
	tokenInjectionRegisteredFor = `${hostUrl}|${token}`;

	session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${hostUrl.replace(/\/$/, "")}/*`] }, (details, callback) => {
		callback({ requestHeaders: { ...details.requestHeaders, "x-iv-token": token } });
	});
	// Zusätzlich als Cookie hinterlegen, damit auch einfache Navigationen
	// (z. B. direkte URL-Eingaben/Downloads) autorisiert sind.
	const url = new URL(hostUrl);
	void session.defaultSession.cookies.set({
		url: `${url.protocol}//${url.host}`,
		name: "iv_host_token",
		value: encodeURIComponent(token),
		httpOnly: true,
	});
}

async function connectToHost(): Promise<void> {
	const { clientHostUrl, clientToken } = settings.get();
	if (!clientHostUrl || !clientToken) {
		showShellPage();
		return;
	}

	registerClientTokenInjection(clientHostUrl, clientToken);
	setConnectionState({ mode: "client", hostUrl: clientHostUrl, connected: false, lastError: null });

	const win = getOrCreateWindow();
	try {
		await win.loadURL(clientHostUrl);
		setConnectionState({ connected: true, lastError: null });
	} catch (error) {
		log.error("Verbindung zum Host fehlgeschlagen", error);
		setConnectionState({ connected: false, lastError: error instanceof Error ? error.message : String(error) });
		showShellPage();
	}
}

// ------------------------------------------------------------
// Boot-Orchestrierung
// ------------------------------------------------------------

async function boot(): Promise<void> {
	// Erststart (noch kein Modus gewählt): Die Modus-Auswahl ist Teil des
	// Setup-Wizards (/setup, Schritt nach der Begrüßung). Bis zur Wahl läuft
	// der eingebettete Server im lokalen Modus, ohne dass settings.mode
	// persistiert wird - der Wizard übernimmt die Wahl über iv:set-mode
	// (bei "client" wechselt die App auf die Shell-Seite für die Verbindung).
	const effectiveMode = settings.get().mode ?? "local";
	setConnectionState({ mode: effectiveMode });

	if (effectiveMode === "client") {
		await connectToHost();
		return;
	}

	// local | host
	if (isDev) {
		// Entwicklung: `next dev` läuft separat (npm run electron:dev).
		const devUrl = process.env.IV_DEV_SERVER_URL ?? "http://127.0.0.1:3000";
		setConnectionState({ mode: effectiveMode, localUrl: devUrl, connected: true });
		const win = getOrCreateWindow();
		// Dev-Server kann noch hochfahren - bei Fehler kurz warten und erneut versuchen.
		win.webContents.on("did-fail-load", (_event, _code, _desc, validatedURL) => {
			if (validatedURL.startsWith(devUrl)) {
				setTimeout(() => {
					if (!win.isDestroyed()) void win.loadURL(devUrl);
				}, 1000);
			}
		});
		await win.loadURL(devUrl).catch(() => {});
		return;
	}

	await startLocalServer(effectiveMode);
}

// ------------------------------------------------------------
// IPC
// ------------------------------------------------------------

function registerIpcHandlers(): void {
	// --- Backup-Dateidialoge (genutzt von der Einstellungen-Seite der App) ---
	ipcMain.handle("iv:choose-backup-save-path", async (_event, defaultFileName: string) => {
		const win = getOrCreateWindow();
		const result = await dialog.showSaveDialog(win, {
			title: "Backup speichern",
			defaultPath: defaultFileName,
			filters: [{ name: "Sicherung (.zip/.imbak)", extensions: ["zip", "imbak"] }],
		});
		return result.canceled ? null : result.filePath;
	});

	ipcMain.handle("iv:choose-backup-open-path", async () => {
		const win = getOrCreateWindow();
		const result = await dialog.showOpenDialog(win, {
			title: "Backup auswählen",
			properties: ["openFile"],
			filters: [
				{ name: "Sicherung (.zip/.imbak)", extensions: ["zip", "imbak"] },
				{ name: "Alle Dateien", extensions: ["*"] },
			],
		});
		return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
	});

	// --- App-/Verbindungsinfo ---
	ipcMain.handle("iv:get-app-version", () => app.getVersion());

	// --- Auto-Update (Statusabfrage + sofortige Installation, siehe updater.ts) ---
	ipcMain.handle("iv:get-update-state", () => getUpdateState());
	ipcMain.handle("iv:install-update", () => installUpdateNow());
	ipcMain.handle("iv:get-connection-info", () => ({ ...connectionState, platform: process.platform }));
	ipcMain.handle("iv:open-connection-settings", () => showShellPage());

	// --- Shell-Seite (Setup/Client-Verbindung) ---
	ipcMain.handle("iv:shell-get-state", () => {
		// LAN-Adressen des Hosts für die Anzeige im Host-Modus (Clients tragen
		// diese Adresse + Port + Token ein bzw. wählen den gefundenen Dienst).
		const lanAddresses: string[] = [];
		for (const infos of Object.values(os.networkInterfaces())) {
			for (const info of infos ?? []) {
				if (!info.internal && info.family === "IPv4") lanAddresses.push(info.address);
			}
		}
		return {
			settings: settings.get(),
			connection: { ...connectionState },
			discovered: discoveredHosts,
			lanAddresses,
			appVersion: app.getVersion(),
			platform: process.platform,
		};
	});

	// Modus übernehmen und persistieren. Wird sowohl vom Setup-Wizard
	// (Erststart, Schritt "Betriebsmodus") als auch von der Shell-Seite
	// (Einstellungen -> Verbindung) genutzt. Idempotent: Läuft der Server
	// bereits im gewünschten Modus, wird er nicht neu gestartet und das
	// Fenster nicht neu geladen (Client-State bleibt erhalten).
	ipcMain.handle("iv:set-mode", async (_event, mode: AppMode) => {
		settings.update({ mode });

		if (mode === "client") {
			// Client-Modus = keine lokalen Daten: lokalen Server und ggf.
			// Host-Freigabe stoppen; die Verbindung zum Host wird über die
			// Shell-Seite hergestellt (Discovery, URL + Token).
			if (runningServer) {
				await runningServer.close();
				runningServer = null;
			}
			if (unpublishHost) {
				unpublishHost();
				unpublishHost = null;
			}
			setConnectionState({ mode, localUrl: null, hostUrl: null, hostPort: null, connected: false, lastError: null });
			showShellPage();
			return { ok: true };
		}

		// local | host
		try {
			if (isDev) {
				// Entwicklung: `next dev` läuft separat (npm run electron:dev).
				const devUrl = process.env.IV_DEV_SERVER_URL ?? "http://127.0.0.1:3000";
				setConnectionState({ mode, localUrl: devUrl, connected: true, lastError: null });
				await loadAppUrlIfNeeded(devUrl);
				return { ok: true };
			}
			if (!runningServer || connectionState.mode !== mode) {
				await startLocalServer(mode);
			} else {
				setConnectionState({ lastError: null });
			}
			return { ok: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setConnectionState({ connected: false, lastError: message });
			return { ok: false, error: message };
		}
	});

	ipcMain.handle("iv:shell-set-client-connection", async (_event, hostUrl: string, token: string) => {
		const normalized = hostUrl.trim().replace(/\/$/, "");
		if (!/^https?:\/\//.test(normalized)) {
			return { ok: false, error: "Bitte eine vollständige URL angeben (z. B. http://192.168.1.10:38300)." };
		}
		settings.update({ clientHostUrl: normalized, clientToken: token.trim() });
		await connectToHost();
		return connectionState.connected ? { ok: true } : { ok: false, error: connectionState.lastError ?? "Verbindung fehlgeschlagen." };
	});

	ipcMain.handle("iv:shell-retry", async () => {
		try {
			await boot();
			return { ok: connectionState.connected };
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	});

	ipcMain.handle("iv:shell-regenerate-host-token", () => {
		const hostToken = generateHostToken();
		settings.update({ hostToken });
		return hostToken;
	});

	ipcMain.handle("iv:shell-back-to-app", async () => {
		// Zurück zur App-Oberfläche, OHNE Moduswechsel/Server-Neustart - die
		// Shell-Seite ist sonst eine Sackgasse (nur erreichbar über "Modus
		// übernehmen", der den eingebetteten Server jedesmal neu startet).
		const url = connectionState.mode === "client" ? connectionState.hostUrl : connectionState.localUrl;
		if (!connectionState.connected || !url) {
			return { ok: false, error: "Keine aktive Verbindung - bitte zuerst einen Modus übernehmen oder verbinden." };
		}
		try {
			const win = getOrCreateWindow();
			await win.loadURL(url);
			return { ok: true };
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	});

	// --- mDNS-Discovery (Client) ---
	ipcMain.handle("iv:discovery-start", (event) => {
		if (discoveryActive) return;
		discoveryActive = true;
		discoveredHosts = [];
		const sender = event.sender;
		startDiscovery(
			(host) => {
				const key = `${host.name}|${host.port}|${host.addresses.join(",")}`;
				if (!discoveredHosts.some((h) => `${h.name}|${h.port}|${h.addresses.join(",")}` === key)) {
					discoveredHosts.push(host);
					if (!sender.isDestroyed()) sender.send("iv:service-up", host);
				}
			},
			(host) => {
				discoveredHosts = discoveredHosts.filter((h) => !(h.name === host.name && h.port === host.port));
				if (!sender.isDestroyed()) sender.send("iv:service-down", host);
			}
		);
	});
	ipcMain.handle("iv:discovery-stop", () => {
		discoveryActive = false;
		destroyDiscovery();
	});
}

// ------------------------------------------------------------
// App-Lifecycle
// ------------------------------------------------------------

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		const win = getOrCreateWindow();
		if (win.isMinimized()) win.restore();
		win.focus();
	});

	void app.whenReady().then(async () => {
		const userData = app.getPath("userData");
		fs.mkdirSync(path.join(userData, "logs"), { recursive: true });
		initMainLog(path.join(userData, "logs"));
		settings = new SettingsStore(userData);
		registerIpcHandlers();

		// Netzlaufwerk-Schutz: Die SQLite-DB darf niemals auf SMB/NFS liegen
		// (unzuverlässige Locks, WAL braucht Shared Memory) - sonst droht
		// Datenkorruption. Daher: klar erklären und abbrechen.
		const check = await checkDataDirNotOnNetworkDrive(userData);
		if (!check.ok) {
			dialog.showMessageBoxSync({
				type: "error",
				title: "Datenverzeichnis auf Netzlaufwerk",
				message: "Das Datenverzeichnis liegt auf einem Netzlaufwerk - der Start wird abgebrochen.",
				detail:
					`${check.reason ?? ""}\n\n` +
					"SQLite-Datenbanken dürfen nicht auf Netzlaufwerken (SMB/NFS) betrieben werden: Die Datei-Sperrmechanismen " +
					"funktionieren dort nicht zuverlässig und die Datenbank würde dadurch beschädigt.\n\n" +
					"Für den Mehrbenutzer-Betrieb starten Sie die App bitte auf einem Rechner im Modus \"Host\" " +
					"(Einstellungen -> Verbindung) - die anderen Arbeitsplätze verbinden sich dann als \"Client\" über das Netzwerk.",
			});
			app.quit();
			return;
		}

		try {
			await boot();
		} catch (error) {
			log.error("Start des eingebetteten Servers fehlgeschlagen", error);
			dialog.showMessageBoxSync({
				type: "error",
				title: "Startfehler",
				message: "Der lokale Server konnte nicht gestartet werden.",
				detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
			});
			app.quit();
			return;
		}

		void checkForUpdatesQuietly();
	});

	app.on("window-all-closed", () => {
		// Auf macOS bleibt die App üblicherweise ohne Fenster aktiv.
		if (process.platform !== "darwin") app.quit();
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) void boot();
	});

	app.on("will-quit", () => {
		destroyDiscovery();
		if (unpublishHost) unpublishHost();
		if (runningServer) void runningServer.close();
	});
}
