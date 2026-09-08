import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isEncryptedFile } from "@/lib/file-crypto";
import { getUploadedFile, saveGeneratedFile, saveUploadedFile } from "@/lib/storage";

/**
 * Tests für die Storage-Schicht (src/lib/storage.ts): Neue Dateien liegen
 * verschlüsselt auf der Platte, der Lesepfad liefert transparent Klartext
 * und bleibt zu Klartext-Bestandsdateien kompatibel.
 */

let testDir: string;

beforeEach(() => {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "iv-storage-test-"));
	process.env.APP_DATA_DIR = testDir;
});

afterEach(() => {
	fs.rmSync(testDir, { recursive: true, force: true });
});

async function streamToString(stream: ReadableStream): Promise<string> {
	return new Response(stream).text();
}

describe("storage (verschlüsselte Ablage)", () => {
	it("saveGeneratedFile legt die Datei verschlüsselt ab, getUploadedFile liefert Klartext", async () => {
		const content = Buffer.from("PDF-Inhalt der Abrechnung");
		const saved = await saveGeneratedFile(content, "billing-statements", "Abrechnung 2026.pdf");

		const absolute = path.join(testDir, "files", saved.relativePath);
		expect(isEncryptedFile(absolute)).toBe(true);
		// Der Originalinhalt steht NICHT im Rohtext auf der Platte.
		expect(fs.readFileSync(absolute).includes(content)).toBe(false);

		const file = await getUploadedFile(saved.relativePath);
		expect(file).not.toBeNull();
		expect(file!.fileName).toBe("Abrechnung 2026.pdf");
		expect(file!.mimeType).toBe("application/pdf");
		expect(await streamToString(file!.body)).toBe(content.toString("utf8"));
	});

	it("saveUploadedFile verschlüsselt Uploads inkl. Sidecar-Metadaten", async () => {
		const upload = new File([Buffer.from("gescanntes Protokoll")], "Übergabeprotokoll.pdf", { type: "application/pdf" });
		const saved = await saveUploadedFile(upload, "protocols");

		const absolute = path.join(testDir, "files", saved.relativePath);
		expect(isEncryptedFile(absolute)).toBe(true);
		// Sidecar bleibt lesbares JSON (Original-Name/MIME, kein Inhalt).
		const meta = JSON.parse(fs.readFileSync(`${absolute}.meta.json`, "utf8"));
		expect(meta.originalFileName).toBe("Übergabeprotokoll.pdf");

		const file = await getUploadedFile(saved.relativePath);
		expect(file!.fileName).toBe("Übergabeprotokoll.pdf");
		expect(await streamToString(file!.body)).toBe("gescanntes Protokoll");
	});

	it("liest Klartext-Bestandsdateien (vor der Verschlüsselung abgelegt) unverändert", async () => {
		// Bestand simulieren: direkt auf die Platte schreiben (wie alte App-Versionen).
		const dir = path.join(testDir, "files", "documents");
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, "alt.pdf"), "alter Klartext-Inhalt");
		fs.writeFileSync(
			path.join(dir, "alt.pdf.meta.json"),
			JSON.stringify({ originalFileName: "Alt-Vertrag.pdf", mimeType: "application/pdf" })
		);

		const file = await getUploadedFile("documents/alt.pdf");
		expect(file).not.toBeNull();
		expect(file!.fileName).toBe("Alt-Vertrag.pdf");
		expect(await streamToString(file!.body)).toBe("alter Klartext-Inhalt");
	});
});
