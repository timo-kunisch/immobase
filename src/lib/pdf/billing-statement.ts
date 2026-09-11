import { formatDate } from "@/lib/format";
import { generateStatementPdf } from "@/lib/pdf/statement-pdf";

/**
 * Erzeugt eine versandfertige Nebenkostenabrechnung (PDF) für einen
 * einzelnen Mieter/ein Mietverhältnis innerhalb einer Abrechnungsperiode.
 *
 * Das tabellarische Layout (Kopf, Kostenpositionen-Tabelle, Summenblock)
 * liegt geteilt in src/lib/pdf/statement-pdf.ts - diese Datei ist die
 * fachliche Hülle der MIETVERWALTUNG (Texte: Mieter, Mietverhältnis,
 * Vorauszahlungen). Die Schwester-Hülle für die WEG-Verwaltung ist
 * src/lib/pdf/hoa-annual-statement.ts.
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

export function generateBillingStatementPdf(input: BillingStatementInput): Promise<Buffer> {
	const { propertyName, periodFrom, periodTo, occupiedFrom, occupiedTo, occupiedDays, ...rest } = input;

	return generateStatementPdf({
		...rest,
		subjectLine: `Nebenkostenabrechnung ${propertyName} für den Zeitraum ${formatDate(periodFrom)} – ${formatDate(periodTo)}`,
		occupancyLine: `Ihr Mietverhältnis wurde im Abrechnungszeitraum vom ${formatDate(occupiedFrom)} bis ${formatDate(occupiedTo)} berücksichtigt (${occupiedDays} Tage).`,
		tableHeaders: {
			label: "Kostenart",
			total: "Gesamtbetrag",
			key: "Umlageschlüssel",
			share: "Ihr Anteil",
		},
		emptyLinesText: "Keine Kostenpositionen vorhanden.",
		lines: rest.lines.map((line) => ({
			label: line.label,
			totalAmount: line.totalAmount,
			allocationKeyLabel: line.allocationKeyLabel,
			shareAmount: line.tenantShare,
		})),
		summaryLabels: {
			allocatedCosts: "Summe umgelegte Kosten",
			prepayments: "Ihre Vorauszahlungen im Zeitraum",
			balanceDue: "Nachzahlung",
			balanceCredit: "Guthaben",
			balanceEqual: "Saldo (ausgeglichen)",
		},
	});
}