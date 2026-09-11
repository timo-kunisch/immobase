import { Users } from "lucide-react";

import { listHoasWithProperty } from "@/data/hoas";
import { listOwners } from "@/data/owners";
import { listUnitsWithOwnerships } from "@/data/unit-ownerships";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { UnitOwnershipFormDialog } from "@/components/weg/unit-ownership-form-dialog";
import { UnitOwnershipsTable } from "@/components/weg/unit-ownerships-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Flache Top-Level-Seite (statt einer WEG-Detail-Unterseite) - konsistent
 * zum Muster der Mietverwaltung (z. B. /einheiten?propertyId=). Ohne hoaId
 * werden die Einheiten aller WEGs angezeigt.
 */
export default async function EigentumsverhaeltnissePage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;
	const t = await getT();

	// WEGs für den Filter alphabetisch (bisher per SQL ORDER BY name, jetzt im
	// Anschluss an listHoasWithProperty() sortiert - Code-Unit-Vergleich
	// entspricht der SQLite-BINARY-Kollation).
	const hoaList = [...listHoasWithProperty()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	// Ungültige/veraltete hoaId-Filter fallen auf "alle WEGs" zurück.
	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	const units = listUnitsWithOwnerships(selectedHoa?.id);
	const ownerList = listOwners();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoa.ownerships.title")} description={t("hoa.ownerships.description")} actions={<UnitOwnershipFormDialog units={units} owners={ownerList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{hoaList.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("hoa.noHoa")}</p>
				) : (
					<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/eigentumsverhaeltnisse" />
				)}

				{units.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("hoa.ownerships.noUnits")}</p>
				) : (
					<div className="space-y-4">
						{units.map((unit) => (
							<Card key={unit.id} id={`unit-ownerships-${unit.id}`}>
								<CardContent className="space-y-3 pt-6">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="font-medium">
												{unit.propertyName} – {unit.label}
											</h3>
											<p className="text-xs text-muted-foreground">
												{t("hoa.ownerships.meaValue", { share: unit.coOwnershipShare ?? "–", total: unit.hoaTotalShares })}
												{unit.livingSpace ? t("hoa.ownerships.livingSpaceSuffix", { value: unit.livingSpace }) : ""}
											</p>
										</div>
										<UnitOwnershipFormDialog units={units} owners={ownerList} defaultUnitId={unit.id} />
									</div>

									{unit.ownerships.length === 0 ? (
										<div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
											<Users className="size-4" />
											{t("hoa.ownerships.empty")}
										</div>
									) : (
										<UnitOwnershipsTable ownerships={unit.ownerships} units={units} owners={ownerList} />
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
