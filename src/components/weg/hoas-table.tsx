"use client";

import Link from "next/link";
import { ChevronRight, DoorOpen, Users } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { HoaFormDialog } from "@/components/weg/hoa-form-dialog";
import type { HoaStats, HoaWithProperty } from "@/data/hoas";
import type { Property } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deleteHoaAction } from "@/app/(app)/weg/actions";

/** Zeile der WEG-Tabelle: WEG angereichert um ihre Statistik. */
export type HoaRow = HoaWithProperty & { stats?: HoaStats };

export function HoasTable({ rows, availableProperties }: { rows: HoaRow[]; availableProperties: Property[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<HoaRow>[] = [
		{
			key: "name",
			header: t("hoa.table.name"),
			sortValue: (row) => row.name,
			filter: { type: "text", value: (row) => row.name },
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "property",
			header: t("hoa.table.property"),
			sortValue: (row) => row.property.name,
			filter: { type: "text", value: (row) => row.property.name },
			cell: (row) => (
				<Link href={`/liegenschaften#property-${row.propertyId}`} className="text-muted-foreground hover:underline">
					{row.property.name}
				</Link>
			),
		},
		{
			key: "linked",
			header: t("hoa.table.linked"),
			cell: (row) => (
				<div className="flex items-center gap-1.5">
					<CountLinkBadge href={`/einheiten?propertyId=${row.propertyId}`} count={row.stats?.units ?? 0} label={t("hoa.badge.units")} icon={DoorOpen} />
					<CountLinkBadge href={`/weg/eigentumsverhaeltnisse?hoaId=${row.id}`} count={row.stats?.ownerships ?? 0} label={t("hoa.badge.ownerships")} icon={Users} />
				</div>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[140px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<HoaFormDialog hoa={row} availableProperties={[row.property, ...availableProperties]} />
					<Button variant="ghost" size="icon-sm" aria-label={t("common.details")} title={t("common.details")} asChild>
						<Link href={`/weg/eigentumsverhaeltnisse?hoaId=${row.id}`}>
							<ChevronRight className="size-4" />
						</Link>
					</Button>
					<ConfirmDeleteButton action={deleteHoaAction.bind(null, row.id)} confirmMessage={t("hoa.confirm.delete", { name: row.name })} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `hoa-${row.id}`} />;
}
