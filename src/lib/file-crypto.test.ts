import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	decryptBuffer,
	encryptBuffer,
	encryptFileInPlace,
	encryptPlaintextFilesInTree,
	getTreeEncryptionStatus,
	hashPlaintextFile,
	isEncryptedFile,
	readPlaintextFile,
	writeEncryptedFile,
} from "@/lib/file-crypto";

/**
 * Tests für die Dateiverschlüsselung at rest (AES-256-GCM-Container,
 * Streaming, Bestandsmigration). Der Master-Schlüssel kommt in Tests aus der
 * automatisch angelegten Schlüsseldatei im temporären APP_DATA_DIR (siehe
 * src/lib/data-key.ts); der Schlüssel-Cache ist an das Verzeichnis gebunden,
 * Verzeichniswechsel zwischen Tests sind daher abgedeckt.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-filecrypto-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	fs.rmSync(testDir, { recursive: true, force: true });
});

describe("encryptBuffer/decryptBuffer", () => {
	it("rundtrippt beliebige Bytes", () => {
		const plain = Buffer.from("Vertraulicher Inhalt: Mietvertrag Müller ✓", "utf8");
		const container = encryptBuffer(plain);
		expect(container.equals(plain)).toBe(false);
		expect(container.subarray(0, 20).toString("utf8")).toBe("IMMOBASE-FILE-ENC:v1");
		expect(decryptBuffer(container)).toEqual(plain);
	});

	it("nutzt pro Verschlüsselung eine frische Nonce (gleiche Daten -> andere Container)", () => {
		const plain = Buffer.from("gleicher Inhalt");
		expect(encryptBuffer(plain).equals(encryptBuffer(plain))).toBe(false);
	});

	it("erkennt Manipulationen am Ciphertext (GCM-Authentikationsfehler)", () => {
		const container = encryptBuffer(Buffer.from("wichtige Daten"));
		container[container.length - 20] ^= 0xff; // Byte im Ciphertext kippen
		expect(() => decryptBuffer(container)).toThrow();
	});

	it("erkennt Manipulationen am Auth-Tag", () => {
		const container = encryptBuffer(Buffer.from("wichtige Daten"));
		container[container.length - 1] ^= 0xff;
		expect(() => decryptBuffer(container)).toThrow();
	});
});

describe("Datei-Ebene (writeEncryptedFile/isEncryptedFile/Streams)", () => {
	it("schreibt verschlüsselt und liest gestreamt wieder Klartext", async () => {
		const target = path.join(testDir, "files", "documents", "dokument.pdf");
		const plain = Buffer.from("%PDF-beispielinhalt".repeat(1000));
		writeEncryptedFile(target, plain);

		expect(isEncryptedFile(target)).toBe(true);
		// Auf der Platte liegt KEIN Klartext.
		expect(fs.readFileSync(target).includes(plain.subarray(0, 64))).toBe(false);
		await expect(readPlaintextFile(target)).resolves.toEqual(plain);
	});

	it("liefert für Klartext-Bestandsdateien einen unveränderten Stream", async () => {
		const target = path.join(testDir, "alt.pdf");
		fs.writeFileSync(target, "alter Klartext");
		expect(isEncryptedFile(target)).toBe(false);
		await expect(readPlaintextFile(target)).resolves.toEqual(Buffer.from("alter Klartext"));
	});

	it("hashPlaintextFile liefert für beide Formate die Klartext-Prüfsumme/-Größe", async () => {
		const plain = Buffer.from("inhalt für prüfsumme");
		const plainPath = path.join(testDir, "plain.bin");
		const encPath = path.join(testDir, "enc.bin");
		fs.writeFileSync(plainPath, plain);
		writeEncryptedFile(encPath, plain);

		const hashPlain = await hashPlaintextFile(plainPath);
		const hashEnc = await hashPlaintextFile(encPath);
		expect(hashEnc.sha256).toBe(hashPlain.sha256);
		expect(hashEnc.size).toBe(plain.length);
		expect(hashPlain.size).toBe(plain.length);
	});

	it("bricht das Entschlüsseln mit falschem Schlüssel hart ab", async () => {
		const target = path.join(testDir, "geheim.pdf");
		writeEncryptedFile(target, Buffer.from("geheim"));

		// Anderes Datenverzeichnis = anderer Schlüssel.
		const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-filecrypto-other-"));
		process.env.APP_DATA_DIR = otherDir;
		await expect(readPlaintextFile(target)).rejects.toThrow();
		fs.rmSync(otherDir, { recursive: true, force: true });
	});
});

describe("Bestandsmigration", () => {
	it("verschlüsselt eine Klartext-Datei atomar an Ort und Stelle (idempotent)", async () => {
		const target = path.join(testDir, "bestand.pdf");
		fs.writeFileSync(target, "bestandsinhalt");

		await expect(encryptFileInPlace(target)).resolves.toBe(true);
		expect(isEncryptedFile(target)).toBe(true);
		await expect(readPlaintextFile(target)).resolves.toEqual(Buffer.from("bestandsinhalt"));

		// Zweiter Lauf: nichts mehr zu tun.
		await expect(encryptFileInPlace(target)).resolves.toBe(false);
	});

	it("encryptPlaintextFilesInTree: verschlüsselt rekursiv, überspringt Sidecar-Metadaten", async () => {
		const filesRoot = path.join(testDir, "files");
		fs.mkdirSync(path.join(filesRoot, "documents"), { recursive: true });
		fs.writeFileSync(path.join(filesRoot, "documents", "a.pdf"), "A");
		fs.writeFileSync(path.join(filesRoot, "documents", "a.pdf.meta.json"), JSON.stringify({ originalFileName: "a.pdf", mimeType: "application/pdf" }));
		fs.mkdirSync(path.join(filesRoot, "protocols"), { recursive: true });
		fs.writeFileSync(path.join(filesRoot, "protocols", "b.txt"), "B");
		writeEncryptedFile(path.join(filesRoot, "protocols", "c.pdf"), Buffer.from("C"));

		const result = await encryptPlaintextFilesInTree(filesRoot);
		expect(result.scanned).toBe(3);
		expect(result.encrypted).toBe(2);
		expect(result.alreadyEncrypted).toBe(1);
		expect(result.failed).toHaveLength(0);

		// Metadaten bleiben Klartext.
		expect(fs.readFileSync(path.join(filesRoot, "documents", "a.pdf.meta.json"), "utf8")).toContain("originalFileName");
		await expect(readPlaintextFile(path.join(filesRoot, "documents", "a.pdf"))).resolves.toEqual(Buffer.from("A"));

		// Statuszählung nach der Migration: alles verschlüsselt.
		const status = getTreeEncryptionStatus(filesRoot);
		expect(status).toEqual({ total: 3, encrypted: 3, plaintext: 0 });
	});
});
