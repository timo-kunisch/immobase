"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { AgendaItemFormDialog } from "@/components/weg/agenda-item-form-dialog";
import type { OwnerMeetingAgendaItem } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deleteAgendaItemAction } from "@/app/(app)/weg/versammlungen/actions";

/**
 * Tagesordnungs-Tabelle der Versammlungs-Detailseite
 * (/weg/versammlungen/[meetingId]): clientseitige Sortierung und Filterung
 * je Spalte; Anlegen/Bearbeiten erfolgt über den AgendaItemFormDialog je
 * Zeile (die nächsthöhere Position wird für neue Punkte mitgegeben).
 */
export function AgendaItemsTable({
	hoaId,
	meetingId,
	items,
	nextPosition,
}: {
	hoaId: string;
	meetingId: string;
	items: OwnerMeetingAgendaItem[];
	nextPosition: number;
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<OwnerMeetingAgendaItem>[] = [
		{
			key: "position",
			header: t("hoaMeetings.agenda.table.number"),
			headClassName: "w-[60px]",
			sortValue: (row) => row.position,
			cell: (row) => row.position,
		},
		{
			key: "title",
			header: t("hoaMeetings.agenda.table.title"),
			sortValue: (row) => row.title,
			filter: { type: "text", value: (row) => row.title },
			cell: (row) => <span className="font-medium">{row.title}</span>,
		},
		{
			key: "description",
			header: t("common.description"),
			sortValue: (row) => row.description ?? "",
			filter: { type: "text", value: (row) => row.description ?? "" },
			cell: (row) => <span className="text-muted-foreground">{row.description ?? "–"}</span>,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<AgendaItemFormDialog hoaId={hoaId} meetingId={meetingId} agendaItem={row} nextPosition={nextPosition} />
					<ConfirmDeleteButton
						action={deleteAgendaItemAction.bind(null, row.id, hoaId, meetingId)}
						confirmMessage={t("hoaMeetings.agenda.confirm.delete", { title: row.title })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={items} rowKey={(row) => row.id} />;
}
