"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ReserveFundBookingFormDialog } from "@/components/weg/reserve-fund-booking-form-dialog";
import type { ReserveFundBooking, ReserveFundBookingType } from "@/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteReserveFundBookingAction } from "@/app/(app)/weg/ruecklage/actions";

/**
 * Zeile des Rücklagen-Kontobuchs: Buchung angereichert um den Betrag in Cent
 * und den vorzeichenrichtigen laufenden Saldo NACH dieser Buchung (Cent, aus
 * buildReserveFundLedger in src/lib/hoa-reserve.ts). Die chronologische
 * Reihenfolge des Kontobuchs liefert die Server-Seite als Anfangsreihenfolge.
 */
export type ReserveFundBookingRow = ReserveFundBooking & {
	amountCents: number;
	balanceCents: number;
};

/** Filter-Optionen der Buchungsart-Spalte (Enum ReserveFundBookingType). */
const reserveFundBookingTypes: ReserveFundBookingType[] = ["CONTRIBUTION", "WITHDRAWAL"];

/**
 * Rücklagen-Kontobuch mit laufendem Saldo (/weg/ruecklage): clientseitige
 * Sortierung/Filterung inkl. Buchungsart-Select-Filter. Datums- und
 * Saldo-Spalten sind numerisch bzw. nach dem ISO-Rohwert sortierbar.
 */
export function ReserveFundBookingsTable({ rows, hoaId }: { rows: ReserveFundBookingRow[]; hoaId: string }) {
	const { t } = useI18n();

	const columns: DataTableColumn<ReserveFundBookingRow>[] = [
		{
			key: "bookingDate",
			header: t("common.date"),
			sortValue: (row) => row.bookingDate,
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.bookingDate)}</span>,
		},
		{
			key: "description",
			header: t("hoaFinance.reserve.table.description"),
			sortValue: (row) => row.description,
			filter: { type: "text", value: (row) => row.description },
			cell: (row) => <span className="font-medium">{row.description}</span>,
		},
		{
			key: "type",
			header: t("hoaFinance.reserve.table.type"),
			sortValue: (row) => t(`hoaFinance.reserve.bookingType.${row.type}`),
			filter: {
				type: "select",
				value: (row) => row.type,
				options: reserveFundBookingTypes.map((value) => ({ value, label: t(`hoaFinance.reserve.bookingType.${value}`) })),
			},
			cell: (row) => <span className="text-muted-foreground">{t(`hoaFinance.reserve.bookingType.${row.type}`)}</span>,
		},
		{
			key: "amount",
			header: t("common.amount"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.amountCents,
			cell: (row) => (
				<span className={row.type === "WITHDRAWAL" ? "text-red-600" : "text-emerald-600"}>
					{row.type === "WITHDRAWAL" ? "−" : "+"}
					{formatCurrency(row.amountCents / 100)}
				</span>
			),
		},
		{
			key: "balance",
			header: t("hoaFinance.reserve.table.balance"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.balanceCents,
			cell: (row) => <span className="font-medium">{formatCurrency(row.balanceCents / 100)}</span>,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<ReserveFundBookingFormDialog hoaId={hoaId} booking={row} />
					<ConfirmDeleteButton
						action={deleteReserveFundBookingAction.bind(null, row.id, hoaId)}
						confirmMessage={t("hoaFinance.reserve.confirm.delete")}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}