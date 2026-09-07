import { app } from "electron";

import { log } from "./log";

/**
 * Auto-Updates via electron-updater (GitHub-Releases-Provider, konfiguriert
 * über electron-builder.yml -> publish). Vollständig offline-tolerant: Ist
 * kein Netz verfügbar, schlägt die Prüfung still fehl (nur Logeintrag).
 */

export async function checkForUpdatesQuietly(): Promise<void> {
	// Nur in der gepackten App prüfen (im Dev-Modus gibt es kein app-update.yml).
	if (!app.isPackaged) return;
	try {
		const { autoUpdater } = await import("electron-updater");
		autoUpdater.autoDownload = true;
		autoUpdater.autoInstallOnAppQuit = true;
		// electron-updater erwartet einen Logger mit info/warn/error/debug.
		autoUpdater.logger = { ...log, debug: log.info };
		autoUpdater.on("error", (error) => {
			// Offline / kein Release vorhanden / Signaturprobleme - alles nur
			// protokollieren, nie die App stören.
			log.warn(`Update-Prüfung fehlgeschlagen (offline oder nicht konfiguriert): ${error.message}`);
		});
		autoUpdater.on("update-downloaded", (info) => {
			log.info(`Update ${info.version} heruntergeladen - wird beim nächsten Start installiert.`);
		});
		await autoUpdater.checkForUpdates();
	} catch (error) {
		log.warn(`Update-Prüfung nicht möglich: ${error instanceof Error ? error.message : String(error)}`);
	}
}
