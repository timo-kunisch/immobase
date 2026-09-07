// Siehe src/lib/pdf/document.ts für die Begründung, warum hier bewusst die
// "standalone"-Variante von pdfkit importiert wird (Cloudflare-Workers-
// Kompatibilität, keine fs.readFileSync-Nachladung von .afm-Dateien).
import PDFDocument from "pdfkit/js/pdfkit.standalone";

import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Erzeugt eine versandfertige Nebenkostenabrechnung (PDF) für einen
 * einzelnen Mieter/ein Mietverhältnis innerhalb einer Abrechnungsperiode.
 *
 * Bewusst eine eigenständige Funktion statt einer Erweiterung von
 * src/lib/pdf/document.ts::generateLetterPdf - diese Abrechnung braucht
 * ein tabellarisches Layout (Kostenpositionen mit mehreren Spalten,
 * Summenzeilen, Seitenumbrüche bei vielen Positionen), das mit dem
 * einfachen Fließtext-Brief nichts mehr gemein hat.
 *
 * Die Berechnung selbst (Kostenumlage, Saldo) übernimmt ausschließlich
 * src/lib/billing.ts::calculateBillingResult bzw. die daraus beim
 * Finalisieren gespeicherten TenantStatement/TenantStatementLine-
 * Datensätze - diese Funktion bekommt die bereits berechneten/
 * eingefrorenen Werte als einfache Eingabedaten übergeben und rendert sie
 * nur noch.
 */

export type BillingStatementLine = {
	label: string;
	categoryLabel: string;
	/** Gesamtbetrag dieser Kostenposition für die gesamte Abrechnungsperiode (Euro, Decimal-String). */
	totalAmount: string;
	allocationKeyLabel: string;
	/** Anteil, der auf diesen Mieter entfällt (Euro, Decimal-String). */
	tenantShare: string;
};

export type BillingStatementInput = {
	/** Absenderzeilen (Vermieter/Hausverwaltung), leer = kein Absenderblock. */
	senderLines: string[];
	/** Freitext mit weiteren Absender-Angaben (z. B. Bankverbindung), optional. */
	senderAdditional?: string | null;
	recipientLines: string[];
	dateLine: string;
	propertyName: string;
	periodFrom: Date;
	periodTo: Date;
	occupiedFrom: Date;
	occupiedTo: Date;
	occupiedDays: number;
	lines: BillingStatementLine[];
	totalAllocatedCosts: string;
	totalPrepayments: string;
	/** positiv = Nachzahlung, negativ = Guthaben. */
	balance: string;
};

const PAGE_MARGIN = 56;
const COLUMN_WIDTHS = { label: 190, total: 85, key: 95, share: 85 };
const ROW_HEIGHT = 20;

export function generateBillingStatementPdf(input: BillingStatementInput): Promise<Buffer> {
	const {
		senderLines,
		senderAdditional,
		recipientLines,
		dateLine,
		propertyName,
		periodFrom,
		periodTo,
		occupiedFrom,
		occupiedTo,
		occupiedDays,
		lines,
		totalAllocatedCosts,
		totalPrepayments,
		balance,
	} = input;

	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: "A4",
			margins: {
				top: PAGE_MARGIN,
				bottom: PAGE_MARGIN,
				left: PAGE_MARGIN,
				right: PAGE_MARGIN,
			},
		});

		const chunks: Buffer[] = [];
		doc.on("data", (chunk: Buffer) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		const contentLeft = doc.page.margins.left;
		const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
		const bottomLimit = doc.page.height - doc.page.margins.bottom;

		doc.font("Helvetica").fontSize(9);

		// ---------- Absenderzeile (klein, oben) ----------
		if (senderLines.length > 0) {
			doc.fillColor("#555555").text(senderLines.join(" · "));
			doc.fillColor("#000000");
		}

		doc.moveDown(1.5);
		doc.fontSize(11);

		// ---------- Empfänger-Anschrift ----------
		for (const line of recipientLines) {
			if (line) doc.text(line);
		}

		doc.moveDown(2);
		doc.text(dateLine, { align: "right" });
		doc.moveDown(1.5);

		// ---------- Betreff ----------
		doc
			.font("Helvetica-Bold")
			.fontSize(13)
			.text(`Nebenkostenabrechnung ${propertyName} für den Zeitraum ${formatDate(periodFrom)} – ${formatDate(periodTo)}`);
		doc.font("Helvetica").fontSize(11);
		doc.moveDown(1);

		doc.text(`Ihr Mietverhältnis wurde im Abrechnungszeitraum vom ${formatDate(occupiedFrom)} bis ${formatDate(occupiedTo)} berücksichtigt (${occupiedDays} Tage).`, {
			lineGap: 2,
		});
		doc.moveDown(1.5);

		// ---------- Tabelle: Kostenpositionen ----------
		const columns = [
			{ key: "label", label: "Kostenart", width: COLUMN_WIDTHS.label, align: "left" as const },
			{ key: "total", label: "Gesamtbetrag", width: COLUMN_WIDTHS.total, align: "right" as const },
			{ key: "key", label: "Umlageschlüssel", width: COLUMN_WIDTHS.key, align: "left" as const },
			{ key: "share", label: "Ihr Anteil", width: COLUMN_WIDTHS.share, align: "right" as const },
		];

		function columnX(index: number): number {
			let x = contentLeft;
			for (let i = 0; i < index; i += 1) x += columns[i].width;
			return x;
		}

		function drawTableHeader() {
			doc.font("Helvetica-Bold").fontSize(9.5);
			const y = doc.y;
			columns.forEach((column, index) => {
				doc.text(column.label, columnX(index), y, {
					width: column.width,
					align: column.align,
				});
			});
			doc.moveDown(0.6);
			doc.moveTo(contentLeft, doc.y).lineTo(contentLeft + contentWidth, doc.y).lineWidth(0.5).strokeColor("#999999").stroke();
			doc.moveDown(0.4);
			doc.font("Helvetica").fontSize(9.5);
		}

		function ensureSpace(neededHeight: number) {
			if (doc.y + neededHeight > bottomLimit) {
				doc.addPage();
				drawTableHeader();
			}
		}

		drawTableHeader();

		// Jede Zeile besteht aus zwei Textzeilen (Bezeichnung + darunter die
		// Kostenart nach § 2 BetrKV in klein/grau) - daher etwas mehr als
		// ROW_HEIGHT an Platz je Position einplanen.
		const LINE_ROW_HEIGHT = ROW_HEIGHT + 11;

		if (lines.length === 0) {
			doc.fillColor("#666666").text("Keine Kostenpositionen vorhanden.");
			doc.fillColor("#000000");
		} else {
			for (const line of lines) {
				ensureSpace(LINE_ROW_HEIGHT);
				const y = doc.y;
				doc.text(line.label, columnX(0), y, {
					width: columns[0].width,
					align: columns[0].align,
				});
				doc.text(formatCurrency(line.totalAmount), columnX(1), y, {
					width: columns[1].width,
					align: columns[1].align,
				});
				doc.text(line.allocationKeyLabel, columnX(2), y, {
					width: columns[2].width,
					align: columns[2].align,
				});
				doc.text(formatCurrency(line.tenantShare), columnX(3), y, {
					width: columns[3].width,
					align: columns[3].align,
				});
				doc
					.fontSize(8)
					.fillColor("#666666")
					.text(line.categoryLabel, columnX(0), y + 12, {
						width: columns[0].width,
						align: columns[0].align,
					});
				doc.fillColor("#000000").fontSize(9.5);
				doc.y = y + LINE_ROW_HEIGHT;
			}
		}

		ensureSpace(ROW_HEIGHT * 4 + 20);

		doc.moveDown(0.3);
		doc.moveTo(contentLeft, doc.y).lineTo(contentLeft + contentWidth, doc.y).lineWidth(0.5).strokeColor("#999999").stroke();
		doc.moveDown(0.6);

		// ---------- Summenblock ----------
		function summaryRow(label: string, amount: number, bold = false) {
			ensureSpace(ROW_HEIGHT);
			const y = doc.y;
			doc.font(bold ? "Helvetica-Bold" : "Helvetica");
			doc.text(label, contentLeft, y, {
				width: contentWidth - COLUMN_WIDTHS.share,
				align: "right",
			});
			doc.text(formatCurrency(amount), contentLeft + contentWidth - COLUMN_WIDTHS.share, y, {
				width: COLUMN_WIDTHS.share,
				align: "right",
			});
			doc.font("Helvetica");
			doc.moveDown(1);
		}

		const totalAllocatedCostsNum = Number(totalAllocatedCosts);
		const totalPrepaymentsNum = Number(totalPrepayments);
		const balanceNum = Number(balance);

		summaryRow("Summe umgelegte Kosten", totalAllocatedCostsNum);
		summaryRow("Ihre Vorauszahlungen im Zeitraum", -totalPrepaymentsNum);

		ensureSpace(ROW_HEIGHT + 10);
		doc.moveDown(0.3);
		const balanceLabel = balanceNum > 0 ? "Nachzahlung" : balanceNum < 0 ? "Guthaben" : "Saldo (ausgeglichen)";
		const balanceAmount = Math.abs(balanceNum);

		doc.font("Helvetica-Bold").fontSize(12);
		const y = doc.y;
		doc.text(balanceLabel, contentLeft, y, {
			width: contentWidth - COLUMN_WIDTHS.share,
			align: "right",
		});
		doc.text(formatCurrency(balanceAmount), contentLeft + contentWidth - COLUMN_WIDTHS.share, y, { width: COLUMN_WIDTHS.share, align: "right" });
		doc.font("Helvetica").fontSize(11);
		doc.moveDown(2);

		// ---------- Absender-Zusatzangaben (Bankverbindung etc.) ----------
		if (senderAdditional) {
			ensureSpace(60);
			doc.fontSize(9).fillColor("#555555").text(senderAdditional, {
				lineGap: 2,
			});
			doc.fillColor("#000000").fontSize(11);
		}

		doc.end();
	});
}
