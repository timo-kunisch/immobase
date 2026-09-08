import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { getDataDir } from "@/data/paths";

/**
 * Gerätegebundener Master-Schlüssel (32 Bytes, AES-256) für die lokale
 * Datenverschlüsselung at rest (Dateien in `files/`, Geheimnisse in
 * `app_settings`). Siehe src/lib/file-crypto.ts und src/data/app-settings.ts.
 *
 * Herkunft des Schlüssels (Priorität):
 * 1. `process.env.IMMOBASE_DATA_KEY` (base64) - wird von der Desktop-App
 *    (Electron-Main-Prozess, electron/main/data-key.ts) VOR dem Start des
 *    Next-Servers gesetzt. Dort liegt der Schlüssel verschlüsselt im
 *    OS-Schlüsselbund (Electron safeStorage: macOS Keychain, Windows DPAPI,
 *    Linux Secret Service) und nur der verschlüsselte Blob in settings.json.
 * 2. Fallback für Browser-Entwicklung/Tests (kein Electron): Schlüsseldatei
 *    `<dataDir>/.data-key` (base64, Dateirechte 0600), wird beim ersten
 *    Zugriff automatisch erzeugt.
 *
 * Schutzrichtung: Die Verschlüsselung schützt die Daten bei Diebstahl/
 * Weitergabe der Daten-DATEIEN (Gerät, Backup-Medium, Cloud-Sync des
 * Datenverzeichnisses) und vor anderen OS-Benutzern. Sie schützt NICHT vor
 * einem Angreifer, der bereits im selben Benutzerkonto läuft, während die App
 * entsperrt ist - dafür bleibt die Festplattenverschlüsselung des Systems
 * (FileVault/BitLocker) die empfohlene Basis.
 *
 * Die Marker-Datei `<dataDir>/.data-key.managed` schreibt der Electron-Main-
 * Prozess: Sie signalisiert, dass der Schlüssel aus settings.json kommt. Legt
 * ein Server ohne Env-Schlüssel eine eigene Schlüsseldatei an, obwohl die
 * Daten mit dem verwalteten Schlüssel verschlüsselt wurden, wären alle
 * Dateien unlesbar - daher in dem Fall hart abbrechen statt still ein neues
 * Schlüsselpaar zu erzeugen.
 */

const ENV_NAME = "IMMOBASE_DATA_KEY";
const KEY_FILE_NAME = ".data-key";
const MANAGED_MARKER_NAME = ".data-key.managed";
const KEY_LENGTH = 32; // AES-256

export type DataKeySource = "system-keychain" | "key-file";

let cached: { cacheKey: string; key: Buffer; source: DataKeySource } | null = null;

function validateKey(key: Buffer, origin: string): Buffer {
	if (key.length !== KEY_LENGTH) {
		throw new Error(`Datenschlüssel aus ${origin} hat eine ungültige Länge (${key.length} Bytes, erwartet ${KEY_LENGTH}).`);
	}
	return key;
}

/**
 * Liefert den Master-Schlüssel (lazy, prozessweit gecacht). Der Cache ist an
 * die Schlüsselquelle gebunden, damit Tests das Datenverzeichnis per
 * APP_DATA_DIR wechseln können (analog zu closeDb() in src/data/db.ts).
 */
export function getDataKey(): Buffer {
	const envValue = process.env[ENV_NAME]?.trim();
	const cacheKey = envValue ? `env:${envValue}` : `dir:${getDataDir()}`;
	if (cached && cached.cacheKey === cacheKey) return cached.key;

	let key: Buffer;
	let source: DataKeySource;
	if (envValue) {
		key = validateKey(Buffer.from(envValue, "base64"), "Umgebungsvariable");
		source = "system-keychain";
	} else {
		const dataDir = getDataDir();
		const keyPath = path.join(dataDir, KEY_FILE_NAME);
		const managedMarker = path.join(dataDir, MANAGED_MARKER_NAME);
		if (!fs.existsSync(keyPath) && fs.existsSync(managedMarker)) {
			throw new Error(
				"Der Datenschlüssel wird von der Desktop-App verwaltet (OS-Schlüsselbund), wurde aber nicht an den " +
					"Server übergeben. Die App kann so nicht gestartet werden - bitte die Desktop-App verwenden."
			);
		}
		if (fs.existsSync(keyPath)) {
			key = validateKey(Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64"), "Schlüsseldatei");
		} else {
			key = randomBytes(KEY_LENGTH);
			fs.writeFileSync(keyPath, key.toString("base64"), { encoding: "utf8", mode: 0o600 });
			try {
				fs.chmodSync(keyPath, 0o600);
			} catch {
				// Best effort (z. B. Windows-Dateisysteme kennen keine POSIX-Rechte).
			}
		}
		source = "key-file";
	}

	cached = { cacheKey, key, source };
	return key;
}

/** Herkunft des Schlüssels (für die Statusanzeige in den Einstellungen). */
export function getDataKeySource(): DataKeySource {
	getDataKey(); // stellt sicher, dass der Cache gefüllt ist
	return cached!.source;
}

/** Master-Schlüssel als Base64-Text (Wiederherstellungsschlüssel, nur Admin-UI). */
export function getDataKeyBase64(): string {
	return getDataKey().toString("base64");
}
