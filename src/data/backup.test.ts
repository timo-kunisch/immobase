import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import archiver from "archiver";
import yauzl from "yauzl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exportBackup, importBackup } from "@/data/backup";
import { closeDb, getDb } from "@/data/db";
import { LATEST_SCHEMA_VERSION } from "@/data/migrate";
import { createProperty, getProperty, listProperties } from "@/data/properties";
import { isEncryptedBackupFile } from "@/lib/backup-crypto";

/**
 * Export/Import-Roundtrip-Tests inkl. Prüfsummen-Validierung, Modi
 * "Ersetzen"/"Zusammenführen", Ablehnung neuerer Schema-Versionen und
 * passwortverschlüsselte Container (.imbak, Roundtrip/Fehlerfälle).
 */

let testDir: string;
let zipPath: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-backup-test-"));
	process.env.APP_DATA_DIR = testDir;
	zipPath = path.join(testDir, "backup.zip");
});

afterEach(() => {
	closeDb();
	fs.rmSync(testDir, { recursive: true, force: true });
});

function seedData(): void {
	createProperty({ name: "Musterhaus", street: "Hauptstr. 1", zipCode: "12345", city: "Berlin", country: "Deutschland", notes: null });
	// Eine Datei in der Ablage anlegen (inkl. Sidecar-Metadaten, wie saveGeneratedFile)
	const filesDir = path.join(testDir, "files", "documents");
	fs.mkdirSync(filesDir, { recursive: true });
	fs.writeFileSync(path.join(filesDir, "doc1.pdf"), "%PDF-fake-content");
	fs.writeFileSync(path.join(filesDir, "doc1.pdf.meta.json"), JSON.stringify({ originalFileName: "Vertrag.pdf", mimeType: "application/pdf" }));
}

interface ZipListing {
	names: string[];
	manifest: { app: string; schemaVersion: number; files: { path: string; sha256: string; size: number }[] };
}

async function readZipListing(zipFilePath: string): Promise<ZipListing> {
	const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
		yauzl.open(zipFilePath, { lazyEntries: true, autoClose: true }, (err, zf) => (err || !zf ? reject(err) : resolve(zf)));
	});
	const names: string[] = [];
	let manifest: ZipListing["manifest"] | null = null;
	await new Promise<void>((resolve, reject) => {
		zipfile.on("error", reject);
		zipfile.on("end", () => resolve());
		zipfile.on("entry", (entry: yauzl.Entry) => {
			if (/\/$/.test(entry.fileName)) {
				zipfile.readEntry();
				return;
			}
			names.push(entry.fileName);
			if (entry.fileName === "manifest.json") {
				zipfile.openReadStream(entry, (err, stream) => {
					if (err || !stream) {
						reject(err);
						return;
					}
					const chunks: Buffer[] = [];
					stream.on("data", (c: Buffer) => chunks.push(c));
					stream.on("end", () => {
						manifest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
						zipfile.readEntry();
					});
					stream.on("error", reject);
				});
			} else {
				zipfile.readEntry();
			}
		});
		zipfile.readEntry();
	});
	return { names, manifest: manifest! };
}

/** Manipuliert eine Datei im ZIP: entpackt, ändert, packt neu (für Prüfsummen-Fehlerfall). */
async function tamperZip(sourceZip: string, targetZip: string, mutate: (dir: string) => void): Promise<void> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-tamper-"));
	const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
		yauzl.open(sourceZip, { lazyEntries: true, autoClose: true }, (err, zf) => (err || !zf ? reject(err) : resolve(zf)));
	});
	await new Promise<void>((resolve, reject) => {
		zipfile.on("error", reject);
		zipfile.on("end", () => resolve());
		zipfile.on("entry", (entry: yauzl.Entry) => {
			if (/\/$/.test(entry.fileName)) {
				zipfile.readEntry();
				return;
			}
			zipfile.openReadStream(entry, (err, stream) => {
				if (err || !stream) {
					reject(err);
					return;
				}
				const target = path.join(dir, entry.fileName);
				fs.mkdirSync(path.dirname(target), { recursive: true });
				const out = fs.createWriteStream(target);
				stream.pipe(out);
				out.on("finish", () => zipfile.readEntry());
				out.on("error", reject);
				stream.on("error", reject);
			});
		});
		zipfile.readEntry();
	});
	mutate(dir);
	const output = fs.createWriteStream(targetZip);
	const archive = archiver("zip");
	archive.pipe(output);
	archive.directory(dir, false);
	await archive.finalize();
	await new Promise<void>((resolve) => output.on("close", resolve));
	fs.rmSync(dir, { recursive: true, force: true });
}

describe("Backup-Export", () => {
	it("erzeugt eine ZIP mit manifest.json, data.db und files/ inkl. SHA-256-Prüfsummen", async () => {
		seedData();
		const result = await exportBackup(zipPath);

		expect(fs.existsSync(zipPath)).toBe(true);
		expect(result.fileCount).toBe(3); // data.db + doc1.pdf + doc1.pdf.meta.json

		const listing = await readZipListing(zipPath);
		expect(listing.names).toContain("manifest.json");
		expect(listing.names).toContain("data.db");
		expect(listing.names).toContain("files/documents/doc1.pdf");
		expect(listing.names).toContain("files/documents/doc1.pdf.meta.json");

		expect(listing.manifest.app).toBe("immobase");
		expect(listing.manifest.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
		expect(listing.manifest.files).toHaveLength(3);
		for (const file of listing.manifest.files) {
			expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
		}
	});
});

describe("Backup-Import (Ersetzen)", () => {
	it("stellt DB und Dateien in einem frischen Datenverzeichnis wieder her", async () => {
		seedData();
		const created = listProperties()[0];
		await exportBackup(zipPath);

		// Neues Datenverzeichnis = "frisches Gerät"
		closeDb();
		const restoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-restore-"));
		process.env.APP_DATA_DIR = restoreDir;

		const result = await importBackup(zipPath, "replace");
		expect(result.mode).toBe("replace");

		// Datenbank-Inhalte vorhanden
		const restored = getProperty(created.id);
		expect(restored?.name).toBe("Musterhaus");

		// Dateien wiederhergestellt (inkl. Sidecar-Metadaten)
		expect(fs.readFileSync(path.join(restoreDir, "files", "documents", "doc1.pdf"), "utf8")).toBe("%PDF-fake-content");
		expect(fs.existsSync(path.join(restoreDir, "files", "documents", "doc1.pdf.meta.json"))).toBe(true);

		fs.rmSync(restoreDir, { recursive: true, force: true });
	});

	it("lehnt ein Backup mit NEUERER Schema-Version ab", async () => {
		seedData();
		await exportBackup(zipPath);

		const tampered = path.join(testDir, "tampered-version.zip");
		await tamperZip(zipPath, tampered, (dir) => {
			const manifestPath = path.join(dir, "manifest.json");
			const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
			manifest.schemaVersion = LATEST_SCHEMA_VERSION + 1;
			fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
		});

		await expect(importBackup(tampered, "replace")).rejects.toThrow(/neueren Version/i);
	});

	it("lehnt ein Backup mit manipuliertem Inhalt (Prüfsummenfehler) ab", async () => {
		seedData();
		await exportBackup(zipPath);

		const tampered = path.join(testDir, "tampered-content.zip");
		await tamperZip(zipPath, tampered, (dir) => {
			fs.writeFileSync(path.join(dir, "files", "documents", "doc1.pdf"), "manipulierter Inhalt");
		});

		await expect(importBackup(tampered, "replace")).rejects.toThrow(/Prüfsummenfehler/);
	});

	it("legt vor dem Ersetzen ein Backup des Ist-Zustands an", async () => {
		seedData();
		await exportBackup(zipPath);

		// Lokale Änderung nach dem Export
		createProperty({ name: "Zweites Haus", street: "Nebenstr. 2", zipCode: "54321", city: "Hamburg", country: "Deutschland", notes: null });

		const result = await importBackup(zipPath, "replace");
		expect(result.backupPath).not.toBeNull();
		expect(fs.existsSync(result.backupPath!)).toBe(true);

		// Ist-Zustand wurde ersetzt: "Zweites Haus" ist weg, "Musterhaus" ist da
		expect(listProperties().map((p) => p.name)).toEqual(["Musterhaus"]);
	});
});

describe("Backup-Export/-Import (verschlüsselt)", () => {
	const PASSWORD = "geheim-123";

	it("schreibt einen .imbak-Container (kein ZIP-Magic) und stellt daraus mit Passwort wieder her", async () => {
		seedData();
		const created = listProperties()[0];
		const encryptedPath = path.join(testDir, "backup.imbak");
		await exportBackup(encryptedPath, { password: PASSWORD });

		// Container statt ZIP: erkennbar am Magic, nicht an "PK".
		expect(isEncryptedBackupFile(encryptedPath)).toBe(true);

		// Neues Datenverzeichnis = "frisches Gerät"
		closeDb();
		const restoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-restore-enc-"));
		process.env.APP_DATA_DIR = restoreDir;

		const result = await importBackup(encryptedPath, "replace", { password: PASSWORD });
		expect(result.mode).toBe("replace");
		expect(getProperty(created.id)?.name).toBe("Musterhaus");
		expect(fs.readFileSync(path.join(restoreDir, "files", "documents", "doc1.pdf"), "utf8")).toBe("%PDF-fake-content");

		fs.rmSync(restoreDir, { recursive: true, force: true });
	});

	it("lehnt den Import einer verschlüsselten Datei OHNE Passwort mit klarem Hinweis ab", async () => {
		seedData();
		const encryptedPath = path.join(testDir, "backup.imbak");
		await exportBackup(encryptedPath, { password: PASSWORD });

		await expect(importBackup(encryptedPath, "replace")).rejects.toThrow(/verschlüsselt.*Passwort/i);
	});

	it("lehnt den Import mit falschem Passwort ab", async () => {
		seedData();
		const encryptedPath = path.join(testDir, "backup.imbak");
		await exportBackup(encryptedPath, { password: PASSWORD });

		await expect(importBackup(encryptedPath, "replace", { password: "falsches-passwort" })).rejects.toThrow(
			/Entschlüsselung fehlgeschlagen/
		);
		// Bestand bleibt unverändert (fehlgeschlagene Entschlüsselung rührt nichts an).
		expect(listProperties().map((p) => p.name)).toEqual(["Musterhaus"]);
	});

	it("unterstützt auch den Merge-Modus aus einem verschlüsselten Container", async () => {
		seedData();
		const encryptedPath = path.join(testDir, "backup.imbak");
		await exportBackup(encryptedPath, { password: PASSWORD });

		closeDb();
		const restoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-restore-enc-merge-"));
		process.env.APP_DATA_DIR = restoreDir;

		const result = await importBackup(encryptedPath, "merge", { password: PASSWORD });
		expect(result.mode).toBe("merge");
		expect(listProperties().map((p) => p.name)).toEqual(["Musterhaus"]);

		fs.rmSync(restoreDir, { recursive: true, force: true });
	});
});

describe("Backup-Import (Zusammenführen)", () => {
	it("fügt fehlende Zeilen hinzu und lässt lokale Daten unverändert (Konfliktstrategie: lokal gewinnt)", async () => {
		seedData();
		await exportBackup(zipPath);

		// Lokale Änderungen NACH dem Export: neuer Datensatz + Änderung am Bestand
		closeDb();
		process.env.APP_DATA_DIR = testDir;
		const local = createProperty({
			name: "Lokal Neu",
			street: "Weg 3",
			zipCode: "99999",
			city: "Köln",
			country: "Deutschland",
			notes: null,
		});
		const exported = listProperties().find((p) => p.name === "Musterhaus")!;
		getDb().prepare("UPDATE properties SET name = ? WHERE id = ?").run("Musterhaus (lokal geändert)", exported.id);

		const result = await importBackup(zipPath, "merge");
		expect(result.mode).toBe("merge");

		const names = listProperties()
			.map((p) => p.name)
			.sort();
		// Lokaler Neudatensatz bleibt, lokale Änderung gewinnt gegenüber Backup,
		// "Musterhaus" aus dem Backup wird NICHT nochmal eingefügt (gleiche id).
		expect(names).toEqual(["Lokal Neu", "Musterhaus (lokal geändert)"]);
		expect(getProperty(local.id)).not.toBeNull();
	});

	it("kopiert nur Dateien, die lokal noch nicht existieren", async () => {
		seedData();
		await exportBackup(zipPath);

		// Lokale Datei mit gleichem Namen, anderem Inhalt
		const localFile = path.join(testDir, "files", "documents", "doc1.pdf");
		fs.writeFileSync(localFile, "lokaler Inhalt");

		await importBackup(zipPath, "merge");

		expect(fs.readFileSync(localFile, "utf8")).toBe("lokaler Inhalt");
	});
});
