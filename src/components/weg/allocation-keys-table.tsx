"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { CustomAllocationKeyFormDialog } from "@/components/weg/custom-allocation-key-form-dialog";
import { CustomAllocationWeightsDialog } from "@/components/weg/custom-allocation-weights-dialog";
import type { CustomAllocationKeyWithWeights } from "@/data/hoa-allocation-keys";
import type { Unit } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deleteCustomAllocationKeyAction } from "@/app/(app)/weg/verteilerschluessel/actions";

/**
 * Tabelle der frei definierten Verteilerschlüssel der ausgewählten WEG.
 * Die Gewichte sind als serialisierbares Array je Zeile enthalten; die
 * Dialoge benötigen zusätzlich die Einheiten der Liegenschaft.
 */
export function AllocationKeysTable({
	rows,
	hoaId,
	units,
}: {
	rows: CustomAllocationKeyWithWeights[];
	hoaId: string;
	units: Unit[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<CustomAllocationKeyWithWeights>[] = [
		{
			key: "label",
			header: t("hoa.table.name"),
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
						hoaId={hoaId}
						customAllocationKeyId={row.id}
						customAllocationKeyLabel={row.label}
						units={units}
						weights={row.weights}
					/>
					<CustomAllocationKeyFormDialog hoaId={hoaId} customAllocationKey={row} />
					<ConfirmDeleteButton
						action={deleteCustomAllocationKeyAction.bind(null, row.id, hoaId)}
						confirmMessage={t("hoa.allocationKeys.confirm.delete", { name: row.label })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
