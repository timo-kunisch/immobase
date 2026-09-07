import Link from "next/link";
import { DoorOpen, FileSignature, FileText, Wrench } from "lucide-react";

import { listProperties } from "@/data/properties";
import { getUnitStats, listActiveLeasesWithTenants, listUnits } from "@/data/units";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { UnitFormDialog } from "@/components/einheiten/unit-form-dialog";
import { UnitPropertyFilter } from "@/components/einheiten/unit-property-filter";
import { formatNumber } from "@/lib/format";

import { deleteUnitAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EinheitenPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
	const { propertyId } = await searchParams;

	// Liegenschaften für den Filter/das Formular alphabetisch (bisher per
	// SQL ORDER BY name, jetzt im Anschluss an listProperties() sortiert -
	// Code-Unit-Vergleich entspricht der SQLite-BINARY-Kollation).
	const propertyList = [...listProperties()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnits(propertyId ? { propertyId } : undefined);
	const statsMap = getUnitStats();
	// Aktive Mietverhältnisse je Einheit (für die Vermietet/Leerstand-Anzeige)
	const activeLeaseByUnit = new Map(listActiveLeasesWithTenants().map((lease) => [lease.unitId, lease]));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Mieteinheiten" description="Wohnungen und Gewerbeeinheiten je Liegenschaft." actions={<UnitFormDialog properties={propertyList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{propertyList.length === 0 ? (
					<p className="text-sm text-muted-foreground">Legen Sie zuerst eine Liegenschaft an, um Einheiten erfassen zu können.</p>
				) : (
					<UnitPropertyFilter properties={propertyList} value={propertyId} />
				)}
				<Card>
					<CardContent className="p-0">
						{unitList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<DoorOpen className="size-8" />
								<p>{propertyId ? "Keine Einheiten für diese Liegenschaft gefunden." : "Noch keine Einheiten angelegt."}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Einheit</TableHead>
										<TableHead>Liegenschaft</TableHead>
										<TableHead>Wohnfläche</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Verknüpft</TableHead>
										<TableHead className="w-[100px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{unitList.map((unit) => {
										const activeLease = activeLeaseByUnit.get(unit.id);
										const stats = statsMap.get(unit.id);
										return (
											<TableRow key={unit.id} id={`unit-${unit.id}`}>
												<TableCell className="font-medium">
													{unit.label}
													{unit.floor ? <span className="ml-1 text-muted-foreground">({unit.floor})</span> : null}
												</TableCell>
												<TableCell className="text-muted-foreground">
													<Link href={`/liegenschaften#property-${unit.propertyId}`} className="hover:text-foreground hover:underline">
														{unit.propertyName}
													</Link>
												</TableCell>
												<TableCell>
													{unit.livingSpace ? `${formatNumber(unit.livingSpace)} m²` : "–"}
													{unit.rooms ? ` · ${formatNumber(unit.rooms)} Zi.` : ""}
												</TableCell>
												<TableCell>
													{activeLease ? (
														<Link
															href={`/vertraege#lease-${activeLease.id}`}
															className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
														>
															Vermietet an {activeLease.tenantFirstName} {activeLease.tenantLastName}
														</Link>
													) : (
														<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
															Leerstand
														</span>
													)}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1.5">
														<CountLinkBadge href={`/vertraege?unitId=${unit.id}`} count={stats?.leases ?? 0} label="Verträge" icon={FileSignature} />
														{(stats?.openTickets ?? 0) > 0 ? (
															<CountLinkBadge
																href={`/tickets?unitId=${unit.id}`}
																count={stats!.openTickets}
																label="Tickets"
																icon={Wrench}
																className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
															/>
														) : null}
														{(stats?.documents ?? 0) > 0 ? (
															<CountLinkBadge href={`/dokumente?unitId=${unit.id}`} count={stats!.documents} label="Dokumente" icon={FileText} />
														) : null}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<UnitFormDialog unit={unit} properties={propertyList} />
														<ConfirmDeleteButton action={deleteUnitAction.bind(null, unit.id)} confirmMessage={`Einheit "${unit.label}" wirklich löschen?`} />
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
			</div>
		</div>
	);
}
