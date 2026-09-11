"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { CustomAllocationKeyFormDialog } from "@/components/abrechnung/custom-allocation-key-form-dialog";
import { CustomAllocationWeightsDialog } from "@/components/abrechnung/custom-allocation-weights-dialog";
import type { CustomAllocationKeyWithWeights } from "@/data/custom-allocation-keys";
import type { Unit } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deleteCustomAllocationKeyAction } from "@/app/(app)/abrechnung/actions";

/**
 * Tabelle der frei definierbaren Umlageschlüssel einer Liegenschaft
 * (Reiter „Umlageschlüssel" der Abrechnungs-Listenansicht).
 */
export function CustomAllocationKeysTable({
	propertyId,
	rows,
	units,
}: {
	propertyId: string;
	rows: CustomAllocationKeyWithWeights[];
	units: Unit[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<CustomAllocationKeyWithWeights>[] = [
		{
			key: "label",
			header: t("billing.table.label"),
			sortValue: (row) => row.label,
			filter: { type: "text", value: (row) => row.label },
			cell: (row) => <span className="font-medium">{row.label}</span>,
		},
		{
			key: "notes",
			header: t("common.notes"),
			sortValue: (row) => row.notes,
			filter: { type: "text", value: (row) => row.notes },
			cell: (row) => <span className="text-muted-foreground">{row.notes ?? "–"}</span>,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[120px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<CustomAllocationWeightsDialog
						propertyId={propertyId}
						customAllocationKeyId={row.id}
						customAllocationKeyLabel={row.label}
						units={units}
						weights={row.weights}
					/>
					<CustomAllocationKeyFormDialog propertyId={propertyId} customAllocationKey={row} />
					<ConfirmDeleteButton
						action={deleteCustomAllocationKeyAction.bind(null, row.id)}
						confirmMessage={t("billing.allocationKeys.confirm.delete", { name: row.label })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
