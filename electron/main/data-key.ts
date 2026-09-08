import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { safeStorage } from "electron";

import { log } from "./log";
import type { SettingsStore } from "./settings";

/**
 * Master-Schlüssel für die Datenverschlüsselung at rest (Dateien in files/,
 * Geheimnisse in app_settings - Umsetzung serverseitig in
 * src/lib/file-crypto.ts bzw. src/data/app-settings.ts).
 *
 * Der Main-Prozess ist die einzige Stelle mit Zugriff auf den OS-Schlüssel-
 * bund (Electron safeStorage: macOS Keychain, Windows DPAPI, Linux Secret
 * Service). Er hält den Schlüssel daher verschlüsselt in settings.json
 * (Feld `encryptedDataKey`) und übergibt ihn beim Start des eingebetteten
 * Next-Servers über die Umgebungsvariable IMMOBASE_DATA_KEY (in-process,
 * verlässt das Gerät nie).
 *
 * Speicherformate in settings.json:
 * - "safe:<base64>"  - mit safeStorage verschlüsselter Schlüssel (Normalfall)
 * - "plain:<base64>" - Fallback, wenn kein Schlüsselbund verfügbar ist
 *   (z. B. Linux ohne Secret Service): Der Schlüssel liegt dann nur durch
 *   die Dateirechte von settings.json (0600) geschützt vor - dokumentierte
 *   Einschränkung, Funktion bleibt erhalten.
 *
 * Datensicherheit: Kann der Schlüsselbund den gespeicherten Blob nicht mehr
 * entschlüsseln (z. B. nach Übertragen des Datenverzeichnisses auf ein
 * anderes Gerät/anderes OS-Konto), sind die verschlüsselten Dateien ohne
 * Sicherung NICHT wiederherstellbar. Der Start bricht dann mit einer klaren
 * Fehlermeldung ab; der dokumentierte Weg ist die Wiederherstellung aus einer
 * Datensicherung (Backups sind portierbar/Klartext bzw. .imbak-passwort-
 * geschützt) oder der in den Einstellungen einsehbare Wiederherstellungs-
 * schlüssel.
 */

const SAFE_PREFIX = "safe:";
const PLAIN_PREFIX = "plain:";
const KEY_LENGTH = 32; // AES-256

/** Marker für den Server-Prozess (src/lib/data-key.ts): Der Schlüssel wird
 * von der Desktop-App verwaltet - ohne Env-Übergabe darf keine eigene
 * Schlüsseldatei erzeugt werden (sonst wären alle Dateien unlesbar). */
const MANAGED_MARKER_NAME = ".data-key.managed";

/**
 * Liefert den Master-Schlüssel als Base64-String (für process.env.
 * IMMOBASE_DATA_KEY). Erzeugt ihn beim ersten Start und migriert den
 * plain-Fallback in den OS-Schlüsselbund, sobald dieser verfügbar ist.
 * Wirft einen verständlichen Fehler, wenn der gespeicherte Schlüssel nicht
 * mehr entschlüsselbar ist.
 */
export function getOrCreateDataKey(settings: SettingsStore, userDataDir: string): string {
	// Marker-Datei für den Server-Prozess ablegen (idempotent).
	try {
		const markerPath = path.join(userDataDir, MANAGED_MARKER_NAME);
		if (!fs.existsSync(markerPath)) {
			fs.writeFileSync(
				markerPath,
				"Der Datenschluessel dieses Datenverzeichnisses wird von der Desktop-App (settings.json, OS-Schluesselbund) verwaltet.\n",
				"utf8"
			);
		}
	} catch (error) {
		log.warn(`Marker-Datei für den Datenschlüssel konnte nicht geschrieben werden: ${error instanceof Error ? error.message : String(error)}`);
	}

	const stored = settings.get().encryptedDataKey;

	if (stored?.startsWith(SAFE_PREFIX)) {
		try {
			return safeStorage.decryptString(Buffer.from(stored.slice(SAFE_PREFIX.length), "base64"));
		} catch (error) {
			log.error("Datenschlüssel kann nicht entschlüsselt werden", error);
			throw new Error(
				"Der Datenschlüssel kann nicht aus dem Schlüsselbund des Betriebssystems entschlüsselt werden " +
					"(z. B. nach dem Übertragen des Datenverzeichnisses auf ein anderes Gerät oder Benutzerkonto). " +
					"Ohne diesen Schlüssel sind die verschlüsselten Dateien nicht lesbar. Stellen Sie die Daten aus einer " +
					"Datensicherung wieder her (Einstellungen -> Datensicherung) oder hinterlegen Sie den in den " +
					"Einstellungen einsehbaren Wiederherstellungsschlüssel auf dem ursprünglichen Gerät."
			);
		}
	}

	let keyBase64: string;
	if (stored?.startsWith(PLAIN_PREFIX)) {
		keyBase64 = stored.slice(PLAIN_PREFIX.length);
	} else if (stored) {
		// Unbekanntes Format - nicht still überschreiben (Datenverlust-Risiko).
		throw new Error("Der gespeicherte Datenschlüssel hat ein unbekanntes Format - Start abgebrochen.");
	} else {
		keyBase64 = randomBytes(KEY_LENGTH).toString("base64");
	}

	if (safeStorage.isEncryptionAvailable()) {
		settings.update({ encryptedDataKey: SAFE_PREFIX + safeStorage.encryptString(keyBase64).toString("base64") });
	} else {
		if (!stored) {
			log.warn(
				"Kein OS-Schlüsselbund verfügbar (safeStorage) - der Datenschlüssel liegt nur durch die Dateirechte " +
					"von settings.json geschützt vor."
			);
		}
		settings.update({ encryptedDataKey: PLAIN_PREFIX + keyBase64 });
	}
	return keyBase64;
}
