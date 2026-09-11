"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { GenerateStatementPdfButton } from "@/components/abrechnung/generate-statement-pdf-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Zeile der finalisierten Einzelabrechnungen: eingefrorene Werte der
 * TenantStatement inkl. aufgelöstem Mieter-/Einheitsnamen.
 * Beträge als Decimal-Strings, saldo positiv = Nachzahlung, negativ = Guthaben.
 */
export type TenantStatementRow = {
	id: string;
	tenantId: string;
	tenantFirstName: string;
	tenantLastName: string;
	unitId: string;
	unitLabel: string;
	occupiedFrom: string;
	occupiedTo: string;
	occupiedDays: number;
	totalAllocatedCosts: string;
	totalPrepayments: string;
	balance: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
};

/** Tabelle der eingefrorenen Einzelabrechnungen einer finalisierten Periode inkl. PDF-Aktionen. */
export function TenantStatementsTable({ rows, postalConfigured }: { rows: TenantStatementRow[]; postalConfigured: boolean }) {
	const { t } = useI18n();

	const columns: DataTableColumn<TenantStatementRow>[] = [
		{
			key: "tenantUnit",
			header: t("billing.table.tenantUnit"),
			sortValue: (row) => `${row.tenantFirstName} ${row.tenantLastName}`,
			filter: { type: "text", value: (row) => `${row.tenantFirstName} ${row.tenantLastName} ${row.unitLabel}` },
			cell: (row) => (
				<span className="font-medium">
					<Link href={`/mieter#tenant-${row.tenantId}`} className="hover:underline">
						{row.tenantFirstName} {row.tenantLastName}
					</Link>
					<Link href={`/einheiten#unit-${row.unitId}`} className="block text-xs text-muted-foreground hover:underline">
						{row.unitLabel}
					</Link>
				</span>
			),
		},
		{
			key: "timeShare",
			header: t("billing.table.timeShare"),
			sortValue: (row) => row.occupiedFrom,
			filter: { type: "text", value: (row) => `${formatDate(row.occupiedFrom)} – ${formatDate(row.occupiedTo)}` },
			cell: (row) => (
				<span className="text-muted-foreground">
					{formatDate(row.occupiedFrom)} – {formatDate(row.occupiedTo)} ({row.occupiedDays} {t("billing.detail.days")})
				</span>
			),
		},
		{
			key: "allocatedCosts",
			header: t("billing.table.allocatedCosts"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.totalAllocatedCosts),
			cell: (row) => formatCurrency(row.totalAllocatedCosts),
		},
		{
			key: "prepayments",
			header: t("billing.table.prepayments"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.totalPrepayments),
			cell: (row) => formatCurrency(row.totalPrepayments),
		},
		{
			key: "balance",
			header: t("billing.table.balance"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.balance),
			cell: (row) => {
				const balanceEuros = Number(row.balance);
				return (
					<span className={`font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>
						{balanceEuros > 0
							? t("billing.detail.balancePayment", { amount: formatCurrency(balanceEuros) })
							: balanceEuros < 0
								? t("billing.detail.balanceCredit", { amount: formatCurrency(Math.abs(balanceEuros)) })
								: formatCurrency(0)}
					</span>
				);
			},
		},
		{
			key: "pdf",
			header: t("billing.table.pdf"),
			headClassName: "w-[220px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex justify-end">
					<GenerateStatementPdfButton tenantStatementId={row.id} pdfPath={row.pdfPath} pdfFileSize={row.pdfFileSize} postalConfigured={postalConfigured} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
