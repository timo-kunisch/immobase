"use client";

import Link from "next/link";
import { FileText, Wallet } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LeaseFormDialog } from "@/components/vertraege/lease-form-dialog";
import { RentHistoryDialog } from "@/components/vertraege/rent-history-dialog";
import type { LeaseWithDetails } from "@/data/leases";
import type { UnitWithProperty } from "@/data/lease-joins";
import type { Tenant } from "@/data/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { leaseStatusStyles, type LeaseStatusValue } from "@/lib/lease-status";

import { deleteLeaseAction } from "@/app/(app)/vertraege/actions";

/**
 * Zeile der Vertrags-Tabelle: Vertrag inkl. Relationen, angereichert um
 * den abgeleiteten Status sowie die aktuell gültige Kaltmiete/Nebenkosten
 * (serverseitig berechnet, da Maps/Funktionen nicht als Props serialisierbar
 * sind und die Beträge als Decimal-Strings vorliegen).
 */
export type LeaseRow = LeaseWithDetails & {
	status: LeaseStatusValue;
	currentColdRent: number;
	currentServiceCharges: number;
};

export function LeasesTable({ rows, units, tenants }: { rows: LeaseRow[]; units: UnitWithProperty[]; tenants: Tenant[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<LeaseRow>[] = [
		{
			key: "unit",
			header: t("common.unit"),
			sortValue: (row) => `${row.unit.property.name} – ${row.unit.label}`,
			filter: { type: "text", value: (row) => `${row.unit.property.name} – ${row.unit.label}` },
			cell: (row) => (
				<Link href={`/einheiten#unit-${row.unitId}`} className="font-medium hover:underline">
					{row.unit.property.name} – {row.unit.label}
				</Link>
			),
		},
		{
			key: "tenant",
			header: t("common.tenant"),
			sortValue: (row) => `${row.tenant.lastName} ${row.tenant.firstName}`,
			filter: { type: "text", value: (row) => `${row.tenant.firstName} ${row.tenant.lastName}` },
			cell: (row) => (
				<Link href={`/mieter#tenant-${row.tenantId}`} className="hover:underline">
					{row.tenant.firstName} {row.tenant.lastName}
				</Link>
			),
		},
		{
			key: "period",
			header: t("leases.table.period"),
			sortValue: (row) => row.startDate,
			filter: {
				type: "text",
				value: (row) => `${formatDate(row.startDate)} – ${row.endDate ? formatDate(row.endDate) : t("leases.period.open")}`,
			},
			cell: (row) => (
				<span className="text-muted-foreground">
					{formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : t("leases.period.open")}
				</span>
			),
		},
		{
			key: "coldRent",
			header: t("leases.table.coldRentCurrent"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.currentColdRent,
			cell: (row) => formatCurrency(row.currentColdRent),
		},
		{
			key: "serviceCharges",
			header: t("leases.table.serviceChargesCurrent"),
			align: "right",
			headClassName: "text-right",
			cellClassName: "text-right",
			sortValue: (row) => row.currentServiceCharges,
			cell: (row) => formatCurrency(row.currentServiceCharges),
		},
		{
			key: "status",
			header: t("common.status"),
			sortValue: (row) => row.status,
			filter: {
				type: "select",
				value: (row) => row.status,
				options: [
					{ value: "ACTIVE", label: t("leases.status.ACTIVE") },
					{ value: "UPCOMING", label: t("leases.status.UPCOMING") },
					{ value: "ENDED", label: t("leases.status.ENDED") },
				],
			},
			cell: (row) => (
				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${leaseStatusStyles[row.status]}`}>{t(`leases.status.${row.status}`)}</span>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[140px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<RentHistoryDialog lease={row} adjustments={row.rentAdjustments} hasAdjustments={row.rentAdjustments.length > 0} />
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("leases.actions.finances")}
						title={t("leases.actions.finances")}
						asChild
					>
						<Link href={`/finanzen?leaseId=${row.id}`}>
							<Wallet className="size-4" />
						</Link>
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("leases.actions.letters")}
						title={t("leases.actions.letters")}
						asChild
					>
						<Link href={`/vorlagen?leaseId=${row.id}`}>
							<FileText className="size-4" />
						</Link>
					</Button>
					<LeaseFormDialog lease={row} units={units} tenants={tenants} />
					<ConfirmDeleteButton action={deleteLeaseAction.bind(null, row.id)} confirmMessage={t("leases.confirm.delete")} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `lease-${row.id}`} />;
}
