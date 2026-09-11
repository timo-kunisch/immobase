"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Zeile der Live-Vorschau der Einzelabrechnungen (Entwurf): berechnete
 * Ergebnisse je Eigentümer-Zeitanteil (siehe src/lib/hoa-annual-statement.ts)
 * inkl. serverseitig aufgelösten Eigentümer-/Einheitsnamen. Beträge in Cent.
 */
export type AnnualStatementDraftResultRow = {
	ownershipId: string;
	ownerName: string | null;
	unitLabel: string | null;
	ownedFrom: string;
	ownedTo: string;
	ownedDays: number;
	totalAllocatedCostsCents: number;
	totalPrepaymentsCents: number;
	/** Anzahl geleisteter (bezahlter) Vorauszahlungen im Zeitanteil (0 = Warnhinweis). */
	paidPrepaymentCount: number;
	/** umgelegte Kosten - Vorauszahlungen: positiv = Nachzahlung, negativ = Guthaben ("Abrechnungsspitze"). */
	balanceCents: number;
};

/** Live-Vorschau der Einzelabrechnungen im Entwurf - reine Anzeige, keine Aktionen. */
export function AnnualStatementDraftResultsTable({ rows }: { rows: AnnualStatementDraftResultRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<AnnualStatementDraftResultRow>[] = [
		{
			key: "ownerUnit",
			header: t("hoaStatement.table.ownerUnit"),
			sortValue: (row) => row.ownerName ?? "",
			filter: { type: "text", value: (row) => `${row.ownerName ?? ""} ${row.unitLabel ?? ""}` },
			cell: (row) => (
				<span className="font-medium">
					{row.ownerName ?? "–"}
					{row.unitLabel ? <span className="block text-xs text-muted-foreground">{row.unitLabel}</span> : null}
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
			sortValue: (row) => row.totalAllocatedCostsCents,
			cell: (row) => formatCurrency(row.totalAllocatedCostsCents / 100),
		},
		{
			key: "prepayments",
			header: t("hoaStatement.table.prepayments"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.totalPrepaymentsCents,
			cell: (row) => (
				<>
					{formatCurrency(row.totalPrepaymentsCents / 100)}
					{row.paidPrepaymentCount === 0 ? <span className="block text-xs text-amber-600">{t("hoaStatement.results.noPaidPrepayments")}</span> : null}
				</>
			),
		},
		{
			key: "balance",
			header: t("hoaStatement.table.balance"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.balanceCents,
			cell: (row) => {
				const balanceEuros = row.balanceCents / 100;
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
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.ownershipId} />;
}