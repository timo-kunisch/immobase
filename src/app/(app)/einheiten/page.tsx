import { DoorOpen } from "lucide-react";

import { listProperties } from "@/data/properties";
import { getUnitStats, listActiveLeasesWithTenants, listUnits } from "@/data/units";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { UnitFormDialog } from "@/components/einheiten/unit-form-dialog";
import { UnitsTable } from "@/components/einheiten/units-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EinheitenPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
	const t = await getT();
	const { propertyId } = await searchParams;

	// Liegenschaften für das Formular alphabetisch (bisher per
	// SQL ORDER BY name, jetzt im Anschluss an listProperties() sortiert -
	// Code-Unit-Vergleich entspricht der SQLite-BINARY-Kollation).
	const propertyList = [...listProperties()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnits(propertyId ? { propertyId } : undefined);
	const statsMap = getUnitStats();
	// Aktive Mietverhältnisse je Einheit (für die Vermietet/Leerstand-Anzeige)
	const activeLeaseByUnit = new Map(listActiveLeasesWithTenants().map((lease) => [lease.unitId, lease]));

	// Maps sind als Client-Props nicht serialisierbar - Statistik und aktiven
	// Mietvertrag direkt in die Zeilen einbetten.
	const rows = unitList.map((unit) => {
		const activeLease = activeLeaseByUnit.get(unit.id);
		return {
			...unit,
			stats: statsMap.get(unit.id),
			activeLease: activeLease
				? { id: activeLease.id, tenantFirstName: activeLease.tenantFirstName, tenantLastName: activeLease.tenantLastName }
				: undefined,
		};
	});

	return (
		<div className="flex flex-1 flex-col">
		<SiteHeader title={t("units.title")} description={t("units.description")} actions={<UnitFormDialog properties={propertyList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
			{propertyList.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("units.noProperties")}</p>
			) : null}
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
							<DoorOpen className="size-8" />
							<p>{propertyId ? t("units.emptyFiltered") : t("units.empty")}</p>
							</div>
						) : (
							<UnitsTable rows={rows} properties={propertyList} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
