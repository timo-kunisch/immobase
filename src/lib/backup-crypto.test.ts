import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	decryptBackupToTempZip,
	ENCRYPTED_BACKUP_EXTENSION,
	encryptStreamToFile,
	isEncryptedBackupFile,
	isEncryptedBackupPrefix,
} from "@/lib/backup-crypto";

/**
 * Roundtrip-Tests für den verschlüsselten Backup-Container (.imbak):
 * Magic-Erkennung, Entschlüsselung mit richtigem/falschem Passwort und
 * Manipulationserkennung (GCM-Auth-Tag).
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-crypto-test-"));
});

afterEach(() => {
	fs.rmSync(testDir, { recursive: true, force: true });
});

const PASSWORD = "geheim-123";

async function encryptBuffer(data: Buffer, password: string): Promise<string> {
	const target = path.join(testDir, `test-${crypto.randomUUID()}.${ENCRYPTED_BACKUP_EXTENSION}`);
	await encryptStreamToFile(Readable.from(data), target, password);
	return target;
}

describe("Backup-Verschlüsselung (Container)", () => {
	it("verschlüsselt und entschlüsselt verlustfrei (Roundtrip)", async () => {
		const payload = randomBytes(100_000);
		const encrypted = await encryptBuffer(payload, PASSWORD);

		expect(fs.existsSync(encrypted)).toBe(true);
		// Kein ZIP-Magic (PK) am Dateianfang - stattdessen Container-Magic.
		const head = Buffer.alloc(4);
		const fd = fs.openSync(encrypted, "r");
		fs.readSync(fd, head, 0, 4, 0);
		fs.closeSync(fd);
		expect(head.toString("utf8", 0, 2)).not.toBe("PK");

		const { zipPath, cleanup } = await decryptBackupToTempZip(encrypted, PASSWORD);
		try {
			expect(fs.readFileSync(zipPath).equals(payload)).toBe(true);
		} finally {
			cleanup();
			expect(fs.existsSync(zipPath)).toBe(false);
		}
	});

	it("erkennt verschlüsselte Dateien am Magic (Datei und Prefix)", async () => {
		const encrypted = await encryptBuffer(Buffer.from("daten"), PASSWORD);
		const plain = path.join(testDir, "plain.zip");
		fs.writeFileSync(plain, Buffer.from("PK\x03\x04fake"));

		expect(isEncryptedBackupFile(encrypted)).toBe(true);
		expect(isEncryptedBackupFile(plain)).toBe(false);
		expect(isEncryptedBackupFile(path.join(testDir, "existiert-nicht.zip"))).toBe(false);
		expect(isEncryptedBackupPrefix(Buffer.from("IMMOBASE-BACKUP-ENC:v1\n{}"))).toBe(true);
		expect(isEncryptedBackupPrefix(Buffer.from("PK\x03\x04"))).toBe(false);
	});

	it("schlägt mit falschem Passwort fehl (klare Fehlermeldung)", async () => {
		const encrypted = await encryptBuffer(Buffer.from("geheime daten"), PASSWORD);
		await expect(decryptBackupToTempZip(encrypted, "falsches-passwort")).rejects.toThrow(/Entschlüsselung fehlgeschlagen/);
	});

	it("erkennt manipulierte Daten (GCM-Authentikationsfehler)", async () => {
		const encrypted = await encryptBuffer(Buffer.from("x".repeat(10_000)), PASSWORD);
		// Ein Byte mitten im Ciphertext kippen (nach dem Header, vor dem Tag).
		const stat = fs.statSync(encrypted);
		const fd = fs.openSync(encrypted, "r+");
		const position = Math.floor(stat.size / 2);
		const one = Buffer.alloc(1);
		fs.readSync(fd, one, 0, 1, position);
		one[0] = one[0] ^ 0xff;
		fs.writeSync(fd, one, 0, 1, position);
		fs.closeSync(fd);

		await expect(decryptBackupToTempZip(encrypted, PASSWORD)).rejects.toThrow(/Entschlüsselung fehlgeschlagen/);
	});

	it("erzeugt bei gleichem Inhalt unterschiedliche Container (zufälliges Salt/Nonce)", async () => {
		const data = Buffer.from("gleicher inhalt");
		const a = await encryptBuffer(data, PASSWORD);
		const b = await encryptBuffer(data, PASSWORD);
		expect(fs.readFileSync(a).equals(fs.readFileSync(b))).toBe(false);
	});
});
