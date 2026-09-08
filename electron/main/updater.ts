import { app, BrowserWindow } from "electron";

import { log } from "./log";

/**
 * Auto-Updates via electron-updater (GitHub-Releases-Provider, konfiguriert
 * über electron-builder.yml -> publish). Vollständig offline-tolerant: Ist
 * kein Netz verfügbar, schlägt die Prüfung still fehl (nur Logeintrag).
 *
 * Der Update-Status wird zusätzlich per IPC ("iv:update-state") an alle
 * Fenster gesendet, damit die App-Oberfläche einen Hinweis einblenden kann
 * (src/components/layout/update-banner.tsx). Fehler werden bewusst NICHT im
 * UI angezeigt - die App ist offline-first, eine fehlgeschlagene
 * Update-Prüfung ist kein meldenswertes Problem.
 */

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";

export interface UpdateState {
	status: UpdateStatus;
	/** Version des gefundenen bzw. geladenen Updates (sonst null). */
	version: string | null;
	/** Download-Fortschritt in Prozent, gerundet (nur bei Status "downloading"). */
	percent: number | null;
}

const updateState: UpdateState = { status: "idle", version: null, percent: null };

function setUpdateState(patch: Partial<UpdateState>): void {
	Object.assign(updateState, patch);
	for (const win of BrowserWindow.getAllWindows()) {
		if (!win.isDestroyed()) win.webContents.send("iv:update-state", { ...updateState });
	}
}

export function getUpdateState(): UpdateState {
	return { ...updateState };
}

// electron-updater wird erst zur Laufzeit dynamisch importiert (nur in der
// gepackten App sinnvoll); installUpdateNow() braucht die Referenz erneut.
let autoUpdaterRef: typeof import("electron-updater").autoUpdater | null = null;

/**
 * Beendet die App und installiert das bereits geladene Update sofort
 * (Alternative zum automatischen Installieren beim nächsten regulären
 * Start, siehe autoInstallOnAppQuit).
 */
export function installUpdateNow(): void {
	if (!autoUpdaterRef || updateState.status !== "downloaded") return;
	autoUpdaterRef.quitAndInstall();
}

export async function checkForUpdatesQuietly(): Promise<void> {
	// Nur in der gepackten App prüfen (im Dev-Modus gibt es kein app-update.yml).
	if (!app.isPackaged) return;
	try {
		const { autoUpdater } = await import("electron-updater");
		// Defensiv: electron-updater liefert `autoUpdater` über einen Lazy-Getter
		// (doLoadAutoUpdater() in out/main.js). Schlägt die Erzeugung der
		// plattformspezifischen Updater-Instanz fehl (z. B. MacUpdater ohne
		// gültige Codesignatur - bei --dir-Builds mit untrusted-Identität
		// regelmäßig der Fall), bleibt der geteilte `_autoUpdater`-Zustand
		// undefiniert und der erste Zugriff wirft
		// "Cannot set properties of undefined (setting 'autoDownload')".
		// Das ist kein Behandlungsfehler der App, sondern ein Hinweis darauf,
		// dass Auto-Updates in dieser Umgebung nicht möglich sind - also
		// verständlich protokollieren und überspringen (statt Exception).
		if (!autoUpdater) {
			log.warn("Update-Prüfung übersprungen: autoUpdater ist nicht verfügbar (z. B. ungültige/fehlende Codesignatur auf macOS).");
			return;
		}
		autoUpdaterRef = autoUpdater;
		autoUpdater.autoDownload = true;
		autoUpdater.autoInstallOnAppQuit = true;
		// Semver-Prereleases (z. B. 1.0.0-alpha) ebenfalls als Update-Kandidaten
		// zulassen, solange sich die App selbst in der Alpha-/Beta-Phase befindet.
		autoUpdater.allowPrerelease = true;
		// electron-updater erwartet einen Logger mit info/warn/error/debug.
		autoUpdater.logger = { ...log, debug: log.info };
		autoUpdater.on("error", (error) => {
			// Offline / kein Release vorhanden / Signaturprobleme - alles nur
			// protokollieren, nie die App stören (UI bleibt bewusst ohne Hinweis).
			setUpdateState({ status: "error", version: null, percent: null });
			log.warn(`Update-Prüfung fehlgeschlagen (offline oder nicht konfiguriert): ${error.message}`);
		});
		autoUpdater.on("update-available", (info) => {
			setUpdateState({ status: "available", version: info.version, percent: null });
			log.info(`Update ${info.version} verfügbar - Download gestartet.`);
		});
		autoUpdater.on("update-not-available", () => {
			setUpdateState({ status: "idle", version: null, percent: null });
		});
		autoUpdater.on("download-progress", (progress) => {
			setUpdateState({ status: "downloading", percent: Math.round(progress.percent) });
		});
		autoUpdater.on("update-downloaded", (info) => {
			setUpdateState({ status: "downloaded", version: info.version, percent: null });
			log.info(`Update ${info.version} heruntergeladen - wird beim nächsten Start installiert.`);
		});
		setUpdateState({ status: "checking" });
		await autoUpdater.checkForUpdates();
	} catch (error) {
		setUpdateState({ status: "error", version: null, percent: null });
		log.warn(`Update-Prüfung nicht möglich: ${error instanceof Error ? error.message : String(error)}`);
	}
}
