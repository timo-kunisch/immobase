// Bewusst die Browserify-"standalone"-Variante von pdfkit importieren statt
// des Standard-Einstiegspunkts "pdfkit": Diese Variante hat alle
// Font-Metrik-Dateien (.afm) bereits inline im Bundle statt sie zur
// Laufzeit per fs.readFileSync relativ zum eigenen Paketverzeichnis
// nachzuladen - robuster im Standalone-/Electron-Packaging, wo das
// Paketverzeichnis zur Laufzeit nicht zuverlässig auflösbar ist (siehe
// next.config.ts, serverExternalPackages).
import PDFDocument from "pdfkit/js/pdfkit.standalone";

/**
 * Erzeugt ein einfaches, geschäftsbrief-artiges PDF (Empfänger-Anschrift
 * oben links, optionaler Betreff fett, danach der Fließtext) aus bereits
 * fertig gerendertem Text (Platzhalter müssen vorher via
 * src/lib/templates.ts::renderTemplateText ersetzt worden sein - diese
 * Funktion kennt selbst keine Platzhalter).
 *
 * Bewusst sehr einfach gehalten (Standard-Font, keine Kopf-/Fußzeile mit
 * Absenderlogo o. Ä.) - kann bei Bedarf später erweitert werden.
 */
export function generateLetterPdf(options: { recipientLines: string[]; dateLine: string; subject?: string | null; body: string }): Promise<Buffer> {
	const { recipientLines, dateLine, subject, body } = options;

	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: "A4",
			margins: { top: 72, bottom: 72, left: 72, right: 72 },
		});

		const chunks: Buffer[] = [];
		doc.on("data", (chunk: Buffer) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		doc.font("Helvetica").fontSize(11);

		// Empfänger-Anschrift
		for (const line of recipientLines) {
			if (line) doc.text(line);
		}

		doc.moveDown(2);
		doc.text(dateLine, { align: "right" });
		doc.moveDown(2);

		if (subject) {
			doc.font("Helvetica-Bold").text(subject);
			doc.moveDown(1);
			doc.font("Helvetica");
		}

		doc.text(body, { align: "left", lineGap: 2 });

		doc.end();
	});
}
