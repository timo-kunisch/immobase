import { Users } from "lucide-react";

import { listHoasWithProperty } from "@/data/hoas";
import { listOwners } from "@/data/owners";
import { listUnitsWithOwnerships } from "@/data/unit-ownerships";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { UnitOwnershipFormDialog } from "@/components/weg/unit-ownership-form-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatDate } from "@/lib/format";
import { getOwnershipStatus, ownershipStatusStyles, type OwnershipStatusValue } from "@/lib/hoa-ownership";
import { getT } from "@/lib/i18n/server";

import { deleteUnitOwnershipAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Flache Top-Level-Seite (statt einer WEG-Detail-Unterseite) - konsistent
 * zum Muster der Mietverwaltung (z. B. /einheiten?propertyId=). Ohne hoaId
 * werden die Einheiten aller WEGs angezeigt.
 */
export default async function EigentumsverhaeltnissePage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;
	const t = await getT();

	// Status-Beschriftungen kommen aus dem Sprach-Dictionary (die Stile
	// bleiben in src/lib/hoa-ownership.ts).
	const ownershipStatusLabels: Record<OwnershipStatusValue, string> = {
		ACTIVE: t("hoa.ownerships.status.ACTIVE"),
		UPCOMING: t("hoa.ownerships.status.UPCOMING"),
		ENDED: t("hoa.ownerships.status.ENDED"),
	};

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
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>{t("common.owner")}</TableHead>
													<TableHead>{t("hoa.ownerships.table.period")}</TableHead>
													<TableHead>{t("common.status")}</TableHead>
													<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{unit.ownerships.map((ownership) => {
													const status = getOwnershipStatus(ownership);
													return (
														<TableRow key={ownership.id}>
															<TableCell className="font-medium">
																{ownership.owner.firstName} {ownership.owner.lastName}
																{ownership.coOwner ? (
																	<span className="block text-xs text-muted-foreground">
																		{t("hoa.ownerships.coOwnerValue", { name: `${ownership.coOwner.firstName} ${ownership.coOwner.lastName}` })}
																	</span>
																) : null}
															</TableCell>
															<TableCell className="text-muted-foreground">
																{formatDate(ownership.startDate)} – {ownership.endDate ? formatDate(ownership.endDate) : t("hoa.ownerships.ongoing")}
															</TableCell>
															<TableCell>
																<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ownershipStatusStyles[status]}`}>{ownershipStatusLabels[status]}</span>
															</TableCell>
															<TableCell>
																<div className="flex items-center justify-end gap-1">
																	<UnitOwnershipFormDialog units={units} owners={ownerList} ownership={ownership} />
																	<ConfirmDeleteButton action={deleteUnitOwnershipAction.bind(null, ownership.id)} confirmMessage={t("hoa.ownerships.confirm.delete")} />
																</div>
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
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
