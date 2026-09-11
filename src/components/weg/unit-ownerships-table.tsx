"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { UnitOwnershipFormDialog } from "@/components/weg/unit-ownership-form-dialog";
import type { UnitOwnershipWithOwners } from "@/data/unit-ownerships";
import type { Owner, Unit } from "@/data/types";
import { formatDate } from "@/lib/format";
import { getOwnershipStatus, ownershipStatusStyles } from "@/lib/hoa-ownership";
import { useI18n } from "@/lib/i18n/provider";

import { deleteUnitOwnershipAction } from "@/app/(app)/weg/eigentumsverhaeltnisse/actions";

/**
 * Tabelle der zeitversionierten Eigentumsverhältnisse EINER Einheit
 * (Karten-Kontext der Seite /weg/eigentumsverhaeltnisse). Der Status wird
 * je Zeile clientseitig aus Beginn/Ende abgeleitet (reine Funktion aus
 * src/lib/hoa-ownership.ts). Die Formular-Dialoge benötigen die Auswahllisten
 * aller Einheiten/Eigentümer als eigene Array-Props.
 */
export function UnitOwnershipsTable({
	ownerships,
	units,
	owners,
}: {
	ownerships: UnitOwnershipWithOwners[];
	units: Unit[];
	owners: Owner[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<UnitOwnershipWithOwners>[] = [
		{
			key: "owner",
			header: t("common.owner"),
			sortValue: (row) => `${row.owner.lastName} ${row.owner.firstName}`,
			filter: {
				type: "text",
				value: (row) =>
					`${row.owner.firstName} ${row.owner.lastName}${row.coOwner ? ` ${row.coOwner.firstName} ${row.coOwner.lastName}` : ""}`,
			},
			cell: (row) => (
				<span className="font-medium">
					{row.owner.firstName} {row.owner.lastName}
					{row.coOwner ? (
						<span className="block text-xs text-muted-foreground">
							{t("hoa.ownerships.coOwnerValue", { name: `${row.coOwner.firstName} ${row.coOwner.lastName}` })}
						</span>
					) : null}
				</span>
			),
		},
		{
			key: "period",
			header: t("hoa.ownerships.table.period"),
			sortValue: (row) => row.startDate,
			filter: {
				type: "text",
				value: (row) => `${formatDate(row.startDate)} – ${row.endDate ? formatDate(row.endDate) : t("hoa.ownerships.ongoing")}`,
			},
			cell: (row) => (
				<span className="text-muted-foreground">
					{formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : t("hoa.ownerships.ongoing")}
				</span>
			),
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => getOwnershipStatus(row),
			filter: {
				type: "select",
				value: (row) => getOwnershipStatus(row),
				options: [
					{ value: "ACTIVE", label: t("hoa.ownerships.status.ACTIVE") },
					{ value: "UPCOMING", label: t("hoa.ownerships.status.UPCOMING") },
					{ value: "ENDED", label: t("hoa.ownerships.status.ENDED") },
				],
			},
			cell: (row) => {
				const status = getOwnershipStatus(row);
				return (
					<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ownershipStatusStyles[status]}`}>
						{t(`hoa.ownerships.status.${status}`)}
					</span>
				);
			},
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<UnitOwnershipFormDialog units={units} owners={owners} ownership={row} />
					<ConfirmDeleteButton action={deleteUnitOwnershipAction.bind(null, row.id)} confirmMessage={t("hoa.ownerships.confirm.delete")} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={ownerships} rowKey={(row) => row.id} />;
}
