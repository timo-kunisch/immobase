"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { AnnualStatementWithHoaName } from "@/data/annual-statements";
import type { AnnualStatementStatus } from "@/data/types";
import { formatDate } from "@/lib/format";
import { annualStatementStatusStyles } from "@/lib/hoa-annual-statement";
import { useI18n } from "@/lib/i18n/provider";

import { deleteAnnualStatementAction } from "@/app/(app)/weg/jahresabrechnung/actions";

/** Zeile der Jahresabrechnungen-Liste: Abrechnung inkl. Name der zugehörigen WEG. */
export type AnnualStatementRow = AnnualStatementWithHoaName;

/** Filter-Optionen der Status-Spalte (alle gültigen Jahresabrechnungs-Status). */
const annualStatementStatuses: AnnualStatementStatus[] = ["DRAFT", "FINALIZED"];

/**
 * Listen-Tabelle der Jahresabrechnungen (/weg/jahresabrechnung): clientseitige
 * Sortierung/Filterung inkl. Status-Select-Filter. Die WEG-Spalte ist optional:
 * Bei aktivem WEG-Filter (?hoaId=) wird die Liste serverseitig vorgefiltert
 * und die Spalte entfällt.
 */
export function AnnualStatementsTable({ rows, showHoaColumn }: { rows: AnnualStatementRow[]; showHoaColumn: boolean }) {
	const { t } = useI18n();

	// WEG-Spalte nur ohne serverseitigen WEG-Filter anzeigen.
	const hoaColumn: DataTableColumn<AnnualStatementRow> | null = showHoaColumn
		? {
				key: "hoa",
				header: t("hoaStatement.table.hoa"),
				sortValue: (row) => row.hoaName,
				filter: { type: "text", value: (row) => row.hoaName },
				cell: (row) => <span className="text-muted-foreground">{row.hoaName}</span>,
			}
		: null;

	const columns: DataTableColumn<AnnualStatementRow>[] = [
		...(hoaColumn ? [hoaColumn] : []),
		{
			key: "period",
			header: t("hoaStatement.table.period"),
			sortValue: (row) => row.periodFrom,
			filter: { type: "text", value: (row) => `${formatDate(row.periodFrom)} – ${formatDate(row.periodTo)}` },
			cell: (row) => (
				<span className="font-medium">
					{formatDate(row.periodFrom)} – {formatDate(row.periodTo)}
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
				options: annualStatementStatuses.map((value) => ({ value, label: t(`hoaStatement.status.${value}`) })),
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${annualStatementStatusStyles[row.status]}`}>
					{t(`hoaStatement.status.${row.status}`)}
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
						<Link href={`/weg/jahresabrechnung/${row.id}`}>
							<ChevronRight className="size-4" />
						</Link>
					</Button>
					{/* Finalisierte Abrechnungen sind ebenfalls löschbar - die Action räumt
					    erzeugte PDFs und Postversand-Protokolle mit weg
					    (deleteAnnualStatementWithArtifacts), deshalb eine eigene,
					    deutlich warnende Bestätigung. */}
					<ConfirmDeleteButton
						action={deleteAnnualStatementAction.bind(null, row.id, row.hoaId)}
						confirmMessage={row.status === "DRAFT" ? t("hoaStatement.confirm.delete") : t("hoaStatement.confirm.deleteFinalized")}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `annual-statement-${row.id}`} />;
}