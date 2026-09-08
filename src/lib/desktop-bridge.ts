/**
 * Typisierte Brücke zur Electron-Shell (`window.iv`, bereitgestellt vom
 * Preload-Skript electron/preload/index.ts). In der reinen Browser-
 * Entwicklung (`next dev` ohne Electron) ist die Brücke `undefined` - alle
 * Aufrufer müssen defensiv damit umgehen (Feature-Detection).
 */

export interface DesktopConnectionInfo {
	mode: "local" | "host" | "client";
	/** Lokale Server-URL (Modi local/host), z. B. http://127.0.0.1:38471. */
	localUrl: string | null;
	/** Host-URL (Modus client). */
	hostUrl: string | null;
	connected: boolean;
	port: number | null;
}

/** Spiegel von UpdateState aus electron/main/updater.ts. */
export interface DesktopUpdateState {
	status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
	/** Version des gefundenen bzw. geladenen Updates (sonst null). */
	version: string | null;
	/** Download-Fortschritt in Prozent (nur bei Status "downloading"). */
	percent: number | null;
}

export interface DesktopBridge {
	isDesktop: true;
	platform: NodeJS.Platform;
	/** Öffnet einen Speichern-Dialog; null bei Abbruch. */
	chooseBackupSavePath(defaultFileName: string): Promise<string | null>;
	/** Öffnet einen Datei-Öffnen-Dialog (ZIP); null bei Abbruch. */
	chooseBackupOpenPath(): Promise<string | null>;
	getConnectionInfo(): Promise<DesktopConnectionInfo>;
	/** Abonniert Verbindungsstatus-Änderungen; Rückgabewert: Unsubscribe. */
	onConnectionState(listener: (info: DesktopConnectionInfo) => void): () => void;
	/** Öffnet den Verbindungs-/Modus-Einstellungsdialog der Shell. */
	openConnectionSettings(): Promise<void>;
	/**
	 * Übernimmt den Betriebsmodus (Setup-Wizard + Shell-Seite). Idempotent:
	 * Ein bereits aktiver Modus startet den Server nicht neu. Bei "client"
	 * wechselt das Fenster auf die Verbindungsseite der Shell.
	 */
	setMode(mode: "local" | "host" | "client"): Promise<{ ok: boolean; error?: string }>;
	/** Blendet das Fenster ein/aus (für spätere Tray-Features reserviert). */
	getAppVersion(): Promise<string>;
	/** Aktueller Auto-Update-Status (nur gepackte Desktop-App, sonst "idle"). */
	getUpdateState(): Promise<DesktopUpdateState>;
	/** Abonniert Update-Status-Änderungen; Rückgabewert: Unsubscribe. */
	onUpdateState(listener: (state: DesktopUpdateState) => void): () => void;
	/** Installiert ein bereits geladenes Update sofort (beendet die App). */
	installUpdateNow(): Promise<void>;
}

declare global {
	interface Window {
		iv?: DesktopBridge;
	}
}

/** Liefert die Desktop-Brücke, oder null im reinen Browser-Kontext. */
export function getDesktopBridge(): DesktopBridge | null {
	if (typeof window === "undefined") return null;
	return window.iv ?? null;
}
