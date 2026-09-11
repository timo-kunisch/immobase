"use client";

import Link from "next/link";
import { FileSignature, FileText, Wrench } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { UnitFormDialog } from "@/components/einheiten/unit-form-dialog";
import type { UnitStats, UnitWithPropertyName } from "@/data/units";
import type { Property } from "@/data/types";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteUnitAction } from "@/app/(app)/einheiten/actions";

/**
 * Zeile der Einheiten-Tabelle: Einheit angereichert um ihre Statistik und
 * den aktiven Mietvertrag (Vermietet/Leerstand-Anzeige).
 */
export type UnitRow = UnitWithPropertyName & {
	stats?: UnitStats;
	activeLease?: { id: string; tenantFirstName: string; tenantLastName: string };
};

export function UnitsTable({ rows, properties }: { rows: UnitRow[]; properties: Property[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<UnitRow>[] = [
		{
			key: "label",
			header: t("common.unit"),
			sortValue: (row) => row.label,
			filter: { type: "text", value: (row) => row.label },
			cell: (row) => (
				<span className="font-medium">
					{row.label}
					{row.floor ? <span className="ml-1 text-muted-foreground">({row.floor})</span> : null}
				</span>
			),
		},
		{
			key: "property",
			header: t("common.property"),
			sortValue: (row) => row.propertyName,
			filter: { type: "text", value: (row) => row.propertyName },
			cell: (row) => (
				<Link href={`/liegenschaften#property-${row.propertyId}`} className="text-muted-foreground hover:text-foreground hover:underline">
					{row.propertyName}
				</Link>
			),
		},
		{
			key: "livingSpace",
			header: t("units.table.livingSpace"),
			sortValue: (row) => row.livingSpace,
			cell: (row) => (
				<>
					{row.livingSpace ? t("units.areaValue", { value: formatNumber(row.livingSpace) }) : "–"}
					{row.rooms ? t("units.roomsValue", { value: formatNumber(row.rooms) }) : ""}
				</>
			),
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => (row.activeLease ? 0 : 1),
			filter: {
				type: "select",
				value: (row) => (row.activeLease ? "RENTED" : "VACANT"),
				options: [
					{ value: "RENTED", label: t("units.status.rented") },
					{ value: "VACANT", label: t("units.status.vacant") },
				],
			},
			cell: (row) =>
				row.activeLease ? (
					<Link
						href={`/vertraege#lease-${row.activeLease.id}`}
						className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
					>
						{t("units.status.rentedTo", { firstName: row.activeLease.tenantFirstName, lastName: row.activeLease.tenantLastName })}
					</Link>
				) : (
					<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
						{t("units.status.vacant")}
					</span>
				),
		},
		{
			key: "linked",
			header: t("units.table.linked"),
			cell: (row) => (
				<div className="flex items-center gap-1.5">
					<CountLinkBadge href={`/vertraege?unitId=${row.id}`} count={row.stats?.leases ?? 0} label={t("units.badge.leases")} icon={FileSignature} />
					{(row.stats?.openTickets ?? 0) > 0 ? (
						<CountLinkBadge
							href={`/tickets?unitId=${row.id}`}
							count={row.stats!.openTickets}
							label={t("units.badge.tickets")}
							icon={Wrench}
							className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
						/>
					) : null}
					{(row.stats?.documents ?? 0) > 0 ? (
						<CountLinkBadge href={`/dokumente?unitId=${row.id}`} count={row.stats!.documents} label={t("units.badge.documents")} icon={FileText} />
					) : null}
				</div>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<UnitFormDialog unit={row} properties={properties} />
					<ConfirmDeleteButton action={deleteUnitAction.bind(null, row.id)} confirmMessage={t("units.confirm.delete", { name: row.label })} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `unit-${row.id}`} />;
}
