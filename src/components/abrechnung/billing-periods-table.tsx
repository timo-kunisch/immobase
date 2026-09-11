"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { BillingPeriodWithPropertyName } from "@/data/billing";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { billingPeriodStatusStyles } from "@/lib/billing";

import { deleteBillingPeriodAction } from "@/app/(app)/abrechnung/actions";

/** Zeile der Abrechnungsperioden-Tabelle: Periode inkl. Anzahl ihrer Kostenpositionen. */
export type BillingPeriodRow = BillingPeriodWithPropertyName & { costItemCount: number };

export function BillingPeriodsTable({ rows }: { rows: BillingPeriodRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<BillingPeriodRow>[] = [
		{
			key: "property",
			header: t("common.property"),
			sortValue: (row) => row.propertyName,
			filter: { type: "text", value: (row) => row.propertyName },
			cell: (row) => (
				<span className="font-medium">
					<Link href={`/liegenschaften#property-${row.propertyId}`} className="hover:underline">
						{row.propertyName}
					</Link>
				</span>
			),
		},
		{
			key: "period",
			header: t("billing.table.period"),
			sortValue: (row) => row.periodFrom,
			filter: { type: "text", value: (row) => `${formatDate(row.periodFrom)} – ${formatDate(row.periodTo)}` },
			cell: (row) => (
				<span className="text-muted-foreground">
					{formatDate(row.periodFrom)} – {formatDate(row.periodTo)}
				</span>
			),
		},
		{
			key: "costItems",
			header: t("billing.table.costItems"),
			sortValue: (row) => row.costItemCount,
			cell: (row) => <span className="text-muted-foreground">{row.costItemCount}</span>,
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: [
					{ value: "DRAFT", label: t("billing.status.DRAFT") },
					{ value: "FINALIZED", label: t("billing.status.FINALIZED") },
				],
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${billingPeriodStatusStyles[row.status]}`}>
					{t(`billing.status.${row.status}`)}
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
						<Link href={`/abrechnung/${row.id}`}>
							<ChevronRight className="size-4" />
						</Link>
					</Button>
					{/* Finalisierte Perioden sind nicht mehr bearbeitbar, ihre Löschung
					    bleibt aber möglich (inkl. aller erzeugten PDFs). */}
					<ConfirmDeleteButton
						action={deleteBillingPeriodAction.bind(null, row.id)}
						confirmMessage={t(row.status === "DRAFT" ? "billing.confirm.deletePeriod" : "billing.confirm.deleteFinalizedPeriod")}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `billing-period-${row.id}`} />;
}
