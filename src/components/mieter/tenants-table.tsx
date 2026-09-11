"use client";

import { FileSignature, FileText } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { TenantFormDialog } from "@/components/mieter/tenant-form-dialog";
import type { TenantStats } from "@/data/tenants";
import type { Tenant } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deleteTenantAction } from "@/app/(app)/mieter/actions";

/** Zeile der Mieter-Tabelle: Mieter angereichert um seine Statistik. */
export type TenantRow = Tenant & { stats?: TenantStats };

export function TenantsTable({ rows }: { rows: TenantRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<TenantRow>[] = [
		{
			key: "name",
			header: t("common.name"),
			sortValue: (row) => `${row.lastName} ${row.firstName}`,
			filter: { type: "text", value: (row) => `${row.firstName} ${row.lastName}` },
			cell: (row) => (
				<span className="font-medium">
					{row.firstName} {row.lastName}
				</span>
			),
		},
		{
			key: "contact",
			header: t("tenants.table.contact"),
			sortValue: (row) => row.email ?? "",
			filter: { type: "text", value: (row) => [row.email, row.phone].filter(Boolean).join(" · ") },
			cell: (row) => <span className="text-muted-foreground">{[row.email, row.phone].filter(Boolean).join(" · ") || "–"}</span>,
		},
		{
			key: "address",
			header: t("tenants.table.address"),
			sortValue: (row) => `${row.street ?? ""} ${row.zipCode ?? ""} ${row.city ?? ""}`.trim(),
			filter: { type: "text", value: (row) => [row.street, [row.zipCode, row.city].filter(Boolean).join(" "), row.country].filter(Boolean).join(", ") },
			cell: (row) => {
				const cityLine = [row.zipCode, row.city].filter(Boolean).join(" ");
				const parts = [row.street, cityLine].filter(Boolean).join(", ");
				return <span className="text-muted-foreground">{parts || "–"}</span>;
			},
		},
		{
			key: "linked",
			header: t("tenants.table.linked"),
			cell: (row) => (
				<div className="flex items-center gap-1.5">
					<CountLinkBadge
						href={`/vertraege?tenantId=${row.id}`}
						count={row.stats?.leases ?? 0}
						label={t("tenants.linked.leases")}
						icon={FileSignature}
					/>
					{(row.stats?.documents ?? 0) > 0 ? (
						<CountLinkBadge
							href={`/dokumente?tenantId=${row.id}`}
							count={row.stats!.documents}
							label={t("tenants.linked.documents")}
							icon={FileText}
						/>
					) : null}
					{(row.stats?.generatedDocuments ?? 0) > 0 ? (
						<CountLinkBadge
							href={`/vorlagen?tenantId=${row.id}`}
							count={row.stats!.generatedDocuments}
							label={t("tenants.linked.letters")}
							icon={FileText}
						/>
					) : null}
				</div>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<TenantFormDialog tenant={row} />
					<ConfirmDeleteButton
						action={deleteTenantAction.bind(null, row.id)}
						confirmMessage={t("tenants.confirm.delete", { name: `${row.firstName} ${row.lastName}` })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `tenant-${row.id}`} />;
}
