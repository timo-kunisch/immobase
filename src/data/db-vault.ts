import fs from "node:fs";
import path from "node:path";

import { decryptFileToFileSync, encryptFileToFileSync } from "@/lib/file-crypto";

/**
 * Container-Verschlüsselung der SQLite-Datenbankdatei at rest.
 *
 * Zustandsautomat (Dateien im Datenverzeichnis):
 * - Ruhezustand (App beendet): nur `data.db.enc` (AES-256-GCM-Container,
 *   Format siehe src/lib/file-crypto.ts) - kein Klartext vorhanden.
 * - Laufzeit: nur `data.db` (+ `data.db-wal`/`data.db-shm`) im Klartext;
 *   kein Container vorhanden (wird beim Entsperren nach erfolgreicher
 *   Entschlüsselung gelöscht).
 *
 * Abläufe:
 * - unlockDatabaseIfNeeded(): vor dem Öffnen der DB (src/data/db.ts,
 *   getDb). Entschlüsselt den Container atomar (Temp-Datei + rename) und
 *   entfernt ihn danach. Wirft einen klaren Fehler, wenn die Datei nicht
 *   entschlüsselbar ist (falscher/verlorener Schlüssel, Beschädigung) -
 *   es wird NIEMALS still mit einer leeren/frischen Datenbank gestartet
 *   (Datenverlust-Schutz).
 * - lockDatabaseIfNeeded(): beim sauberen Beenden (Shutdown-Hooks in
 *   src/data/db.ts, nach WAL-Checkpoint + close). Schreibt den Container
 *   atomar und löscht erst danach die Klartext-Dateien - schlägt die
 *   Verschlüsselung fehl, bleibt der Klartext erhalten (lieber ein
 *   Klartext-Rest als Datenverlust).
 *
 * Crash-Konsistenz: Alle Schreibvorgänge sind atomar (Temp + rename).
 * Existieren nach einem Absturz BEIDE Dateien (Crash genau zwischen
 * Container-Schreiben und Klartext-Löschen bzw. zwischen rename und
 * Container-Löschung), sind sie inhaltlich identisch - der Klartext
 * gewinnt dann (entspricht dem jeweils vollständig geschriebenen Stand),
 * der Container wird verworfen. Verwaiste Temp-Dateien werden beim
 * Entsperren aufgeräumt.
 *
 * Einschränkung (bewusst gewähltes Design): Während der Laufzeit und nach
 * einem nicht sauberen Beenden (Kill/Stromausfall) liegt die DB im
 * Klartext vor - der vollständige Schutz gilt im Ruhezustand.
 */

const ENCRYPTED_SUFFIX = ".enc";
const WAL_SUFFIXES = ["-wal", "-shm"];

/** Pfad des verschlüsselten Containers zur angegebenen DB-Datei. */
export function getEncryptedDatabasePath(dbFilePath: string): string {
	return `${dbFilePath}${ENCRYPTED_SUFFIX}`;
}

/** Entfernt verwaiste Temp-Dateien früherer, abgebrochener Lock/Unlock-Läufe. */
function cleanupStaleTempFiles(dbFilePath: string): void {
	const dir = path.dirname(dbFilePath);
	const base = path.basename(dbFilePath);
	for (const candidate of fs.readdirSync(dir)) {
		// Muster: "data.db.enc.enc-<uuid>.tmp" (Lock) und "data.db.dec-<uuid>.tmp" (Unlock).
		const isLockTemp = candidate.startsWith(`${base}${ENCRYPTED_SUFFIX}.enc-`) && candidate.endsWith(".tmp");
		const isUnlockTemp = candidate.startsWith(`${base}.dec-`) && candidate.endsWith(".tmp");
		if (isLockTemp || isUnlockTemp) {
			try {
				fs.rmSync(path.join(dir, candidate), { force: true });
			} catch {
				// Best effort.
			}
		}
	}
}

/**
 * Entschlüsselt `data.db.enc` nach `data.db`, falls der Container existiert.
 * No-Op, wenn nur die Klartext-DB existiert (Neuinstallation oder vorheriger
 * nicht sauber beendeter Lauf). Wirft einen Fehler, wenn der Container nicht
 * entschlüsselbar ist (kein stiller Neustart mit leerer DB!).
 */
export function unlockDatabaseIfNeeded(dbFilePath: string): void {
	const encPath = getEncryptedDatabasePath(dbFilePath);
	if (!fs.existsSync(encPath)) return;

	cleanupStaleTempFiles(dbFilePath);

	if (fs.existsSync(dbFilePath)) {
		// Beide Dateien vorhanden: kann nur durch Absturz zwischen atomaren
		// Schritten entstehen - beide Stände sind dann identisch (siehe
		// Dateikopf). Der Klartext gewinnt, der Container wird verworfen.
		console.warn(
			"Datenbank: Container und Klartext-Datei existieren beide (vorheriger Lauf nicht sauber beendet). " +
				"Der Klartext-Stand wird verwendet, der veraltete Container verworfen."
		);
		fs.rmSync(encPath, { force: true });
		return;
	}

	try {
		decryptFileToFileSync(encPath, dbFilePath);
	} catch (error) {
		throw new Error(
			"Die verschlüsselte Datenbank konnte nicht entschlüsselt werden (falscher/verlorener Datenschlüssel " +
				"oder beschädigte Datei). Es wird bewusst NICHT mit einer leeren Datenbank gestartet. " +
				`Ursache: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		);
	}

	// Container erst NACH erfolgreicher Entschlüsselung löschen.
	fs.rmSync(encPath, { force: true });
}

/**
 * Verschlüsselt `data.db` nach `data.db.enc` und entfernt danach die
 * Klartext-Dateien (inkl. WAL/SHM). Voraussetzung: Die Verbindung wurde
 * geschlossen und ein WAL-Checkpoint lief (src/data/db.ts,
 * sealDatabaseForShutdown). No-Op, wenn keine Klartext-DB existiert.
 * Bei Fehlern bleibt der Klartext erhalten (kein Datenverlust) - der Fehler
 * wird geloggt, nicht geworfen (Shutdown-Kontext).
 */
export function lockDatabaseIfNeeded(dbFilePath: string): void {
	const encPath = getEncryptedDatabasePath(dbFilePath);
	if (!fs.existsSync(dbFilePath)) return;

	try {
		// Veralteten Container entfernen (sollte zur Laufzeit nicht existieren).
		if (fs.existsSync(encPath)) fs.rmSync(encPath, { force: true });

		encryptFileToFileSync(dbFilePath, encPath);

		// Klartext erst NACH erfolgreichem Container-Write löschen.
		fs.rmSync(dbFilePath, { force: true });
		for (const suffix of WAL_SUFFIXES) {
			if (fs.existsSync(dbFilePath + suffix)) fs.rmSync(dbFilePath + suffix, { force: true });
		}
	} catch (error) {
		console.error(
			"Datenbank konnte beim Beenden nicht verschlüsselt werden - die Klartext-Datei bleibt erhalten. " +
				"Beim nächsten Start wird sie normal weiterverwendet.",
			error
		);
	}
}
