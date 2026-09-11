"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { HoaConsumptionValuesDialog } from "@/components/weg/hoa-consumption-values-dialog";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import type { HoaCostItemWithConsumptionValues } from "@/data/annual-statements";
import type { HoaCustomAllocationKey, Unit } from "@/data/types";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteAnnualStatementCostItemAction, saveAnnualStatementCostItemAction } from "@/app/(app)/weg/jahresabrechnung/actions";

/**
 * Zeile der Kostenpositionen-Tabelle der Jahresabrechnung: Kostenposition inkl.
 * Verbrauchswerte, angereichert um die serverseitig aufgelösten Bezeichnungen
 * der Direkt-Zuordnung (Einheit) bzw. des frei definierten Verteilerschlüssels
 * für die Zell-Unterzeilen (Maps sind als Client-Props nicht serialisierbar).
 */
export type AnnualStatementCostItemRow = HoaCostItemWithConsumptionValues & {
	directUnitLabel?: string;
	customAllocationKeyLabel?: string;
};

/**
 * Tabelle der Kostenpositionen einer Jahresabrechnung. Finalisierte
 * Abrechnungen sind nicht mehr bearbeitbar: Die Aktionen-Spalte zeigt dann
 * statt der Dialoge/Lösch-Buttons nur noch den Status-Hinweis.
 */
export function AnnualStatementCostItemsTable({
	rows,
	isDraft,
	statementId,
	hoaId,
	units,
	customAllocationKeys,
}: {
	rows: AnnualStatementCostItemRow[];
	isDraft: boolean;
	statementId: string;
	hoaId: string;
	units: Unit[];
	customAllocationKeys: HoaCustomAllocationKey[];
}) {
	const { t } = useI18n();

	// In der Jahresabrechnung zulässige Umlageschlüssel (incl. CONSUMPTION,
	// siehe HOA_ALLOCATION_KEYS in der actions-Datei).
	const allocationKeyOptions = (["MEA", "LIVING_SPACE", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"] as const).map((value) => ({
		value,
		label: t(`hoaPlan.allocationKey.${value}`),
	}));

	const columns: DataTableColumn<AnnualStatementCostItemRow>[] = [
		{
			key: "label",
			header: t("hoaStatement.table.label"),
			sortValue: (row) => row.label,
			filter: {
				type: "text",
				value: (row) => [row.label, row.notes, row.directUnitLabel, row.customAllocationKeyLabel].filter(Boolean).join(" "),
			},
			cell: (row) => (
				<span className="font-medium">
					{row.label}
					{row.notes ? <span className="block text-xs text-muted-foreground">{row.notes}</span> : null}
				</span>
			),
		},
		{
			key: "allocationKey",
			header: t("hoaStatement.table.allocationKey"),
			sortValue: (row) => t(`hoaPlan.allocationKey.${row.allocationKey}`),
			filter: { type: "select", value: (row) => row.allocationKey, options: allocationKeyOptions },
			cell: (row) => (
				<span className="text-muted-foreground">
					{t(`hoaPlan.allocationKey.${row.allocationKey}`)}
					{row.directUnitLabel ? <span className="block text-xs text-muted-foreground">{row.directUnitLabel}</span> : null}
					{row.customAllocationKeyLabel ? <span className="block text-xs text-muted-foreground">{row.customAllocationKeyLabel}</span> : null}
				</span>
			),
		},
		{
			key: "apportionable",
			header: t("hoaStatement.table.apportionable"),
			sortValue: (row) => (row.isApportionable ? 1 : 0),
			filter: {
				type: "select",
				value: (row) => (row.isApportionable ? "yes" : "no"),
				options: [
					{ value: "yes", label: t("common.yes") },
					{ value: "no", label: t("common.no") },
				],
			},
			cell: (row) => <span className="text-muted-foreground">{row.isApportionable ? t("common.yes") : t("common.no")}</span>,
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
			headClassName: "w-[130px] text-right",
			cellClassName: "text-right",
			cell: (row) =>
				isDraft ? (
					<div className="flex items-center justify-end gap-1">
						{row.allocationKey === "CONSUMPTION" ? (
							<HoaConsumptionValuesDialog hoaId={hoaId} costItemId={row.id} costItemLabel={row.label} units={units} consumptionValues={row.consumptionValues} />
						) : null}
						<HoaCostItemFormDialog
							action={saveAnnualStatementCostItemAction}
							parentIdFieldName="annualStatementId"
							parentId={statementId}
							hoaId={hoaId}
							costItem={row}
							units={units}
							customAllocationKeys={customAllocationKeys}
							showApportionable
						/>
						<ConfirmDeleteButton
							action={deleteAnnualStatementCostItemAction.bind(null, row.id, hoaId, statementId)}
							confirmMessage={t("hoaStatement.confirm.deleteCostItem", { label: row.label })}
						/>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">{t("hoaStatement.status.FINALIZED")}</span>
				),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}