import { Building2, DoorOpen, FileText, Wrench } from "lucide-react";

import { listProperties, getPropertyStats } from "@/data/properties";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { PropertyFormDialog } from "@/components/liegenschaften/property-form-dialog";

import { deletePropertyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LiegenschaftenPage() {
	const propertyList = listProperties();
	const statsMap = getPropertyStats();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Liegenschaften" description="Verwalten Sie Ihre Gebäude und Objekte." actions={<PropertyFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{propertyList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Building2 className="size-8" />
								<p>Noch keine Liegenschaften angelegt.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Bezeichnung</TableHead>
										<TableHead>Adresse</TableHead>
										<TableHead className="text-right">Verknüpft</TableHead>
										<TableHead className="w-[100px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{propertyList.map((property) => {
										const stats = statsMap.get(property.id);
										return (
											<TableRow key={property.id} id={`property-${property.id}`}>
												<TableCell className="font-medium">{property.name}</TableCell>
												<TableCell className="text-muted-foreground">
													{property.street}, {property.zipCode} {property.city}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1.5">
														<CountLinkBadge
															href={`/einheiten?propertyId=${property.id}`}
															count={stats?.units ?? 0}
															label="Einheiten"
															icon={DoorOpen}
														/>
														{(stats?.openTickets ?? 0) > 0 ? (
															<CountLinkBadge
																href={`/tickets?propertyId=${property.id}`}
																count={stats!.openTickets}
																label="Tickets"
																icon={Wrench}
																className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
															/>
														) : null}
														{(stats?.documents ?? 0) > 0 ? (
															<CountLinkBadge
																href={`/dokumente?propertyId=${property.id}`}
																count={stats!.documents}
																label="Dokumente"
																icon={FileText}
															/>
														) : null}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<PropertyFormDialog property={property} />
														<ConfirmDeleteButton
															action={deletePropertyAction.bind(null, property.id)}
															confirmMessage={`Liegenschaft "${property.name}" wirklich löschen?`}
														/>
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
