"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConsumptionValuesDialog } from "@/components/abrechnung/consumption-values-dialog";
import { CostItemFormDialog } from "@/components/abrechnung/cost-item-form-dialog";
import type { BillingCostItem } from "@/data/billing";
import type { CustomAllocationKey, Unit } from "@/data/types";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteCostItemAction } from "@/app/(app)/abrechnung/actions";

/**
 * Tabelle der Kostenpositionen einer Abrechnungsperiode. In finalisierten
 * Perioden sind sämtliche Aktionen gesperrt (isDraft = false zeigt stattdessen
 * einen Hinweis an).
 */
export function CostItemsTable({
	billingPeriodId,
	isDraft,
	rows,
	units,
	customAllocationKeys,
}: {
	billingPeriodId: string;
	isDraft: boolean;
	rows: BillingCostItem[];
	units: Unit[];
	customAllocationKeys: CustomAllocationKey[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<BillingCostItem>[] = [
		{
			key: "label",
			header: t("billing.table.label"),
			sortValue: (row) => row.label,
			filter: { type: "text", value: (row) => row.label },
			cell: (row) => (
				<span className="font-medium">
					{row.label}
					{row.notes ? <span className="block text-xs text-muted-foreground">{row.notes}</span> : null}
				</span>
			),
		},
		{
			key: "allocationKey",
			header: t("billing.table.allocationKey"),
			sortValue: (row) => t(`billing.allocationKey.${row.allocationKey}`),
			filter: {
				type: "select",
				value: (row) => row.allocationKey,
				options: [
					{ value: "LIVING_SPACE", label: t("billing.allocationKey.LIVING_SPACE") },
					{ value: "UNITS", label: t("billing.allocationKey.UNITS") },
					{ value: "CONSUMPTION", label: t("billing.allocationKey.CONSUMPTION") },
					{ value: "DIRECT", label: t("billing.allocationKey.DIRECT") },
					{ value: "CUSTOM", label: t("billing.allocationKey.CUSTOM") },
				],
			},
			cell: (row) => (
				<span className="text-muted-foreground">
					{t(`billing.allocationKey.${row.allocationKey}`)}
					{row.allocationKey === "DIRECT" && row.directUnit ? (
						<span className="block text-xs text-muted-foreground">{row.directUnit.label}</span>
					) : null}
					{row.allocationKey === "CUSTOM" && row.customAllocationKey ? (
						<span className="block text-xs text-muted-foreground">{row.customAllocationKey.label}</span>
					) : null}
				</span>
			),
		},
		{
			key: "amount",
			header: t("common.amount"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.amount),
			cell: (row) => formatCurrency(row.amount),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[140px] text-right",
			cellClassName: "text-right",
			cell: (row) =>
				isDraft ? (
					<div className="flex items-center justify-end gap-1">
						{row.allocationKey === "CONSUMPTION" ? (
							<ConsumptionValuesDialog costItemId={row.id} costItemLabel={row.label} units={units} consumptionValues={row.consumptionValues} />
						) : null}
						<CostItemFormDialog billingPeriodId={billingPeriodId} costItem={row} units={units} customAllocationKeys={customAllocationKeys} />
						<ConfirmDeleteButton
							action={deleteCostItemAction.bind(null, row.id)}
							confirmMessage={t("billing.confirm.deleteCostItem", { label: row.label })}
						/>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">{t("billing.detail.finalized")}</span>
				),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
