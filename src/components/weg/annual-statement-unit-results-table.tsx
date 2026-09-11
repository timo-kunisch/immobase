"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { BridgeToBetrKvDialog } from "@/components/weg/bridge-to-betrkv-dialog";
import { GenerateUnitResultPdfButton } from "@/components/weg/generate-unit-result-pdf-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/** Auswahloption der BetrKV-Brücke: Entwurfs-Abrechnungsperiode der Mietverwaltung. */
export type BillingPeriodOption = { id: string; periodFrom: string; periodTo: string };

/**
 * Zeile der eingefrorenen Einzelabrechnungen (finalisiert): Werte der
 * AnnualStatementUnitResult-Datensätze als Decimal-Strings inkl. serverseitig
 * aufgelösten Eigentümer-/Einheitsnamen und den für die BetrKV-Brücke
 * auswählbaren Entwurfs-Abrechnungsperioden der Liegenschaft der Einheit
 * (Maps sind als Client-Props nicht serialisierbar).
 */
export type AnnualStatementUnitResultRow = {
	id: string;
	ownerFirstName: string;
	ownerLastName: string;
	unitLabel: string;
	ownedFrom: string;
	ownedTo: string;
	ownedDays: number;
	/** Umgelegte Kosten (Decimal-String). */
	totalAllocatedCosts: string;
	/** Geleistete Vorauszahlungen (Decimal-String). */
	totalPrepayments: string;
	/** Saldo (Decimal-String): positiv = Nachzahlung, negativ = Guthaben. */
	balance: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
	availableBillingPeriods: BillingPeriodOption[];
};

/**
 * Tabelle der eingefrorenen Einzelabrechnungen einer finalisierten
 * Jahresabrechnung inkl. PDF-Aktionen (Erzeugen/Ansehen/Erneuern/Postversand)
 * und BetrKV-Brücke je Eigentümer-Zeitanteil.
 */
export function AnnualStatementUnitResultsTable({
	rows,
	hoaId,
	postalConfigured,
}: {
	rows: AnnualStatementUnitResultRow[];
	hoaId: string;
	/** Ob LetterXpress-Zugangsdaten hinterlegt sind (Einstellungen). */
	postalConfigured: boolean;
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<AnnualStatementUnitResultRow>[] = [
		{
			key: "ownerUnit",
			header: t("hoaStatement.table.ownerUnit"),
			sortValue: (row) => `${row.ownerFirstName} ${row.ownerLastName}`,
			filter: { type: "text", value: (row) => `${row.ownerFirstName} ${row.ownerLastName} ${row.unitLabel}` },
			cell: (row) => (
				<span className="font-medium">
					{row.ownerFirstName} {row.ownerLastName}
					<span className="block text-xs text-muted-foreground">{row.unitLabel}</span>
				</span>
			),
		},
		{
			key: "timeShare",
			header: t("hoaStatement.table.timeShare"),
			sortValue: (row) => row.ownedFrom,
			filter: { type: "text", value: (row) => `${formatDate(row.ownedFrom)} – ${formatDate(row.ownedTo)}` },
			cell: (row) => (
				<span className="text-muted-foreground">
					{formatDate(row.ownedFrom)} – {formatDate(row.ownedTo)} ({t("hoaStatement.results.days", { days: row.ownedDays })})
				</span>
			),
		},
		{
			key: "allocatedCosts",
			header: t("hoaStatement.table.allocatedCosts"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.totalAllocatedCosts),
			cell: (row) => formatCurrency(row.totalAllocatedCosts),
		},
		{
			key: "prepayments",
			header: t("hoaStatement.table.prepayments"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.totalPrepayments),
			cell: (row) => formatCurrency(row.totalPrepayments),
		},
		{
			key: "balance",
			header: t("hoaStatement.table.balance"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.balance),
			cell: (row) => {
				const balanceEuros = Number(row.balance);
				return (
					<span className={`font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>
						{balanceEuros > 0
							? t("hoaStatement.results.balanceDue", { amount: formatCurrency(balanceEuros) })
							: balanceEuros < 0
								? t("hoaStatement.results.balanceCredit", { amount: formatCurrency(Math.abs(balanceEuros)) })
								: formatCurrency(0)}
					</span>
				);
			},
		},
		{
			key: "pdf",
			header: t("hoaStatement.table.pdf"),
			headClassName: "text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex justify-end">
					<GenerateUnitResultPdfButton unitResultId={row.id} pdfPath={row.pdfPath} pdfFileSize={row.pdfFileSize} postalConfigured={postalConfigured} />
				</div>
			),
		},
		{
			key: "betrkv",
			header: t("hoaStatement.table.betrkv"),
			headClassName: "w-[80px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex justify-end">
					<BridgeToBetrKvDialog unitResultId={row.id} hoaId={hoaId} availableBillingPeriods={row.availableBillingPeriods} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}