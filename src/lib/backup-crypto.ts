import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CipherGCM } from "node:crypto";
import { pipeline } from "node:stream/promises";

/**
 * Optionale Passwort-Verschlüsselung für Backup-Dateien (AES-256-GCM,
 * Schlüsselableitung per scrypt). Genutzt von src/data/backup.ts.
 *
 * Container-Format (Dateiendung `.imbak`, streaming-tauglich, ohne neue
 * Dependency - nur node:crypto):
 * - Zeile 1: Magic "IMMOBASE-BACKUP-ENC:v1" (\n)
 * - Zeile 2: JSON-Header mit KDF-Parametern + Salt, base64-kodiert (\n)
 * - 12 Bytes: GCM-Nonce
 * - N Bytes: AES-256-GCM-Ciphertext des Backup-ZIP
 * - letzte 16 Bytes: GCM-Auth-Tag
 *
 * Der Auth-Tag steht am DATEIENDE: Beim Verschlüsseln kann so durchgehend
 * gestreamt werden (der Tag wird nach Ende des Ciphers angehängt); beim
 * Entschlüsseln wird er über die bekannte Dateigröße separat gelesen und der
 * Ciphertext per Read-Stream mit start/end-Offsets verarbeitet (Multi-GB-
 * tauglich, kein Vollpuffer). Ein falsches Passwort fällt dabei erst am
 * Stream-Ende auf (GCM-Authentikationsfehler) - die Fehlermeldung bleibt
 * bewusst allgemein ("falsches Passwort oder beschädigte Datei").
 */

const MAGIC_LINE = "IMMOBASE-BACKUP-ENC:v1";
const NONCE_LENGTH = 12; // GCM-Standard-Nonce
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
/** Größer als jeder realistische Header (Magic + JSON + Nonce < 1 KiB). */
const HEADER_READ_LIMIT = 4096;

export const ENCRYPTED_BACKUP_EXTENSION = "imbak";
export const MIN_BACKUP_PASSWORD_LENGTH = 8;
export const BACKUP_DECRYPT_ERROR = "Entschlüsselung fehlgeschlagen - falsches Passwort oder beschädigte Datei.";

interface BackupEncryptionHeader {
	kdf: "scrypt";
	N: number;
	r: number;
	p: number;
	/** Salt, base64-kodiert. */
	salt: string;
}

// Eigener Promise-Wrapper: promisify() verliert die Options-Überladung.
function scryptAsync(
	password: string,
	salt: Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem?: number }
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, keylen, options, (error, derivedKey) => {
			if (error) reject(error);
			else resolve(derivedKey);
		});
	});
}

async function deriveKey(password: string, header: BackupEncryptionHeader): Promise<Buffer> {
	if (header.kdf !== "scrypt") {
		throw new Error(`Unbekanntes KDF "${String(header.kdf)}".`);
	}
	return scryptAsync(password, Buffer.from(header.salt, "base64"), KEY_LENGTH, {
		N: header.N,
		r: header.r,
		p: header.p,
		maxmem: SCRYPT_MAXMEM,
	});
}

/** Prüft, ob ein Dateianfang (Buffer) dem Container-Magic entspricht. */
export function isEncryptedBackupPrefix(prefix: Buffer): boolean {
	return prefix.subarray(0, MAGIC_LINE.length + 1).toString("utf8") === `${MAGIC_LINE}\n`;
}

/** Prüft anhand des Magics, ob eine Datei ein verschlüsseltes Backup ist. */
export function isEncryptedBackupFile(filePath: string): boolean {
	let fd: number | null = null;
	try {
		fd = fs.openSync(filePath, "r");
		const buffer = Buffer.alloc(MAGIC_LINE.length + 1);
		const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
		return read === buffer.length && isEncryptedBackupPrefix(buffer);
	} catch {
		return false;
	} finally {
		if (fd !== null) fs.closeSync(fd);
	}
}

async function createBackupCipher(password: string): Promise<{ header: Buffer; cipher: CipherGCM }> {
	const salt = randomBytes(16);
	const nonce = randomBytes(NONCE_LENGTH);
	const headerJson: BackupEncryptionHeader = { kdf: "scrypt", ...SCRYPT_PARAMS, salt: salt.toString("base64") };
	const key = await deriveKey(password, headerJson);
	const cipher = createCipheriv("aes-256-gcm", key, nonce);
	// Best effort: Schlüssel nicht länger im Speicher halten als nötig
	// (createCipheriv kopiert das Schlüsselmaterial in den Cipher-Kontext).
	key.fill(0);
	const header = Buffer.concat([Buffer.from(`${MAGIC_LINE}\n${JSON.stringify(headerJson)}\n`, "utf8"), nonce]);
	return { header, cipher };
}

/**
 * Verschlüsselt einen Quell-Stream streaming in die Zieldatei (Container-
 * Header + Ciphertext + Auth-Tag am Ende). source muss vom Aufrufer selbst
 * "angestoßen" werden (z. B. archiver.finalize()).
 */
export async function encryptStreamToFile(source: NodeJS.ReadableStream, targetPath: string, password: string): Promise<void> {
	const { header, cipher } = await createBackupCipher(password);
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	const output = fs.createWriteStream(targetPath);
	output.write(header);
	await pipeline(source, cipher, output);
	fs.appendFileSync(targetPath, cipher.getAuthTag());
}

interface ParsedContainer {
	header: BackupEncryptionHeader;
	nonce: Buffer;
	tag: Buffer;
	/** Offset des ersten Ciphertext-Bytes. */
	dataStart: number;
	/** Offset des ersten Bytes NACH dem Ciphertext (Beginn des Auth-Tags). */
	dataEnd: number;
}

function parseEncryptedContainer(filePath: string): ParsedContainer {
	const stat = fs.statSync(filePath);
	const fd = fs.openSync(filePath, "r");
	try {
		const head = Buffer.alloc(Math.min(HEADER_READ_LIMIT, stat.size));
		fs.readSync(fd, head, 0, head.length, 0);
		const magicEnd = head.indexOf(0x0a);
		if (magicEnd === -1 || !isEncryptedBackupPrefix(head.subarray(0, magicEnd + 1))) {
			throw new Error("Container-Magic fehlt.");
		}
		const jsonEnd = head.indexOf(0x0a, magicEnd + 1);
		if (jsonEnd === -1) {
			throw new Error("Container-Header unvollständig.");
		}
		const header = JSON.parse(head.subarray(magicEnd + 1, jsonEnd).toString("utf8")) as BackupEncryptionHeader;
		const nonceStart = jsonEnd + 1;
		const nonceEnd = nonceStart + NONCE_LENGTH;
		if (nonceEnd > head.length) {
			throw new Error("Container-Header überschreitet die Lese-Grenze.");
		}
		const dataEnd = stat.size - TAG_LENGTH;
		if (dataEnd <= nonceEnd) {
			throw new Error("Datei zu klein oder beschädigt.");
		}
		const nonce = Buffer.from(head.subarray(nonceStart, nonceEnd));
		const tag = Buffer.alloc(TAG_LENGTH);
		fs.readSync(fd, tag, 0, TAG_LENGTH, dataEnd);
		return { header, nonce, tag, dataStart: nonceEnd, dataEnd };
	} finally {
		fs.closeSync(fd);
	}
}

/**
 * Entschlüsselt eine `.imbak`-Datei in ein temporäres ZIP und liefert dessen
 * Pfad + Cleanup-Funktion. Wirft BACKUP_DECRYPT_ERROR bei falschem Passwort
 * oder beschädigten Daten (Details bewusst nicht in der Meldung).
 */
export async function decryptBackupToTempZip(
	encryptedPath: string,
	password: string
): Promise<{ zipPath: string; cleanup: () => void }> {
	let parsed: ParsedContainer;
	try {
		parsed = parseEncryptedContainer(encryptedPath);
	} catch (error) {
		throw new Error(`${BACKUP_DECRYPT_ERROR} (${error instanceof Error ? error.message : String(error)})`);
	}

	const zipPath = path.join(os.tmpdir(), `iv-decrypt-${crypto.randomUUID()}.zip`);
	try {
		const key = await deriveKey(password, parsed.header);
		const decipher = createDecipheriv("aes-256-gcm", key, parsed.nonce);
		key.fill(0);
		decipher.setAuthTag(parsed.tag);
		// Ciphertext ohne Header (start) und ohne Auth-Tag (end ist inklusiv!).
		const input = fs.createReadStream(encryptedPath, { start: parsed.dataStart, end: parsed.dataEnd - 1 });
		const output = fs.createWriteStream(zipPath);
		await pipeline(input, decipher, output);
	} catch {
		fs.rmSync(zipPath, { force: true });
		throw new Error(BACKUP_DECRYPT_ERROR);
	}

	return {
		zipPath,
		cleanup: () => {
			try {
				fs.rmSync(zipPath, { force: true });
			} catch {
				// Temp-Datei - Fehler beim Aufräumen ignorieren.
			}
		},
	};
}
