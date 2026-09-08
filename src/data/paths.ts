import fs from "node:fs";
import path from "node:path";

/**
 * Zentrale Pfad-Auflösung für alle App-Daten (SQLite-DB, Upload-Dateien). Die Desktop-App (Electron-Main-Prozess) setzt vor dem Start des
 * Next.js-Servers die Umgebungsvariable APP_DATA_DIR auf
 * `app.getPath("userData")`. Für die reine Web-Entwicklung (`next dev` ohne
 * Electron) und für Tests fällt die Auflösung auf `<Projekt>/data-dev`
 * (gitignoriert) bzw. auf das in APP_DATA_DIR übergebene Test-Verzeichnis
 * zurück.
 *
 * WICHTIG: Diese Funktion liest die Env-Variable bei jedem Aufruf neu aus,
 * damit Tests (vitest) sie per `process.env.APP_DATA_DIR = ...` +
 * `closeDb()` zwischen den Testfällen umschalten können.
 *
 * Zugriffsrechte: Alle Datenverzeichnisse werden restriktiv (0700 - nur der
 * eigene OS-Benutzer) angelegt bzw. best effort darauf gehärtet; auf
 * Dateisystemen ohne POSIX-Rechte (Windows) ist das ein No-Op.
 */
function ensurePrivateDir(dir: string): string {
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	try {
		fs.chmodSync(dir, 0o700);
	} catch {
		// Best effort (z. B. Windows-Dateisysteme kennen keine POSIX-Rechte).
	}
	return dir;
}

export function getDataDir(): string {
	const fromEnv = process.env.APP_DATA_DIR?.trim();
	const dir = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(process.cwd(), "data-dev");
	return ensurePrivateDir(dir);
}

/** Pfad zur SQLite-Datenbankdatei. */
export function getDatabaseFilePath(): string {
	return path.join(getDataDir(), "data.db");
}

/** Wurzelverzeichnis der hochgeladenen/generierten Dateien. */
export function getFilesDir(): string {
	return ensurePrivateDir(path.join(getDataDir(), "files"));
}
