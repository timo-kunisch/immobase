import fs from "node:fs";
import path from "node:path";

/**
 * Zentrale Pfad-Auflösung für alle App-Daten (SQLite-DB, Upload-Dateien,
 * Logs). Die Desktop-App (Electron-Main-Prozess) setzt vor dem Start des
 * Next.js-Servers die Umgebungsvariable APP_DATA_DIR auf
 * `app.getPath("userData")`. Für die reine Web-Entwicklung (`next dev` ohne
 * Electron) und für Tests fällt die Auflösung auf `<Projekt>/data-dev`
 * (gitignoriert) bzw. auf das in APP_DATA_DIR übergebene Test-Verzeichnis
 * zurück.
 *
 * WICHTIG: Diese Funktion liest die Env-Variable bei jedem Aufruf neu aus,
 * damit Tests (vitest) sie per `process.env.APP_DATA_DIR = ...` +
 * `closeDb()` zwischen den Testfällen umschalten können.
 */
export function getDataDir(): string {
	const fromEnv = process.env.APP_DATA_DIR?.trim();
	const dir = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(process.cwd(), "data-dev");
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/** Pfad zur SQLite-Datenbankdatei. */
export function getDatabaseFilePath(): string {
	return path.join(getDataDir(), "data.db");
}

/** Wurzelverzeichnis der hochgeladenen/generierten Dateien. */
export function getFilesDir(): string {
	const dir = path.join(getDataDir(), "files");
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/** Verzeichnis für Log-Dateien (Main-Log, E-Mail-Outbox, ...). */
export function getLogsDir(): string {
	const dir = path.join(getDataDir(), "logs");
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}
