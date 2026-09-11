"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Zeile der Live-Vorschau der Mieter-Abrechnungen (Entwurfs-Periode):
 * Berechnungsergebnis inkl. aufgelöstem Mieter-/Einheitsnamen.
 * Beträge in Cent, saldo positiv = Nachzahlung, negativ = Guthaben.
 */
export type LeasePreviewRow = {
	leaseId: string;
	tenantId: string | null;
	tenantFirstName: string | null;
	tenantLastName: string | null;
	unitId: string;
	unitLabel: string | null;
	occupiedFrom: string;
	occupiedTo: string;
	occupiedDays: number;
	totalAllocatedCostsCents: number;
	totalPrepaymentsCents: number;
	paidPrepaymentCount: number;
	balanceCents: number;
};

/** Live-Vorschau der Mieter-Abrechnungen einer Entwurfs-Periode (jedes Rendern neu berechnet, serverseitig). */
export function LeasePreviewTable({ rows }: { rows: LeasePreviewRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<LeasePreviewRow>[] = [
		{
			key: "tenantUnit",
			header: t("billing.table.tenantUnit"),
			sortValue: (row) => `${row.tenantFirstName ?? ""} ${row.tenantLastName ?? ""}`.trim(),
			filter: { type: "text", value: (row) => `${row.tenantFirstName ?? ""} ${row.tenantLastName ?? ""} ${row.unitLabel ?? ""}` },
			cell: (row) => (
				<span className="font-medium">
					{row.tenantId ? (
						<Link href={`/mieter#tenant-${row.tenantId}`} className="hover:underline">
							{row.tenantFirstName} {row.tenantLastName}
						</Link>
					) : null}
					{row.unitLabel ? (
						<Link href={`/einheiten#unit-${row.unitId}`} className="block text-xs text-muted-foreground hover:underline">
							{row.unitLabel}
						</Link>
					) : null}
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
			sortValue: (row) => row.totalAllocatedCostsCents,
			cell: (row) => formatCurrency(row.totalAllocatedCostsCents / 100),
		},
		{
			key: "prepayments",
			header: t("billing.table.prepayments"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.totalPrepaymentsCents,
			cell: (row) => (
				<>
					{formatCurrency(row.totalPrepaymentsCents / 100)}
					{row.paidPrepaymentCount === 0 ? (
						<span className="block text-xs text-amber-600 dark:text-amber-400">{t("billing.detail.noPaidPrepayments")}</span>
					) : null}
				</>
			),
		},
		{
			key: "balance",
			header: t("billing.table.balance"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.balanceCents,
			cell: (row) => {
				const balanceEuros = row.balanceCents / 100;
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
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.leaseId} />;
}
