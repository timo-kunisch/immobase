import { formatDate } from "@/lib/format";
import { generateStatementPdf } from "@/lib/pdf/statement-pdf";

/**
 * Erzeugt eine versandfertige Einzelabrechnung (PDF) der WEG-Jahresabrechnung
 * für einen Eigentümer-Zeitanteil einer Einheit (Hausgeldabrechnung,
 * § 28 Abs. 2 WEG).
 *
 * Das tabellarische Layout liegt geteilt in src/lib/pdf/statement-pdf.ts -
 * diese Datei ist die fachliche Hülle der WEG-VERWALTUNG (Texte: Eigentümer,
 * Eigentumszeitanteil, Hausgeld-Vorauszahlungen). Die Schwester-Hülle für
 * die Mietverwaltung ist src/lib/pdf/billing-statement.ts.
 *
 * Die Berechnung selbst (Kostenumlage nach § 16 WEG, Abrechnungsspitze)
 * übernimmt ausschließlich src/lib/hoa-annual-statement.ts bzw. die daraus
 * beim Finalisieren gespeicherten AnnualStatementUnitResult(-Line)-
 * Datensätze - diese Funktion bekommt die bereits berechneten/eingefrorenen
 * Werte als einfache Eingabedaten übergeben und rendert sie nur noch.
 */

export type HoaAnnualStatementLine = {
	label: string;
	/** Gesamtbetrag dieser Kostenposition für die gesamte Abrechnungsperiode (Euro, Decimal-String). */
	totalAmount: string;
	allocationKeyLabel: string;
	/** Anteil, der auf diesen Eigentümer-Zeitanteil entfällt (Euro, Decimal-String). */
	ownerShare: string;
};

export type HoaAnnualStatementPdfInput = {
	/** Absenderzeilen (Verwalter, aus company_settings), leer = kein Absenderblock. */
	senderLines: string[];
	/** Freitext mit weiteren Absender-Angaben (z. B. Bankverbindung der WEG), optional. */
	senderAdditional?: string | null;
	recipientLines: string[];
	dateLine: string;
	/** Name der WEG (Betreffzeile des PDFs). */
	hoaName: string;
	/** Bezeichnung der Eigentümereinheit (Einleitungssatz). */
	unitLabel: string;
	periodFrom: Date;
	periodTo: Date;
	ownedFrom: Date;
	ownedTo: Date;
	ownedDays: number;
	lines: HoaAnnualStatementLine[];
	totalAllocatedCosts: string;
	totalPrepayments: string;
	/** positiv = Nachzahlung, negativ = Guthaben ("Abrechnungsspitze"). */
	balance: string;
};

export function generateHoaAnnualStatementPdf(input: HoaAnnualStatementPdfInput): Promise<Buffer> {
	const { hoaName, unitLabel, periodFrom, periodTo, ownedFrom, ownedTo, ownedDays, ...rest } = input;

	return generateStatementPdf({
		...rest,
		subjectLine: `Hausgeldabrechnung ${hoaName} für den Zeitraum ${formatDate(periodFrom)} – ${formatDate(periodTo)}`,
		occupancyLine: `Sie waren im Abrechnungszeitraum vom ${formatDate(ownedFrom)} bis ${formatDate(ownedTo)} Eigentümer der Einheit ${unitLabel} (${ownedDays} Tage).`,
		tableHeaders: {
			label: "Kostenposition",
			total: "Gesamtbetrag",
			key: "Verteilerschlüssel",
			share: "Ihr Anteil",
		},
		emptyLinesText: "Keine Kostenpositionen vorhanden.",
		lines: rest.lines.map((line) => ({
			label: line.label,
			totalAmount: line.totalAmount,
			allocationKeyLabel: line.allocationKeyLabel,
			shareAmount: line.ownerShare,
		})),
		summaryLabels: {
			allocatedCosts: "Summe umgelegte Kosten",
			prepayments: "Ihre Hausgeld-Vorauszahlungen im Zeitraum",
			balanceDue: "Nachzahlung",
			balanceCredit: "Guthaben",
			balanceEqual: "Saldo (ausgeglichen)",
		},
	});
}