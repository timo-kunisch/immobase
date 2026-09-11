"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { OwnerMeetingWithHoaName } from "@/data/meetings";
import type { OwnerMeetingStatus, OwnerMeetingType } from "@/data/types";
import { ownerMeetingStatusStyles } from "@/lib/hoa-meetings";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteOwnerMeetingAction } from "@/app/(app)/weg/versammlungen/actions";

/** Versammlungs-Arten (Enum OwnerMeetingType) für den Select-Filter der Art-Spalte. */
const meetingTypes: OwnerMeetingType[] = ["ORDINARY", "EXTRAORDINARY", "CIRCULATION"];

/** Versammlungs-Status (Enum OwnerMeetingStatus) für den Select-Filter der Status-Spalte. */
const meetingStatuses: OwnerMeetingStatus[] = ["PLANNED", "INVITED", "HELD", "MINUTES_FINALIZED", "CANCELLED"];

/**
 * Versammlungs-Tabelle (/weg/versammlungen): clientseitige Sortierung und
 * Filterung je Spalte (Art und Status als Select-Filter); der WEG-Filter
 * (?hoaId=) bleibt als serverseitiger Vorfilter wirksam - die WEG-Spalte
 * wird nur ohne aktiven Filter angezeigt.
 */
export function OwnerMeetingsTable({ rows, showHoa }: { rows: OwnerMeetingWithHoaName[]; showHoa: boolean }) {
	const { t } = useI18n();

	// WEG-Spalte nur, wenn die Liste alle WEGs umfasst (ohne ?hoaId=-Filter).
	const hoaColumn: DataTableColumn<OwnerMeetingWithHoaName>[] = showHoa
		? [
				{
					key: "hoa",
					header: t("hoaMeetings.meetings.table.hoa"),
					sortValue: (row) => row.hoaName,
					filter: { type: "text", value: (row) => row.hoaName },
					cell: (row) => <span className="text-muted-foreground">{row.hoaName}</span>,
				},
			]
		: [];

	const columns: DataTableColumn<OwnerMeetingWithHoaName>[] = [
		...hoaColumn,
		{
			key: "title",
			header: t("hoaMeetings.meetings.table.title"),
			sortValue: (row) => row.title,
			filter: { type: "text", value: (row) => row.title },
			cell: (row) => <span className="font-medium">{row.title}</span>,
		},
		{
			key: "type",
			header: t("hoaMeetings.meetings.table.type"),
			sortValue: (row) => row.type,
			filter: {
				type: "select",
				value: (row) => row.type,
				options: meetingTypes.map((value) => ({ value, label: t(`hoaMeetings.meetingType.${value}`) })),
			},
			cell: (row) => <span className="text-muted-foreground">{t(`hoaMeetings.meetingType.${row.type}`)}</span>,
		},
		{
			key: "date",
			header: t("hoaMeetings.meetings.table.date"),
			sortValue: (row) => row.meetingDate,
			cell: (row) => <span className="text-muted-foreground">{row.meetingDate ? formatDate(row.meetingDate) : "–"}</span>,
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: meetingStatuses.map((value) => ({ value, label: t(`hoaMeetings.meetingStatus.${value}`) })),
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ownerMeetingStatusStyles[row.status]}`}>
					{t(`hoaMeetings.meetingStatus.${row.status}`)}
				</span>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[140px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<Button variant="ghost" size="icon-sm" aria-label={t("hoaMeetings.meetings.details")} title={t("hoaMeetings.meetings.details")} asChild>
						<Link href={`/weg/versammlungen/${row.id}`}>
							<ChevronRight className="size-4" />
						</Link>
					</Button>
					<ConfirmDeleteButton
						action={deleteOwnerMeetingAction.bind(null, row.id, row.hoaId)}
						confirmMessage={t("hoaMeetings.meetings.confirm.delete", { title: row.title })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `meeting-${row.id}`} />;
}
