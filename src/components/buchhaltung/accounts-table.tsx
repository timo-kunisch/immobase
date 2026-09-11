"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { AccountFormDialog } from "@/components/buchhaltung/account-form-dialog";
import type { AccountWithStats } from "@/data/accounts";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteAccountAction } from "@/app/(app)/buchhaltung/actions";

/**
 * Konten-Tabelle (/buchhaltung, Tab "Konten"): Kontenrahmen einer
 * Liegenschaft inkl. Buchungs-Statistik, clientseitig sortier-/filterbar.
 */
export function AccountsTable({ rows, propertyId }: { rows: AccountWithStats[]; propertyId: string }) {
	const { t } = useI18n();

	const columns: DataTableColumn<AccountWithStats>[] = [
		{
			key: "account",
			header: t("banking.table.account"),
			sortValue: (row) => row.label,
			filter: { type: "text", value: (row) => row.label },
			cell: (row) => <span className="font-medium">{row.label}</span>,
		},
		{
			key: "notes",
			header: t("common.notes"),
			sortValue: (row) => row.notes ?? "",
			filter: { type: "text", value: (row) => row.notes ?? "" },
			cell: (row) => <span className="text-muted-foreground">{row.notes ?? "–"}</span>,
		},
		{
			key: "allocatedAmount",
			header: t("banking.table.allocatedAmount"),
			align: "right",
			headClassName: "text-right",
			sortValue: (row) => Number(row.allocatedAmount),
			cell: (row) => (
				<span className={`text-right ${Number(row.allocatedAmount) < 0 ? "text-red-600" : "text-emerald-600"}`}>
					{formatCurrency(row.allocatedAmount)}
				</span>
			),
		},
		{
			key: "bookings",
			header: t("banking.table.bookings"),
			align: "right",
			headClassName: "text-right",
			sortValue: (row) => row.bookingCount,
			cell: (row) => <span className="text-right text-muted-foreground">{row.bookingCount}</span>,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<AccountFormDialog propertyId={propertyId} account={row} />
					<ConfirmDeleteButton
						action={deleteAccountAction.bind(null, row.id)}
						confirmMessage={t("banking.confirm.deleteAccount", { label: row.label })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
