"use client";

import { Building2 } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { OwnerFormDialog } from "@/components/weg/owner-form-dialog";
import type { Owner } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

import { deleteOwnerAction } from "@/app/(app)/weg/eigentuemer/actions";

/**
 * Zeile der Eigentümer-Tabelle: Eigentümer angereichert um die Anzahl
 * seiner Eigentumsverhältnisse (serverseitig aus der Zähler-Map ermittelt,
 * da Maps nicht als Client-Props serialisierbar sind).
 */
export type OwnerRow = Owner & { ownershipCount: number };

export function OwnersTable({ rows }: { rows: OwnerRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<OwnerRow>[] = [
		{
			key: "name",
			header: t("common.name"),
			sortValue: (row) => `${row.lastName} ${row.firstName}`,
			filter: {
				type: "text",
				value: (row) => `${row.firstName} ${row.lastName}${row.companyName ? ` ${row.companyName}` : ""}`,
			},
			cell: (row) => (
				<span className="font-medium">
					{row.firstName} {row.lastName}
					{row.isCompany && row.companyName ? <span className="block text-xs text-muted-foreground">{row.companyName}</span> : null}
				</span>
			),
		},
		{
			key: "address",
			header: t("hoa.owners.table.address"),
			sortValue: (row) => `${row.street}, ${row.zipCode} ${row.city}`,
			filter: { type: "text", value: (row) => `${row.street}, ${row.zipCode} ${row.city}` },
			cell: (row) => (
				<span className="text-muted-foreground">
					{row.street}, {row.zipCode} {row.city}
				</span>
			),
		},
		{
			key: "contact",
			header: t("hoa.owners.table.contact"),
			sortValue: (row) => [row.email, row.phone].filter(Boolean).join(" · "),
			filter: { type: "text", value: (row) => [row.email, row.phone].filter(Boolean).join(" · ") },
			cell: (row) => <span className="text-muted-foreground">{[row.email, row.phone].filter(Boolean).join(" · ") || "–"}</span>,
		},
		{
			key: "linked",
			header: t("hoa.table.linked"),
			cell: (row) => (
				<CountLinkBadge href="/weg/eigentumsverhaeltnisse" count={row.ownershipCount} label={t("hoa.badge.ownerships")} icon={Building2} />
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<OwnerFormDialog owner={row} />
					<ConfirmDeleteButton
						action={deleteOwnerAction.bind(null, row.id)}
						confirmMessage={t("hoa.owners.confirm.delete", { name: `${row.firstName} ${row.lastName}` })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `owner-${row.id}`} />;
}
