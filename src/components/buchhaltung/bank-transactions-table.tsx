"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { BankTransactionAllocateDialog, type OpenTransactionOption } from "@/components/buchhaltung/bank-transaction-allocate-dialog";
import { EditBankTransactionDialog } from "@/components/buchhaltung/bank-transaction-form-dialog";
import type { AccountWithStats } from "@/data/accounts";
import type { BankTransactionWithAllocations } from "@/data/bank-transactions";
import type { BankTransactionStatus } from "@/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

import { deleteBankTransactionAction } from "@/app/(app)/buchhaltung/actions";

/** Farbstile der Zuordnungsstatus-Badges (Enum BankTransactionStatus). */
const bankTransactionStatusStyles: Record<BankTransactionStatus, string> = {
	OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	RECONCILED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

/** Filter-Optionen der Status-Spalte (alle gültigen Zuordnungsstatus). */
const bankTransactionStatuses: BankTransactionStatus[] = ["OPEN", "PARTIAL", "RECONCILED"];

/**
 * Banktransaktions-Tabelle (/buchhaltung, Tab "Banktransaktionen"):
 * clientseitige Sortierung/Filterung inkl. Status-Select-Filter und
 * Client-Pagination (50/Seite); Konten und offene Sollstellungen kommen
 * als Props aus der Server-Seite (für den Zuordnen-Dialog).
 */
export function BankTransactionsTable({
	rows,
	accounts,
	openTransactions,
}: {
	rows: BankTransactionWithAllocations[];
	accounts: AccountWithStats[];
	openTransactions: OpenTransactionOption[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<BankTransactionWithAllocations>[] = [
		{
			key: "bookingDate",
			header: t("banking.table.bookingDate"),
			sortValue: (row) => row.bookingDate,
			cell: (row) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.bookingDate)}</span>,
		},
		{
			key: "description",
			header: t("banking.table.description"),
			sortValue: (row) => row.description,
			filter: { type: "text", value: (row) => `${row.description} ${row.partner ?? ""}` },
			cell: (row) => (
				<span className="font-medium">
					{row.description}
					{row.partner ? <span className="block text-xs text-muted-foreground">{row.partner}</span> : null}
				</span>
			),
		},
		{
			key: "amount",
			header: t("common.amount"),
			align: "right",
			headClassName: "text-right",
			sortValue: (row) => Number(row.amount),
			cell: (row) => (
				<span className={`text-right font-medium ${Number(row.amount) < 0 ? "text-red-600" : "text-emerald-600"}`}>
					{formatCurrency(row.amount)}
				</span>
			),
		},
		{
			key: "allocatedTo",
			header: t("banking.table.allocatedTo"),
			cell: (row) =>
				row.allocations.length === 0 ? (
					<span className="text-muted-foreground">–</span>
				) : (
					<span className="block space-y-0.5">
						{row.allocations.map((allocation) => (
							<span key={allocation.id} className="block text-xs">
								{formatCurrency(allocation.amount)} → {allocation.account?.label ?? allocation.transactionLabel ?? allocation.housingChargeLabel ?? "–"}
							</span>
						))}
					</span>
				),
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: bankTransactionStatuses.map((value) => ({ value, label: t(`banking.status.${value}`) })),
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bankTransactionStatusStyles[row.status]}`}>
					{t(`banking.status.${row.status}`)}
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
					<BankTransactionAllocateDialog
						bankTransaction={{
							id: row.id,
							description: row.description,
							amount: row.amount,
							bookingDate: row.bookingDate,
							allocations: row.allocations.map((allocation) => ({
								accountId: allocation.accountId,
								transactionId: allocation.transactionId,
								housingChargeId: allocation.housingChargeId,
								amount: allocation.amount,
							})),
						}}
						accounts={accounts}
						openTransactions={openTransactions}
					/>
					<EditBankTransactionDialog
						transaction={{
							id: row.id,
							bookingDate: row.bookingDate,
							amount: row.amount,
							description: row.description,
							partner: row.partner,
							notes: row.notes,
						}}
						propertyId={row.propertyId}
					/>
					<ConfirmDeleteButton
						action={deleteBankTransactionAction.bind(null, row.id)}
						confirmMessage={t("banking.confirm.deleteTransaction", { description: row.description })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} pageSize={LIST_PAGE_SIZE} />;
}
