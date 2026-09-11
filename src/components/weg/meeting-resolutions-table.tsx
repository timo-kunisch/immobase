"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ResolutionFormDialog } from "@/components/weg/resolution-form-dialog";
import type { OwnerMeetingAgendaItem, OwnerResolution, ResolutionVotingResult } from "@/data/types";
import { resolutionVotingResultStyles } from "@/lib/hoa-meetings";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteResolutionAction } from "@/app/(app)/weg/versammlungen/actions";

/** Abstimmungsergebnisse (Enum ResolutionVotingResult) für den Select-Filter der Ergebnis-Spalte. */
const votingResults: ResolutionVotingResult[] = ["ACCEPTED", "REJECTED"];

/**
 * Beschluss-Tabelle der Versammlungs-Detailseite
 * (/weg/versammlungen/[meetingId]): clientseitige Sortierung und Filterung
 * je Spalte (Ergebnis als Select-Filter). Die fortlaufende Nummernvergabe
 * (§ 24 Abs. 6 WEG) und die Lösch-Sperre "nur der letzte Beschluss" liegen
 * unverändert in der Server Action.
 */
export function MeetingResolutionsTable({
	hoaId,
	meetingId,
	resolutions,
	agendaItems,
}: {
	hoaId: string;
	meetingId: string;
	resolutions: OwnerResolution[];
	agendaItems: OwnerMeetingAgendaItem[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<OwnerResolution>[] = [
		{
			key: "sequenceNumber",
			header: t("hoaMeetings.resolutions.table.number"),
			headClassName: "w-[60px]",
			sortValue: (row) => row.sequenceNumber,
			cell: (row) => row.sequenceNumber,
		},
		{
			key: "title",
			header: t("hoaMeetings.resolutions.table.title"),
			sortValue: (row) => row.title,
			filter: { type: "text", value: (row) => row.title },
			cell: (row) => <span className="font-medium">{row.title}</span>,
		},
		{
			key: "resolvedAt",
			header: t("common.date"),
			sortValue: (row) => row.resolvedAt,
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.resolvedAt)}</span>,
		},
		{
			key: "votingResult",
			header: t("hoaMeetings.resolutions.table.result"),
			sortValue: (row) => row.votingResult,
			filter: {
				type: "select",
				value: (row) => row.votingResult,
				options: votingResults.map((value) => ({ value, label: t(`hoaMeetings.votingResult.${value}`) })),
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${resolutionVotingResultStyles[row.votingResult]}`}>
					{t(`hoaMeetings.votingResult.${row.votingResult}`)}
				</span>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<ResolutionFormDialog hoaId={hoaId} meetingId={meetingId} agendaItems={agendaItems} resolution={row} />
					<ConfirmDeleteButton
						action={deleteResolutionAction.bind(null, row.id, hoaId, meetingId)}
						confirmMessage={t("hoaMeetings.resolutions.confirm.delete", { title: row.title })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={resolutions} rowKey={(row) => row.id} rowId={(row) => `resolution-${row.id}`} />;
}
