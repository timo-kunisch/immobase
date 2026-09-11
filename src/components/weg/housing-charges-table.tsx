"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { HousingChargeFormDialog } from "@/components/weg/housing-charge-form-dialog";
import { MarkHousingChargePaidButton } from "@/components/weg/mark-housing-charge-paid-button";
import type { HousingChargeWithRelations } from "@/data/housing-charges";
import type { HousingChargeStatus, Owner, Unit } from "@/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

import { deleteHousingChargeAction } from "@/app/(app)/weg/hausgeld/actions";

/** Zeile der Hausgeld-Tabelle: Sollstellung inkl. Einheit, Eigentümer und zugehöriger WEG. */
export type HousingChargeRow = HousingChargeWithRelations;

/** Farbstile der Status-Badges (Enum HousingChargeStatus). */
const housingChargeStatusStyles: Record<string, string> = {
	OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	OVERDUE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	CANCELLED: "bg-muted text-muted-foreground",
};

/** Filter-Optionen der Status-Spalte (alle gültigen Sollstellungs-Status). */
const housingChargeStatuses: HousingChargeStatus[] = ["OPEN", "PAID", "OVERDUE", "CANCELLED"];

/**
 * Hausgeld-Tabelle (/weg/hausgeld): clientseitige Sortierung/Filterung inkl.
 * Status-Select-Filter und Client-Pagination (50/Seite) - die Server-Seite
 * lädt die vollständige Liste. Die WEG-Spalte ist optional: Bei aktivem
 * WEG-Filter (?hoaId=) wird die Liste serverseitig vorgefiltert und die
 * Spalte entfällt. Bearbeiten/Löschen/Bezahlt-Markieren je Zeile benötigt die
 * zugehörige WEG (charge.hoa) und ist ohne diese bewusst nicht verfügbar.
 */
export function HousingChargesTable({
	rows,
	units,
	owners,
	showHoaColumn,
}: {
	rows: HousingChargeRow[];
	units: Unit[];
	owners: Owner[];
	showHoaColumn: boolean;
}) {
	const { t } = useI18n();

	// WEG-Spalte nur ohne serverseitigen WEG-Filter anzeigen.
	const hoaColumn: DataTableColumn<HousingChargeRow> | null = showHoaColumn
		? {
				key: "hoa",
				header: t("hoaFinance.charges.table.hoa"),
				sortValue: (row) => row.hoa?.name ?? "",
				filter: { type: "text", value: (row) => row.hoa?.name ?? "" },
				cell: (row) => <span className="text-muted-foreground">{row.hoa?.name ?? "–"}</span>,
			}
		: null;

	const columns: DataTableColumn<HousingChargeRow>[] = [
		...(hoaColumn ? [hoaColumn] : []),
		{
			key: "ownerUnit",
			header: t("hoaFinance.charges.table.ownerUnit"),
			sortValue: (row) => `${row.owner.firstName} ${row.owner.lastName}`,
			filter: { type: "text", value: (row) => `${row.owner.firstName} ${row.owner.lastName} ${row.unit.label}` },
			cell: (row) => (
				<span className="font-medium">
					{row.owner.firstName} {row.owner.lastName}
					<span className="block text-xs text-muted-foreground">{row.unit.label}</span>
				</span>
			),
		},
		{
			key: "purpose",
			header: t("hoaFinance.charges.table.purpose"),
			sortValue: (row) => row.purpose ?? "",
			filter: { type: "text", value: (row) => row.purpose ?? "" },
			cell: (row) => <span className="text-muted-foreground">{row.purpose ?? "–"}</span>,
		},
		{
			key: "dueDate",
			header: t("hoaFinance.charges.table.dueDate"),
			sortValue: (row) => row.dueDate,
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.dueDate)}</span>,
		},
		{
			key: "amount",
			header: t("common.amount"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.amount),
			cell: (row) => formatCurrency(row.amount),
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: housingChargeStatuses.map((value) => ({ value, label: t(`hoaFinance.charges.status.${value}`) })),
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${housingChargeStatusStyles[row.status]}`}>
					{t(`hoaFinance.charges.status.${row.status}`)}
				</span>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[120px] text-right",
			cellClassName: "text-right",
			cell: (row) => {
				const chargeHoa = row.hoa;
				return (
					<div className="flex items-center justify-end gap-1">
						{row.status !== "PAID" && chargeHoa ? <MarkHousingChargePaidButton housingChargeId={row.id} hoaId={chargeHoa.id} /> : null}
						{chargeHoa ? <HousingChargeFormDialog hoaId={chargeHoa.id} units={units} owners={owners} housingCharge={row} /> : null}
						{chargeHoa ? (
							<ConfirmDeleteButton action={deleteHousingChargeAction.bind(null, row.id, chargeHoa.id)} confirmMessage={t("hoaFinance.charges.confirm.delete")} />
						) : null}
					</div>
				);
			},
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} pageSize={LIST_PAGE_SIZE} />;
}