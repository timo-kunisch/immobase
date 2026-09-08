import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getFilesDir } from "@/data/paths";
import { getDataKey } from "./data-key";

/**
 * Verschlüsselung der Ablagedateien at rest (AES-256-GCM, Schlüssel siehe
 * src/lib/data-key.ts). Genutzt von src/lib/storage.ts (Schreib-/Lesepfad),
 * src/data/backup.ts (Export entschlüsselt transparent, Import
 * re-verschlüsselt) und der Bestandsmigration.
 *
 * Container-Format (streaming-tauglich, nur node:crypto):
 * - Zeile 1: Magic "IMMOBASE-FILE-ENC:v1" (\n)
 * - 12 Bytes: GCM-Nonce (zufällig pro Datei)
 * - N Bytes: AES-256-GCM-Ciphertext (gleiche Länge wie der Klartext)
 * - letzte 16 Bytes: GCM-Auth-Tag (Integrität/Authentikation)
 *
 * Die Erkennung erfolgt ausschließlich über das Magic am Dateianfang - nicht
 * über die Sidecar-Metadaten. Dadurch sind Backups (Klartext im ZIP) und
 * ältere Klartext-Bestände ohne jede Zustandsverwaltung kompatibel: Der
 * Lesepfad kann jederzeit beide Formate verarbeiten.
 *
 * Seiteneffekt-Design wie bei den Backups: Der Auth-Tag liegt am DATEIENDE,
 * sodass beim Verschlüsseln durchgehend gestreamt werden kann und beim
 * Entschlüsseln der Ciphertext über start/end-Offsets gelesen wird (kein
 * Vollpuffer, Multi-GB-tauglich). Ein Manipulationsfehler fällt dabei erst am
 * Stream-Ende auf (GCM-Authentikationsfehler bricht den Download/den Export
 * hart ab statt still falsche Daten zu liefern).
 */

const MAGIC_LINE = "IMMOBASE-FILE-ENC:v1";
const HEADER_LENGTH = MAGIC_LINE.length + 1 + 12; // Magic + "\n" + Nonce
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

/** Sidecar-Metadaten werden bewusst NICHT verschlüsselt (nur Name/MIME-Type). */
const META_SUFFIX = ".meta.json";

// ------------------------------------------------------------
// Puffer-API (Uploads/generierte Dateien liegen ohnehin als Buffer vor)
// ------------------------------------------------------------

/** Verschlüsselt einen Puffer komplett (Container-Format siehe Dateikopf). */
export function encryptBuffer(plain: Buffer | Uint8Array): Buffer {
	const nonce = randomBytes(NONCE_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", getDataKey(), nonce);
	const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
	return Buffer.concat([Buffer.from(`${MAGIC_LINE}\n`, "utf8"), nonce, ciphertext, cipher.getAuthTag()]);
}

/** Entschlüsselt einen Container-Puffer. Wirft bei falschem Schlüssel/Manipulation. */
export function decryptBuffer(container: Buffer): Buffer {
	const magic = container.subarray(0, MAGIC_LINE.length + 1).toString("utf8");
	if (magic !== `${MAGIC_LINE}\n`) {
		throw new Error("Kein gültiger Verschlüsselungs-Container (Magic fehlt).");
	}
	const nonce = container.subarray(MAGIC_LINE.length + 1, HEADER_LENGTH);
	const tag = container.subarray(container.length - TAG_LENGTH);
	const ciphertext = container.subarray(HEADER_LENGTH, container.length - TAG_LENGTH);
	const decipher = createDecipheriv("aes-256-gcm", getDataKey(), nonce);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ------------------------------------------------------------
// Datei-API
// ------------------------------------------------------------

/** Prüft am Magic, ob eine Datei verschlüsselt ist (Klartext-Bestand: false). */
export function isEncryptedFile(absolutePath: string): boolean {
	let fd: number | null = null;
	try {
		fd = fs.openSync(absolutePath, "r");
		const buffer = Buffer.alloc(MAGIC_LINE.length + 1);
		const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
		return read === buffer.length && buffer.toString("utf8") === `${MAGIC_LINE}\n`;
	} catch {
		return false;
	} finally {
		if (fd !== null) fs.closeSync(fd);
	}
}

/**
 * Schreibt Daten verschlüsselt in die Zieldatei (atomar: Temp-Datei im
 * selben Verzeichnis + rename). Ersetzt das frühere direkte fs.writeFileSync
 * in src/lib/storage.ts.
 */
export function writeEncryptedFile(targetPath: string, data: Buffer | Uint8Array): void {
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	const tmpPath = `${targetPath}.enc-${crypto.randomUUID()}.tmp`;
	try {
		fs.writeFileSync(tmpPath, encryptBuffer(data), { mode: 0o600 });
		fs.renameSync(tmpPath, targetPath);
	} catch (error) {
		fs.rmSync(tmpPath, { force: true });
		throw error;
	}
}

interface ParsedFileContainer {
	nonce: Buffer;
	tag: Buffer;
	/** Offset des ersten Ciphertext-Bytes. */
	dataStart: number;
	/** Dateigröße abzüglich Auth-Tag (Ende des Ciphertexts, exklusiv). */
	dataEnd: number;
}

function parseFileContainer(absolutePath: string): ParsedFileContainer {
	const stat = fs.statSync(absolutePath);
	const fd = fs.openSync(absolutePath, "r");
	try {
		const head = Buffer.alloc(HEADER_LENGTH);
		const read = fs.readSync(fd, head, 0, head.length, 0);
		if (read < head.length || head.subarray(0, MAGIC_LINE.length + 1).toString("utf8") !== `${MAGIC_LINE}\n`) {
			throw new Error("Container-Magic fehlt.");
		}
		const dataEnd = stat.size - TAG_LENGTH;
		if (dataEnd <= HEADER_LENGTH) {
			throw new Error("Datei zu klein oder beschädigt.");
		}
		const nonce = Buffer.from(head.subarray(MAGIC_LINE.length + 1, HEADER_LENGTH));
		const tag = Buffer.alloc(TAG_LENGTH);
		fs.readSync(fd, tag, 0, TAG_LENGTH, dataEnd);
		return { nonce, tag, dataStart: HEADER_LENGTH, dataEnd };
	} finally {
		fs.closeSync(fd);
	}
}

/**
 * Liefert einen lesbaren Stream über den KLARTEXT der Datei - bei
 * verschlüsselten Dateien wird gestreamt entschlüsselt, bei Klartext-
 * Bestandsdateien ist es ein einfacher Read-Stream. Ein Integritätsfehler
 * (falscher Schlüssel, manipulierte Daten) äußert sich als "error"-Event am
 * Stream-Ende.
 */
export function createPlaintextReadStream(absolutePath: string): Readable {
	if (!isEncryptedFile(absolutePath)) {
		return fs.createReadStream(absolutePath);
	}
	const parsed = parseFileContainer(absolutePath);
	const decipher = createDecipheriv("aes-256-gcm", getDataKey(), parsed.nonce);
	decipher.setAuthTag(parsed.tag);
	// end ist inklusiv - daher dataEnd - 1 (dataEnd ist exklusiv).
	const body = fs.createReadStream(absolutePath, { start: parsed.dataStart, end: parsed.dataEnd - 1 });
	return body.pipe(decipher);
}

/**
 * SHA-256-Prüfsumme + Größe des KLARTEXTS (für das Backup-Manifest: Das
 * Backup-ZIP enthält aus Portabilitätsgründen immer Klartext, siehe
 * src/data/backup.ts - Prüfsumme und Größe müssen diesem entsprechen).
 */
export async function hashPlaintextFile(absolutePath: string): Promise<{ sha256: string; size: number }> {
	const hash = createHash("sha256");
	let size = 0;
	const stream = createPlaintextReadStream(absolutePath);
	// for await propagiert Stream-Fehler (z. B. GCM-Authentikationsfehler)
	// als Exception - eine korrupte Datei lässt den Export laut fehlschlagen.
	for await (const chunk of stream) {
		hash.update(chunk as Buffer);
		size += (chunk as Buffer).length;
	}
	return { sha256: hash.digest("hex"), size };
}

/** Liest eine Datei komplett und liefert den Klartext-Puffer (kleine Dateien, Tests). */
export async function readPlaintextFile(absolutePath: string): Promise<Buffer> {
	const chunks: Buffer[] = [];
	const stream = createPlaintextReadStream(absolutePath);
	for await (const chunk of stream) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks);
}

/**
 * Verschlüsselt eine einzelne Klartext-Datei atomar an Ort und Stelle
 * (Temp-Datei + rename). Bereits verschlüsselte Dateien und Sidecar-
 * Metadaten werden übersprungen. Gibt true zurück, wenn die Datei
 * verschlüsselt wurde.
 */
export async function encryptFileInPlace(absolutePath: string): Promise<boolean> {
	if (absolutePath.endsWith(META_SUFFIX)) return false;
	if (isEncryptedFile(absolutePath)) return false;

	const tmpPath = `${absolutePath}.enc-${crypto.randomUUID()}.tmp`;
	try {
		const nonce = randomBytes(NONCE_LENGTH);
		const cipher = createCipheriv("aes-256-gcm", getDataKey(), nonce);
		const output = fs.createWriteStream(tmpPath, { mode: 0o600 });
		output.write(Buffer.from(`${MAGIC_LINE}\n`, "utf8"));
		output.write(nonce);
		await pipeline(fs.createReadStream(absolutePath), cipher, output);
		fs.appendFileSync(tmpPath, cipher.getAuthTag());
		fs.renameSync(tmpPath, absolutePath);
		return true;
	} catch (error) {
		fs.rmSync(tmpPath, { force: true });
		throw error;
	}
}

// ------------------------------------------------------------
// Datei-zu-Datei (Quelle bleibt erhalten) - async Variante
// ------------------------------------------------------------

/**
 * Verschlüsselt eine Quelldatei gestreamt in eine NEUE Zieldatei (atomar:
 * Temp-Datei im Zielverzeichnis + rename). Die Quelle bleibt unverändert.
 */
export async function encryptFileToFile(sourcePath: string, targetPath: string): Promise<void> {
	const tmpPath = `${targetPath}.enc-${crypto.randomUUID()}.tmp`;
	try {
		const nonce = randomBytes(NONCE_LENGTH);
		const cipher = createCipheriv("aes-256-gcm", getDataKey(), nonce);
		const output = fs.createWriteStream(tmpPath, { mode: 0o600 });
		output.write(Buffer.from(`${MAGIC_LINE}\n`, "utf8"));
		output.write(nonce);
		await pipeline(fs.createReadStream(sourcePath), cipher, output);
		fs.appendFileSync(tmpPath, cipher.getAuthTag());
		fs.renameSync(tmpPath, targetPath);
	} catch (error) {
		fs.rmSync(tmpPath, { force: true });
		throw error;
	}
}

/**
 * Entschlüsselt eine Container-Datei gestreamt in eine NEUE Zieldatei
 * (atomar: Temp-Datei im Zielverzeichnis + rename). Die Quelle bleibt
 * unverändert. Wirft bei falschem Schlüssel/Manipulation - die Zieldatei
 * existiert dann nicht.
 */
export async function decryptFileToFile(containerPath: string, targetPath: string): Promise<void> {
	const tmpPath = `${targetPath}.dec-${crypto.randomUUID()}.tmp`;
	try {
		const parsed = parseFileContainer(containerPath);
		const decipher = createDecipheriv("aes-256-gcm", getDataKey(), parsed.nonce);
		decipher.setAuthTag(parsed.tag);
		const input = fs.createReadStream(containerPath, { start: parsed.dataStart, end: parsed.dataEnd - 1 });
		const output = fs.createWriteStream(tmpPath, { mode: 0o600 });
		await pipeline(input, decipher, output);
		fs.renameSync(tmpPath, targetPath);
	} catch (error) {
		fs.rmSync(tmpPath, { force: true });
		throw error;
	}
}

// ------------------------------------------------------------
// Synchrone Varianten - für Prozess-Exit-Hooks (process.on("exit") erlaubt
// nur synchronen Code) und den synchronen DB-Öffnungspfad (better-sqlite3).
// Chunked gelesen (4 MiB), kein Vollpuffer.
// ------------------------------------------------------------

const SYNC_CHUNK_SIZE = 4 * 1024 * 1024;

function writeAllSync(fd: number, data: Buffer | Uint8Array): void {
	let offset = 0;
	while (offset < data.length) {
		offset += fs.writeSync(fd, data, offset);
	}
}

/** Synchrone Variante von encryptFileToFile (atomar, Quelle bleibt erhalten). */
export function encryptFileToFileSync(sourcePath: string, targetPath: string): void {
	const tmpPath = `${targetPath}.enc-${crypto.randomUUID()}.tmp`;
	let inFd: number | null = null;
	let outFd: number | null = null;
	try {
		inFd = fs.openSync(sourcePath, "r");
		outFd = fs.openSync(tmpPath, "w", 0o600);
		const nonce = randomBytes(NONCE_LENGTH);
		const cipher = createCipheriv("aes-256-gcm", getDataKey(), nonce);
		writeAllSync(outFd, Buffer.from(`${MAGIC_LINE}\n`, "utf8"));
		writeAllSync(outFd, nonce);
		const buffer = Buffer.allocUnsafe(SYNC_CHUNK_SIZE);
		let read: number;
		while ((read = fs.readSync(inFd, buffer, 0, buffer.length, null)) > 0) {
			writeAllSync(outFd, cipher.update(buffer.subarray(0, read)));
		}
		writeAllSync(outFd, cipher.final());
		writeAllSync(outFd, cipher.getAuthTag());
		fs.closeSync(outFd);
		outFd = null;
		fs.renameSync(tmpPath, targetPath);
	} catch (error) {
		fs.rmSync(tmpPath, { force: true });
		throw error;
	} finally {
		if (inFd !== null) fs.closeSync(inFd);
		if (outFd !== null) fs.closeSync(outFd);
	}
}

/** Synchrone Variante von decryptFileToFile (atomar, Quelle bleibt erhalten). */
export function decryptFileToFileSync(containerPath: string, targetPath: string): void {
	const tmpPath = `${targetPath}.dec-${crypto.randomUUID()}.tmp`;
	let inFd: number | null = null;
	let outFd: number | null = null;
	try {
		const parsed = parseFileContainer(containerPath);
		const decipher = createDecipheriv("aes-256-gcm", getDataKey(), parsed.nonce);
		decipher.setAuthTag(parsed.tag);
		inFd = fs.openSync(containerPath, "r");
		outFd = fs.openSync(tmpPath, "w", 0o600);
		const buffer = Buffer.allocUnsafe(SYNC_CHUNK_SIZE);
		let position = parsed.dataStart;
		let remaining = parsed.dataEnd - parsed.dataStart;
		while (remaining > 0) {
			const read = fs.readSync(inFd, buffer, 0, Math.min(buffer.length, remaining), position);
			if (read === 0) throw new Error("Unerwartetes Dateiende im Ciphertext.");
			position += read;
			remaining -= read;
			writeAllSync(outFd, decipher.update(buffer.subarray(0, read)));
		}
		writeAllSync(outFd, decipher.final());
		fs.closeSync(outFd);
		outFd = null;
		fs.renameSync(tmpPath, targetPath);
	} catch (error) {
		fs.rmSync(tmpPath, { force: true });
		throw error;
	} finally {
		if (inFd !== null) fs.closeSync(inFd);
		if (outFd !== null) fs.closeSync(outFd);
	}
}

export interface TreeEncryptionResult {
	/** Gefundene Dateien (ohne Sidecar-Metadaten). */
	scanned: number;
	/** In diesem Lauf neu verschlüsselte Dateien. */
	encrypted: number;
	/** Bereits verschlüsselte Dateien. */
	alreadyEncrypted: number;
	/** Dateien, deren Verschlüsselung fehlschlug (Fehler werden gesammelt, der Lauf bricht nicht ab). */
	failed: { path: string; error: string }[];
}

/**
 * Bestandsmigration: Verschlüsselt alle Klartext-Dateien unterhalb eines
 * Wurzelverzeichnisses (Standard: files/). Idempotent (bereits verschlüsselte
 * Dateien werden am Magic erkannt und übersprungen), pro Datei atomar - kann
 * jederzeit erneut laufen (Server-Start, nach Backup-Import, manueller
 * Aufruf aus den Einstellungen).
 */
export async function encryptPlaintextFilesInTree(rootDir?: string): Promise<TreeEncryptionResult> {
	const root = rootDir ?? getFilesDir();
	const result: TreeEncryptionResult = { scanned: 0, encrypted: 0, alreadyEncrypted: 0, failed: [] };
	if (!fs.existsSync(root)) return result;

	const walk = async (dir: string): Promise<void> => {
		for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
			const absolute = path.join(dir, dirent.name);
			if (dirent.isDirectory()) {
				await walk(absolute);
			} else if (dirent.isFile() && !dirent.name.endsWith(META_SUFFIX)) {
				result.scanned++;
				try {
					if (await encryptFileInPlace(absolute)) result.encrypted++;
					else result.alreadyEncrypted++;
				} catch (error) {
					result.failed.push({ path: absolute, error: error instanceof Error ? error.message : String(error) });
				}
			}
		}
	};
	await walk(root);
	return result;
}

export interface TreeEncryptionStatus {
	/** Dateien (ohne Sidecar-Metadaten) insgesamt. */
	total: number;
	/** Davon verschlüsselt. */
	encrypted: number;
	/** Davon noch Klartext (Bestandsdaten vor/nach einer unterbrochenen Migration). */
	plaintext: number;
}

/** Zählt verschlüsselte vs. Klartext-Dateien (Statusanzeige in den Einstellungen). */
export function getTreeEncryptionStatus(rootDir?: string): TreeEncryptionStatus {
	const root = rootDir ?? getFilesDir();
	const status: TreeEncryptionStatus = { total: 0, encrypted: 0, plaintext: 0 };
	if (!fs.existsSync(root)) return status;

	const walk = (dir: string): void => {
		for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
			const absolute = path.join(dir, dirent.name);
			if (dirent.isDirectory()) {
				walk(absolute);
			} else if (dirent.isFile() && !dirent.name.endsWith(META_SUFFIX)) {
				status.total++;
				if (isEncryptedFile(absolute)) status.encrypted++;
				else status.plaintext++;
			}
		}
	};
	walk(root);
	return status;
}
