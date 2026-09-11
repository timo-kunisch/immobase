import Link from "next/link";
import { FileSignature } from "lucide-react";

import { getTenant, getUnitWithProperty, listLeasesWithDetails, listTenants, listUnitsWithProperty } from "@/data/leases";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { LeaseFormDialog } from "@/components/vertraege/lease-form-dialog";
import { LeasesTable, type LeaseRow } from "@/components/vertraege/leases-table";
import { getT } from "@/lib/i18n/server";
import { getLeaseStatus } from "@/lib/lease-status";
import { getRentForDate } from "@/lib/rent-history";

export const dynamic = "force-dynamic";

export default async function VertraegePage({ searchParams }: { searchParams: Promise<{ unitId?: string; tenantId?: string }> }) {
	const t = await getT();
	const { unitId, tenantId } = await searchParams;

	const leaseList = listLeasesWithDetails({ unitId, tenantId });
	const unitList = listUnitsWithProperty();
	const tenantList = listTenants();
	const filteredUnit = unitId ? getUnitWithProperty(unitId) : null;
	const filteredTenant = tenantId ? getTenant(tenantId) : null;

	const filterLabel = filteredUnit ? `${filteredUnit.property.name} – ${filteredUnit.label}` : filteredTenant ? `${filteredTenant.firstName} ${filteredTenant.lastName}` : null;

	// Status und aktuell gültige Miete serverseitig berechnen (Funktionen wie
	// getRentForDate sind nicht als Client-Props serialisierbar).
	const rows: LeaseRow[] = leaseList.map((lease) => {
		const currentRent = getRentForDate(lease, lease.rentAdjustments);
		return {
			...lease,
			status: getLeaseStatus(lease),
			currentColdRent: currentRent.coldRent,
			currentServiceCharges: currentRent.serviceCharges,
		};
	});

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("leases.title")} description={t("leases.description")} actions={<LeaseFormDialog units={unitList} tenants={tenantList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{filterLabel ? (
					<p className="text-sm text-muted-foreground">
						{t("leases.filter.filteredBy")} <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
						<Link href="/vertraege" className="text-primary hover:underline">
							{t("common.resetFilters")}
						</Link>
					</p>
				) : null}
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<FileSignature className="size-8" />
								<p>{filterLabel ? t("leases.emptyFiltered") : t("leases.empty")}</p>
							</div>
						) : (
							<LeasesTable rows={rows} units={unitList} tenants={tenantList} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
