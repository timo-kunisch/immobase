"use client";

import { DoorOpen, FileText, Wrench } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PropertyFormDialog } from "@/components/liegenschaften/property-form-dialog";
import type { PropertyStats } from "@/data/properties";
import type { Property } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deletePropertyAction } from "@/app/(app)/liegenschaften/actions";

/** Zeile der Liegenschaften-Tabelle: Liegenschaft angereichert um ihre Statistik. */
export type PropertyRow = Property & { stats?: PropertyStats };

export function PropertiesTable({ rows }: { rows: PropertyRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<PropertyRow>[] = [
		{
			key: "name",
			header: t("properties.table.name"),
			sortValue: (row) => row.name,
			filter: { type: "text", value: (row) => row.name },
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "address",
			header: t("common.address"),
			sortValue: (row) => `${row.street}, ${row.zipCode} ${row.city}`,
			filter: { type: "text", value: (row) => `${row.street}, ${row.zipCode} ${row.city}` },
			cell: (row) => (
				<span className="text-muted-foreground">
					{row.street}, {row.zipCode} {row.city}
				</span>
			),
		},
		{
			key: "linked",
			header: t("properties.table.linked"),
			align: "right",
			headClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1.5">
					<CountLinkBadge
						href={`/einheiten?propertyId=${row.id}`}
						count={row.stats?.units ?? 0}
						label={t("properties.badge.units")}
						icon={DoorOpen}
					/>
					{(row.stats?.openTickets ?? 0) > 0 ? (
						<CountLinkBadge
							href={`/tickets?propertyId=${row.id}`}
							count={row.stats!.openTickets}
							label={t("properties.badge.tickets")}
							icon={Wrench}
							className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
						/>
					) : null}
					{(row.stats?.documents ?? 0) > 0 ? (
						<CountLinkBadge
							href={`/dokumente?propertyId=${row.id}`}
							count={row.stats!.documents}
							label={t("properties.badge.documents")}
							icon={FileText}
						/>
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
					<PropertyFormDialog property={row} />
					<ConfirmDeleteButton
						action={deletePropertyAction.bind(null, row.id)}
						confirmMessage={t("properties.confirm.delete", { name: row.name })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `property-${row.id}`} />;
}
