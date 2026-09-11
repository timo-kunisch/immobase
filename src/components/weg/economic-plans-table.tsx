"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { EconomicPlanWithHoaName } from "@/data/economic-plans";
import { formatDate } from "@/lib/format";
import { economicPlanStatusStyles } from "@/lib/hoa-economic-plan";
import { useI18n } from "@/lib/i18n/provider";

import { deleteEconomicPlanAction } from "@/app/(app)/weg/wirtschaftsplan/actions";

/**
 * Tabelle der Wirtschaftspläne. Die WEG-Spalte ist optional: Bei aktivem
 * WEG-Filter (?hoaId=) wird die Liste serverseitig vorgefiltert und die
 * Spalte entfällt.
 */
export function EconomicPlansTable({ rows, showHoaColumn }: { rows: EconomicPlanWithHoaName[]; showHoaColumn: boolean }) {
	const { t } = useI18n();

	// WEG-Spalte nur ohne serverseitigen WEG-Filter anzeigen.
	const hoaColumn: DataTableColumn<EconomicPlanWithHoaName> | null = showHoaColumn
		? {
				key: "hoa",
				header: t("hoaPlan.table.hoa"),
				sortValue: (row) => row.hoaName,
				filter: { type: "text", value: (row) => row.hoaName },
				cell: (row) => <span className="text-muted-foreground">{row.hoaName}</span>,
			}
		: null;

	const columns: DataTableColumn<EconomicPlanWithHoaName>[] = [
		...(hoaColumn ? [hoaColumn] : []),
		{
			key: "fiscalYear",
			header: t("hoaPlan.table.fiscalYear"),
			sortValue: (row) => row.fiscalYearFrom,
			filter: {
				type: "text",
				value: (row) => `${formatDate(row.fiscalYearFrom)} – ${formatDate(row.fiscalYearTo)}`,
			},
			cell: (row) => (
				<span className="font-medium">
					{formatDate(row.fiscalYearFrom)} – {formatDate(row.fiscalYearTo)}
				</span>
			),
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: [
					{ value: "DRAFT", label: t("hoaPlan.status.DRAFT") },
					{ value: "FINALIZED", label: t("hoaPlan.status.FINALIZED") },
				],
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${economicPlanStatusStyles[row.status]}`}>
					{t(`hoaPlan.status.${row.status}`)}
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
					<Button variant="ghost" size="icon-sm" aria-label={t("common.details")} title={t("common.details")} asChild>
						<Link href={`/weg/wirtschaftsplan/${row.id}`}>
							<ChevronRight className="size-4" />
						</Link>
					</Button>
					{row.status === "DRAFT" ? (
						<ConfirmDeleteButton action={deleteEconomicPlanAction.bind(null, row.id, row.hoaId)} confirmMessage={t("hoaPlan.confirm.delete")} />
					) : null}
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `economic-plan-${row.id}`} />;
}
