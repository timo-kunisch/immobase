"use client";

import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MarkPaidButton } from "@/components/finanzen/mark-paid-button";
import { TransactionFormDialog } from "@/components/finanzen/transaction-form-dialog";
import type { LeaseWithDetails } from "@/data/leases";
import type { TransactionWithLease } from "@/data/transactions";
import type { TransactionStatus } from "@/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

import { deleteTransactionAction } from "@/app/(app)/finanzen/actions";

/** Farbstile der Zahlungsstatus-Badges (Enum TransactionStatus). */
const transactionStatusStyles: Record<string, string> = {
	OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	OVERDUE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	CANCELLED: "bg-muted text-muted-foreground",
};

/** Filter-Optionen der Status-Spalte (alle gültigen Zahlungsstatus). */
const transactionStatuses: TransactionStatus[] = ["OPEN", "PAID", "OVERDUE", "CANCELLED"];

/**
 * Mieteingangs-Tabelle (/finanzen, Tab "Mieteingänge"): clientseitige
 * Sortierung/Filterung inkl. Status-Select-Filter und Client-Pagination
 * (50/Seite) - die Server-Seite lädt die vollständige Liste.
 */
export function TransactionsTable({ rows, leases }: { rows: TransactionWithLease[]; leases: LeaseWithDetails[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<TransactionWithLease>[] = [
		{
			key: "tenantUnit",
			header: t("finances.table.tenantUnit"),
			sortValue: (row) => `${row.lease.tenant.firstName} ${row.lease.tenant.lastName}`,
			filter: {
				type: "text",
				value: (row) =>
					`${row.lease.tenant.firstName} ${row.lease.tenant.lastName} ${row.lease.unit.property.name} – ${row.lease.unit.label}`,
			},
			cell: (row) => (
				<span className="font-medium">
					<Link href={`/mieter#tenant-${row.lease.tenantId}`} className="hover:underline">
						{row.lease.tenant.firstName} {row.lease.tenant.lastName}
					</Link>
					<Link href={`/einheiten#unit-${row.lease.unitId}`} className="block text-xs text-muted-foreground hover:underline">
						{row.lease.unit.property.name} – {row.lease.unit.label}
					</Link>
				</span>
			),
		},
		{
			key: "purpose",
			header: t("finances.table.purpose"),
			sortValue: (row) => row.purpose ?? "",
			filter: { type: "text", value: (row) => row.purpose ?? "" },
			cell: (row) => <span className="text-muted-foreground">{row.purpose ?? "–"}</span>,
		},
		{
			key: "dueDate",
			header: t("finances.table.dueDate"),
			sortValue: (row) => row.dueDate,
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.dueDate)}</span>,
		},
		{
			key: "amount",
			header: t("common.amount"),
			align: "right",
			headClassName: "text-right",
			sortValue: (row) => Number(row.amount),
			cell: (row) => <span className="text-right">{formatCurrency(row.amount)}</span>,
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: transactionStatuses.map((value) => ({ value, label: t(`finances.status.${value}`) })),
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${transactionStatusStyles[row.status]}`}>
					{t(`finances.status.${row.status}`)}
				</span>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[120px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					{row.status !== "PAID" ? <MarkPaidButton transactionId={row.id} /> : null}
					<TransactionFormDialog transaction={row} leases={leases} />
					<ConfirmDeleteButton action={deleteTransactionAction.bind(null, row.id)} confirmMessage={t("finances.confirm.deleteTransaction")} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} pageSize={LIST_PAGE_SIZE} />;
}
