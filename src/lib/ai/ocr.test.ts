import zlib from "node:zlib";

import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import { processAttachment } from "@/lib/ai/attachments";
import { ocrPdfPages } from "@/lib/ai/ocr";

/**
 * Echter End-to-End-Durchstich der OCR (KEIN Mock - anders als die
 * PDF-Fälle in chat.test.ts): Ein PDF, dessen einzige Seite nur ein
 * eingebettetes Rasterbild ohne Textebene enthält (Scan-Simulation), muss
 * über den OCR-Pfad (pdfjs-Rasterung + tesseract.js mit gebündeltem
 * deutschen Sprachmodell) lesbaren Text liefern. Deckt zugleich ab, dass
 * die Engine offline aus dem lokalen node_modules läuft.
 */

/**
 * Baut ein minimales PDF mit genau einer Seite, die ein einzelnes
 * FlateDecode-RGB-Bild enthält (kein Text) - Rohbau mit korrekten
 * Byte-Offsets, damit kein PDF-Generator mit Dateisystem-Zugriff nötig ist.
 */
function buildImagePdf(imageRgb: Buffer, width: number, height: number): Buffer {
	const imageData = zlib.deflateSync(imageRgb, { level: 9 });
	const contentStream = Buffer.from(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`, "latin1");

	const objects: Buffer[] = [
		Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
		Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
		Buffer.from(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
			"latin1"
		),
		Buffer.concat([
			Buffer.from(
				`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${imageData.length} >>\nstream\n`,
				"latin1"
			),
			imageData,
			Buffer.from("\nendstream", "latin1"),
		]),
		Buffer.concat([Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n`, "latin1"), contentStream, Buffer.from("endstream", "latin1")]),
	];

	const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
	const offsets: number[] = [];
	let position = parts[0].length;
	for (const [index, objectBody] of objects.entries()) {
		offsets.push(position);
		const header = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
		const footer = Buffer.from("\nendobj\n", "latin1");
		parts.push(header, objectBody, footer);
		position += header.length + objectBody.length + footer.length;
	}
	const xrefStart = position;
	let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) {
		xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
	}
	xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
	parts.push(Buffer.from(xref, "latin1"));
	return Buffer.concat(parts);
}

/** Malt deutschen Beispieltext auf eine Leinwand und liefert die RGB-Rohdaten. */
function drawScanImage(): { rgb: Buffer; width: number; height: number } {
	const width = 1000;
	const height = 420;
	const canvas = createCanvas(width, height);
	const context = canvas.getContext("2d");
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, width, height);
	context.fillStyle = "#000000";
	context.font = "40px sans-serif";
	context.fillText("Nebenkostenabrechnung 2025", 60, 120);
	context.font = "30px sans-serif";
	context.fillText("Musterstraße 12, 12345 Musterstadt", 60, 200);
	context.fillText("Gesamtkosten: 1.340,89 EUR", 60, 270);

	const rgba = context.getImageData(0, 0, width, height).data;
	const rgb = Buffer.alloc(width * height * 3);
	for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
		rgb[target] = rgba[source];
		rgb[target + 1] = rgba[source + 1];
		rgb[target + 2] = rgba[source + 2];
	}
	return { rgb, width, height };
}

describe("OCR für gescannte PDFs (src/lib/ai/ocr.ts, echter Durchstich)", () => {
	it(
		"erkennt den Text eines Bild-PDFs ohne Textebene vollständig per OCR",
		async () => {
			const { rgb, width, height } = drawScanImage();
			const pdfBuffer = buildImagePdf(rgb, width, height);

			const result = await processAttachment("scan.pdf", pdfBuffer.toString("base64"));

			expect(result.kind).toBe("text");
			if (result.kind !== "text") return;
			expect(result.text).toContain("--- Seite 1 (per OCR erkannt) ---");
			expect(result.text).toContain("Nebenkostenabrechnung 2025");
			expect(result.text).toContain("Musterstadt");
			expect(result.text).toContain("1.340,89");
		},
		// Worker-Start + Rastern + Erkennen können einige Sekunden dauern.
		120_000
	);

	it(
		"liefert für eine leere Seite eine leere OCR-Ergebnis-Map",
		async () => {
			// Direkt auf Modulebene: weiße Seite ohne Inhalt.
			const width = 400;
			const height = 200;
			const rgb = Buffer.alloc(width * height * 3, 255);
			const pdfBuffer = buildImagePdf(rgb, width, height);

			const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
			const task = getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false, useSystemFonts: true, disableFontFace: true });
			try {
				const pdf = await task.promise;
				const results = await ocrPdfPages(pdf, [1]);
				expect(results.size).toBe(0);
			} finally {
				await task.destroy().catch(() => {});
			}
		},
		120_000
	);
});
