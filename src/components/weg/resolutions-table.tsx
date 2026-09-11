"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { OwnerResolutionWithMeetingAndHoa } from "@/data/meetings";
import type { ResolutionVotingResult } from "@/data/types";
import { isContestationDeadlinePassed, resolutionVotingResultStyles } from "@/lib/hoa-meetings";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

/** Abstimmungsergebnisse (Enum ResolutionVotingResult) für den Select-Filter der Ergebnis-Spalte. */
const votingResults: ResolutionVotingResult[] = ["ACCEPTED", "REJECTED"];

/**
 * Beschluss-Sammlung (/weg/beschluesse, § 24 Abs. 6 WEG): clientseitige
 * Sortierung/Filterung je Spalte (Ergebnis als Select-Filter) inkl.
 * Client-Pagination (50/Seite) - die Server-Seite lädt die vollständige
 * Sammlung. Reine Lesansicht: Bearbeiten/Löschen erfolgt ausschließlich
 * über die verlinkte Versammlung.
 */
export function ResolutionsTable({ rows, showHoa, nowIso }: { rows: OwnerResolutionWithMeetingAndHoa[]; showHoa: boolean; nowIso: string }) {
	const { t } = useI18n();

	// Stichtag der Frist-Prüfung vom Server übergeben (deterministisch beim
	// Hydratieren, kein new Date() im Render).
	const now = new Date(nowIso);

	// WEG-Spalte nur, wenn die Sammlung alle WEGs umfasst (ohne ?hoaId=-Filter).
	const hoaColumn: DataTableColumn<OwnerResolutionWithMeetingAndHoa>[] = showHoa
		? [
				{
					key: "hoa",
					header: t("hoaMeetings.collection.table.hoa"),
					sortValue: (row) => row.hoaName,
					filter: { type: "text", value: (row) => row.hoaName },
					cell: (row) => <span className="text-muted-foreground">{row.hoaName}</span>,
				},
			]
		: [];

	const columns: DataTableColumn<OwnerResolutionWithMeetingAndHoa>[] = [
		{
			key: "sequenceNumber",
			header: t("hoaMeetings.collection.table.number"),
			headClassName: "w-[60px]",
			sortValue: (row) => row.sequenceNumber,
			cell: (row) => <span className="font-medium">{row.sequenceNumber}</span>,
		},
		...hoaColumn,
		{
			key: "title",
			header: t("hoaMeetings.collection.table.title"),
			sortValue: (row) => row.title,
			filter: { type: "text", value: (row) => row.title },
			cell: (row) => (
				<Link href={`/weg/versammlungen/${row.meetingId}#resolution-${row.id}`} className="hover:underline">
					{row.title}
				</Link>
			),
		},
		{
			key: "meeting",
			header: t("hoaMeetings.collection.table.meeting"),
			sortValue: (row) => row.meetingTitle,
			filter: { type: "text", value: (row) => row.meetingTitle },
			cell: (row) => <span className="text-muted-foreground">{row.meetingTitle}</span>,
		},
		{
			key: "resolvedAt",
			header: t("common.date"),
			sortValue: (row) => row.resolvedAt,
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.resolvedAt)}</span>,
		},
		{
			key: "votingResult",
			header: t("hoaMeetings.collection.table.result"),
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
			key: "contestedUntil",
			header: t("hoaMeetings.collection.table.contestableUntil"),
			sortValue: (row) => row.contestedUntil,
			cell: (row) => {
				if (!row.contestedUntil) return "–";
				const deadlinePassed = isContestationDeadlinePassed(new Date(row.contestedUntil), now);
				return (
					<span className="flex items-center gap-2 text-muted-foreground">
						{formatDate(row.contestedUntil)}
						{!deadlinePassed ? (
							<Badge variant="outline" className="text-amber-700 dark:text-amber-400">
								{t("hoaMeetings.collection.contestableBadge")}
							</Badge>
						) : null}
					</span>
				);
			},
		},
	];

	return (
		<DataTable
			columns={columns}
			rows={rows}
			rowKey={(row) => row.id}
			rowId={(row) => `resolution-collection-${row.sequenceNumber}`}
			pageSize={LIST_PAGE_SIZE}
		/>
	);
}
