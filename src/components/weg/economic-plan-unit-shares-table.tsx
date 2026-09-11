"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Normalisierte Zeile der Einzelwirtschaftsplan-Tabelle - speist sowohl die
 * Live-Vorschau im Entwurf (berechnete Ergebnisse) als auch die nach der
 * Finalisierung eingefrorenen Ergebnisse mit identischen Spalten. Beträge
 * liegen als Decimal-Strings vor, die Bezeichnung der Einheit wird
 * serverseitig aufgelöst.
 */
export type EconomicPlanUnitShareRow = {
	/** Stabiler React-Key (Entwurf: Einheits-ID, finalisiert: Zeilen-ID). */
	key: string;
	unitLabel: string;
	annualAmount: string;
	monthlyAmount: string;
};

export function EconomicPlanUnitSharesTable({ rows }: { rows: EconomicPlanUnitShareRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<EconomicPlanUnitShareRow>[] = [
		{
			key: "unit",
			header: t("common.unit"),
			sortValue: (row) => row.unitLabel,
			filter: { type: "text", value: (row) => row.unitLabel },
			cell: (row) => <span className="font-medium">{row.unitLabel}</span>,
		},
		{
			key: "annualAmount",
			header: t("hoaPlan.table.annualAmount"),
			align: "right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.annualAmount),
			cell: (row) => formatCurrency(row.annualAmount),
		},
		{
			key: "monthlyAmount",
			header: t("hoaPlan.table.monthlyAmount"),
			align: "right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.monthlyAmount),
			cell: (row) => formatCurrency(row.monthlyAmount),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.key} />;
}
