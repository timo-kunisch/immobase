import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload-Skript: schmale, explizite Brücke zwischen Renderer (Next.js-App
 * bzw. Shell-Seite) und Main-Prozess. Läuft mit contextIsolation/sandbox -
 * KEIN Node-/Electron-API-Zugriff für den Renderer außerhalb dieser Liste.
 *
 * Die Typen für die App-Seite liegen in src/lib/desktop-bridge.ts
 * (window.iv); die Shell-Seite nutzt zusätzlich die shell_*-Methoden.
 */

export interface IvBridge {
	isDesktop: true;
	platform: NodeJS.Platform;

	// App-Seite (Backup + Verbindungsinfo)
	chooseBackupSavePath(defaultFileName: string): Promise<string | null>;
	chooseBackupOpenPath(): Promise<string | null>;
	getConnectionInfo(): Promise<unknown>;
	onConnectionState(listener: (info: unknown) => void): () => void;
	openConnectionSettings(): Promise<void>;
	getAppVersion(): Promise<string>;

	// Shell-Seite (Setup/Client-Verbindung)
	shellGetState(): Promise<unknown>;
	shellSetMode(mode: "local" | "host" | "client"): Promise<{ ok: boolean; error?: string }>;
	shellSetClientConnection(hostUrl: string, token: string): Promise<{ ok: boolean; error?: string }>;
	shellRetry(): Promise<{ ok: boolean; error?: string }>;
	shellRegenerateHostToken(): Promise<string>;
	discoveryStart(): Promise<void>;
	discoveryStop(): Promise<void>;
	onServiceUp(listener: (host: unknown) => void): () => void;
	onServiceDown(listener: (host: unknown) => void): () => void;
}

const bridge: IvBridge = {
	isDesktop: true,
	platform: process.platform,

	chooseBackupSavePath: (defaultFileName) => ipcRenderer.invoke("iv:choose-backup-save-path", defaultFileName),
	chooseBackupOpenPath: () => ipcRenderer.invoke("iv:choose-backup-open-path"),
	getConnectionInfo: () => ipcRenderer.invoke("iv:get-connection-info"),
	onConnectionState: (listener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, info: unknown): void => listener(info);
		ipcRenderer.on("iv:connection-state", wrapped);
		return () => ipcRenderer.removeListener("iv:connection-state", wrapped);
	},
	openConnectionSettings: () => ipcRenderer.invoke("iv:open-connection-settings"),
	getAppVersion: () => ipcRenderer.invoke("iv:get-app-version"),

	shellGetState: () => ipcRenderer.invoke("iv:shell-get-state"),
	shellSetMode: (mode) => ipcRenderer.invoke("iv:shell-set-mode", mode),
	shellSetClientConnection: (hostUrl, token) => ipcRenderer.invoke("iv:shell-set-client-connection", hostUrl, token),
	shellRetry: () => ipcRenderer.invoke("iv:shell-retry"),
	shellRegenerateHostToken: () => ipcRenderer.invoke("iv:shell-regenerate-host-token"),
	discoveryStart: () => ipcRenderer.invoke("iv:discovery-start"),
	discoveryStop: () => ipcRenderer.invoke("iv:discovery-stop"),
	onServiceUp: (listener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, host: unknown): void => listener(host);
		ipcRenderer.on("iv:service-up", wrapped);
		return () => ipcRenderer.removeListener("iv:service-up", wrapped);
	},
	onServiceDown: (listener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, host: unknown): void => listener(host);
		ipcRenderer.on("iv:service-down", wrapped);
		return () => ipcRenderer.removeListener("iv:service-down", wrapped);
	},
};

contextBridge.exposeInMainWorld("iv", bridge);
