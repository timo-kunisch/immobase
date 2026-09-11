"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DepositFormDialog } from "@/components/finanzen/deposit-form-dialog";
import type { LeaseWithDetails } from "@/data/leases";
import type { DepositStatus } from "@/data/types";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/** Farbstile der Kautionsstatus-Badges (Enum DepositStatus). */
const depositStatusStyles: Record<string, string> = {
	PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	PARTIALLY_REFUNDED: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	REFUNDED: "bg-muted text-muted-foreground",
};

/** Filter-Optionen der Status-Spalte: Kautionsstatus-Werte. */
const depositStatuses: DepositStatus[] = ["PENDING", "RECEIVED", "PARTIALLY_REFUNDED", "REFUNDED"];

/**
 * Kautionskonten-Tabelle (/finanzen, Tab "Kautionen"): eine Zeile je
 * Mietvertrag inkl. dessen Kautionskonto, clientseitig sortier-/filterbar.
 */
export function DepositsTable({ rows }: { rows: LeaseWithDetails[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<LeaseWithDetails>[] = [
		{
			key: "tenantUnit",
			header: t("finances.table.tenantUnit"),
			sortValue: (row) => `${row.tenant.firstName} ${row.tenant.lastName}`,
			filter: {
				type: "text",
				value: (row) => `${row.tenant.firstName} ${row.tenant.lastName} ${row.unit.property.name} – ${row.unit.label}`,
			},
			cell: (row) => (
				<span className="font-medium">
					<Link href={`/mieter#tenant-${row.tenantId}`} className="hover:underline">
						{row.tenant.firstName} {row.tenant.lastName}
					</Link>
					<Link href={`/einheiten#unit-${row.unitId}`} className="block text-xs text-muted-foreground hover:underline">
						{row.unit.property.name} – {row.unit.label}
					</Link>
				</span>
			),
		},
		{
			key: "depositContract",
			header: t("finances.table.depositContract"),
			align: "right",
			headClassName: "text-right",
			sortValue: (row) => (row.deposit ? Number(row.deposit) : null),
			cell: (row) => <span className="text-right text-muted-foreground">{formatCurrency(row.deposit)}</span>,
		},
		{
			key: "depositAccount",
			header: t("finances.table.depositAccount"),
			align: "right",
			headClassName: "text-right",
			sortValue: (row) => (row.depositAccount ? Number(row.depositAccount.amount) : null),
			cell: (row) => <span className="text-right">{row.depositAccount ? formatCurrency(row.depositAccount.amount) : "–"}</span>,
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.depositAccount?.status ?? "",
			filter: {
				type: "select",
				value: (row) => row.depositAccount?.status ?? "NONE",
				options: [
					...depositStatuses.map((value) => ({ value, label: t(`finances.depositStatus.${value}`) })),
					{ value: "NONE", label: t("finances.deposit.notRecorded") },
				],
			},
			cell: (row) =>
				row.depositAccount ? (
					<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${depositStatusStyles[row.depositAccount.status]}`}>
						{t(`finances.depositStatus.${row.depositAccount.status}`)}
					</span>
				) : (
					<span className="text-xs text-muted-foreground">{t("finances.deposit.notRecorded")}</span>
				),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<DepositFormDialog
						leaseId={row.id}
						leaseLabel={`${row.tenant.firstName} ${row.tenant.lastName} · ${row.unit.property.name} – ${row.unit.label}`}
						deposit={row.depositAccount ?? undefined}
						suggestedAmount={row.deposit ?? undefined}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
