import fs from "node:fs";
import path from "node:path";

/**
 * Minimalistisches Datei-Logging für den Electron-Main-Prozess:
 * Append-Log unter <userData>/logs/main.log, bei ~2 MB wird die Datei
 * gekappt (erste Hälfte wird verworfen). Bewusst ohne externe Abhängigkeit
 * (kein electron-log) - die Anforderungen (Diagnose, Offline) sind simpel.
 */

let logFile: string | null = null;

export function initMainLog(logsDir: string): void {
	fs.mkdirSync(logsDir, { recursive: true });
	logFile = path.join(logsDir, "main.log");
	writeLine("info", `--- App-Start ${new Date().toISOString()} ---`);
}

function writeLine(level: "info" | "warn" | "error", message: string): void {
	const line = `${new Date().toISOString()} [${level}] ${message}\n`;
	if (logFile) {
		try {
			const stats = fs.existsSync(logFile) ? fs.statSync(logFile) : null;
			if (stats && stats.size > 2 * 1024 * 1024) {
				// Kappung: Datei auf die zweite Hälfte reduzieren.
				const content = fs.readFileSync(logFile, "utf8");
				fs.writeFileSync(logFile, content.slice(content.length / 2), "utf8");
			}
			fs.appendFileSync(logFile, line, "utf8");
		} catch {
			// Logging darf nie die App abstürzen lassen.
		}
	}
	if (level === "error") console.error(message);
	else console.log(message);
}

export const log = {
	info: (message: string): void => writeLine("info", message),
	warn: (message: string): void => writeLine("warn", message),
	error: (message: string, error?: unknown): void =>
		writeLine("error", error instanceof Error ? `${message}: ${error.message}\n${error.stack ?? ""}` : message),
};
