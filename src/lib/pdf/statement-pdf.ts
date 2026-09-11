import PDFDocument from "pdfkit/js/pdfkit.standalone";

import { formatCurrency } from "@/lib/format";

/**
 * Geteiltes, generisches Layout für tabellarische Einzelabrechnungs-PDFs
 * (Kopf mit Absender/Empfänger/Betreff, Kostenpositionen-Tabelle mit
 * Seitenumbruch, Summenblock) - die fachlichen Hüllen sind:
 *  - src/lib/pdf/billing-statement.ts (Nebenkostenabrechnung, Mieter)
 *  - src/lib/pdf/hoa-annual-statement.ts (WEG-Jahresabrechnung, Eigentümer)
 * Beide sind fachlich dasselbe Dokumentmuster mit unterschiedlichen Texten
 * (Mieter/Eigentümer, Mietverhältnis/Eigentumszeitanteil) - das Layout
 * wird bewusst EINMAL hier gepflegt, statt es zu duplizieren (siehe
 * AGENTS.md: geteilte Logik statt Duplikate, wo fachlich identisch).
 *
 * Siehe src/lib/pdf/document.ts für die Begründung, warum hier bewusst die
 * "standalone"-Variante von pdfkit importiert wird (keine
 * fs.readFileSync-Nachladung von .afm-Dateien zur Laufzeit).
 */

export type StatementPdfLine = {
	label: string;
	/** Gesamtbetrag dieser Kostenposition für die gesamte Abrechnungsperiode (Euro, Decimal-String). */
	totalAmount: string;
	allocationKeyLabel: string;
	/** Anteil, der auf den Empfänger entfällt (Euro, Decimal-String). */
	shareAmount: string;
};

export type StatementPdfInput = {
	/** Absenderzeilen (Vermieter/Hausverwaltung/WEG-Verwalter), leer = kein Absenderblock. */
	senderLines: string[];
	/** Freitext mit weiteren Absender-Angaben (z. B. Bankverbindung), optional. */
	senderAdditional?: string | null;
	recipientLines: string[];
	/** Zeile rechtsbündig unter dem Empfängerblock (z. B. Ort, Datum). */
	dateLine: string;
	/** Fette Betreffzeile (z. B. "Nebenkostenabrechnung X für den Zeitraum ..."). */
	subjectLine: string;
	/** Einleitungssatz mit dem abgerechneten Zeitanteil. */
	occupancyLine: string;
	tableHeaders: { label: string; total: string; key: string; share: string };
	/** Text bei einer leeren Kostenpositionen-Tabelle. */
	emptyLinesText: string;
	lines: StatementPdfLine[];
	totalAllocatedCosts: string;
	totalPrepayments: string;
	/** positiv = Nachzahlung, negativ = Guthaben. */
	balance: string;
	summaryLabels: {
		allocatedCosts: string;
		prepayments: string;
		/** Betrag der Vorauszahlungs-Zeile wird negativ dargestellt (Minderung). */
		balanceDue: string;
		balanceCredit: string;
		balanceEqual: string;
	};
};

const PAGE_MARGIN = 56;
const COLUMN_WIDTHS = { label: 190, total: 85, key: 95, share: 85 };
const ROW_HEIGHT = 20;

export function generateStatementPdf(input: StatementPdfInput): Promise<Buffer> {
	const {
		senderLines,
		senderAdditional,
		recipientLines,
		dateLine,
		subjectLine,
		occupancyLine,
		tableHeaders,
		emptyLinesText,
		lines,
		totalAllocatedCosts,
		totalPrepayments,
		balance,
		summaryLabels,
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
		doc.font("Helvetica-Bold").fontSize(13).text(subjectLine);
		doc.font("Helvetica").fontSize(11);
		doc.moveDown(1);

		doc.text(occupancyLine, {
			lineGap: 2,
		});
		doc.moveDown(1.5);

		// ---------- Tabelle: Kostenpositionen ----------
		const columns = [
			{ key: "label", label: tableHeaders.label, width: COLUMN_WIDTHS.label, align: "left" as const },
			{ key: "total", label: tableHeaders.total, width: COLUMN_WIDTHS.total, align: "right" as const },
			{ key: "key", label: tableHeaders.key, width: COLUMN_WIDTHS.key, align: "left" as const },
			{ key: "share", label: tableHeaders.share, width: COLUMN_WIDTHS.share, align: "right" as const },
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

		// Zeilenhöhe je Kostenposition (Bezeichnung in einer Zeile).
		const LINE_ROW_HEIGHT = ROW_HEIGHT;

		if (lines.length === 0) {
			doc.fillColor("#666666").text(emptyLinesText);
			doc.fillColor("#000000");
		} else {
			for (const line of lines) {
				ensureSpace(ROW_HEIGHT);
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
				doc.text(formatCurrency(line.shareAmount), columnX(3), y, {
					width: columns[3].width,
					align: columns[3].align,
				});
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

		summaryRow(summaryLabels.allocatedCosts, totalAllocatedCostsNum);
		summaryRow(summaryLabels.prepayments, -totalPrepaymentsNum);

		ensureSpace(ROW_HEIGHT + 10);
		doc.moveDown(0.3);
		const balanceLabel = balanceNum > 0 ? summaryLabels.balanceDue : balanceNum < 0 ? summaryLabels.balanceCredit : summaryLabels.balanceEqual;
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