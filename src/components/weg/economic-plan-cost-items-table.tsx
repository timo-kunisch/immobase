"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import type { HoaCostItem, HoaCustomAllocationKey, Unit } from "@/data/types";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteEconomicPlanCostItemAction, saveEconomicPlanCostItemAction } from "@/app/(app)/weg/wirtschaftsplan/actions";

/**
 * Zeile der Kostenpositionen-Tabelle: Kostenposition angereichert um die
 * serverseitig aufgelösten Bezeichnungen der Direkt-Zuordnung (Einheit) bzw.
 * des frei definierten Verteilerschlüssels für die Zell-Unterzeilen (Maps
 * sind als Client-Props nicht serialisierbar).
 */
export type EconomicPlanCostItemRow = HoaCostItem & {
	directUnitLabel?: string;
	customAllocationKeyLabel?: string;
};

/**
 * Tabelle der Kostenpositionen eines Wirtschaftsplans. Finalisierte Pläne
 * sind nicht mehr bearbeitbar: Die Aktionen-Spalte zeigt dann statt der
 * Dialoge/Lösch-Buttons nur noch den Status-Hinweis.
 */
export function EconomicPlanCostItemsTable({
	rows,
	isDraft,
	planId,
	hoaId,
	units,
	customAllocationKeys,
}: {
	rows: EconomicPlanCostItemRow[];
	isDraft: boolean;
	planId: string;
	hoaId: string;
	units: Unit[];
	customAllocationKeys: HoaCustomAllocationKey[];
}) {
	const { t } = useI18n();

	// Im Wirtschaftsplan auswählbare Umlageschlüssel (CONSUMPTION ist nur in
	// der Jahresabrechnung anwendbar, siehe actions.ts/HOA_ALLOCATION_KEYS).
	const allocationKeyOptions = (["MEA", "LIVING_SPACE", "UNITS", "DIRECT", "CUSTOM"] as const).map((value) => ({
		value,
		label: t(`hoaPlan.allocationKey.${value}`),
	}));

	const columns: DataTableColumn<EconomicPlanCostItemRow>[] = [
		{
			key: "label",
			header: t("hoaPlan.table.label"),
			sortValue: (row) => row.label,
			filter: {
				type: "text",
				value: (row) => [row.label, row.directUnitLabel, row.customAllocationKeyLabel].filter(Boolean).join(" "),
			},
			cell: (row) => (
				<span className="font-medium">
					{row.label}
					{row.directUnitLabel ? <span className="block text-xs text-muted-foreground">{row.directUnitLabel}</span> : null}
					{row.customAllocationKeyLabel ? <span className="block text-xs text-muted-foreground">{row.customAllocationKeyLabel}</span> : null}
				</span>
			),
		},
		{
			key: "allocationKey",
			header: t("hoaPlan.table.allocationKey"),
			sortValue: (row) => t(`hoaPlan.allocationKey.${row.allocationKey}`),
			filter: { type: "select", value: (row) => row.allocationKey, options: allocationKeyOptions },
			cell: (row) => <span className="text-muted-foreground">{t(`hoaPlan.allocationKey.${row.allocationKey}`)}</span>,
		},
		{
			key: "amount",
			header: t("common.amount"),
			align: "right",
			cellClassName: "text-right",
			sortValue: (row) => Number(row.amount),
			cell: (row) => formatCurrency(row.amount),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) =>
				isDraft ? (
					<div className="flex items-center justify-end gap-1">
						<HoaCostItemFormDialog
							action={saveEconomicPlanCostItemAction}
							parentIdFieldName="economicPlanId"
							parentId={planId}
							hoaId={hoaId}
							costItem={row}
							units={units}
							customAllocationKeys={customAllocationKeys}
						/>
						<ConfirmDeleteButton
							action={deleteEconomicPlanCostItemAction.bind(null, row.id, hoaId, planId)}
							confirmMessage={t("hoaPlan.confirm.deleteCostItem", { label: row.label })}
						/>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">{t("hoaPlan.status.FINALIZED")}</span>
				),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
