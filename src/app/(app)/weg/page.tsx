import Link from "next/link";
import { Building2, ChevronRight, DoorOpen, Users } from "lucide-react";

import { getHoaStats, listAvailablePropertiesForHoa, listHoasWithProperty } from "@/data/hoas";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { HoaFormDialog } from "@/components/weg/hoa-form-dialog";
import { getT } from "@/lib/i18n/server";

import { deleteHoaAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WegPage() {
	const t = await getT();
	const hoaList = listHoasWithProperty();
	// Nur Liegenschaften anbieten, die noch keiner WEG zugeordnet sind
	// (1:1-Beziehung über hoas.property_id).
	const availableProperties = listAvailablePropertiesForHoa();
	const statsMap = getHoaStats();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoa.title")} description={t("hoa.description")} actions={<HoaFormDialog availableProperties={availableProperties} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{hoaList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Building2 className="size-8" />
								<p>{t("hoa.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("hoa.table.name")}</TableHead>
										<TableHead>{t("hoa.table.property")}</TableHead>
										<TableHead>{t("hoa.table.linked")}</TableHead>
										<TableHead className="w-[140px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{hoaList.map((hoa) => {
										const stats = statsMap.get(hoa.id);
										return (
											<TableRow key={hoa.id} id={`hoa-${hoa.id}`}>
												<TableCell className="font-medium">{hoa.name}</TableCell>
												<TableCell className="text-muted-foreground">
													<Link href={`/liegenschaften#property-${hoa.propertyId}`} className="hover:underline">
														{hoa.property.name}
													</Link>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1.5">
														<CountLinkBadge href={`/einheiten?propertyId=${hoa.propertyId}`} count={stats?.units ?? 0} label={t("hoa.badge.units")} icon={DoorOpen} />
														<CountLinkBadge href={`/weg/eigentumsverhaeltnisse?hoaId=${hoa.id}`} count={stats?.ownerships ?? 0} label={t("hoa.badge.ownerships")} icon={Users} />
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<HoaFormDialog hoa={hoa} availableProperties={[hoa.property, ...availableProperties]} />
														<Button variant="ghost" size="icon-sm" aria-label={t("common.details")} title={t("common.details")} asChild>
															<Link href={`/weg/eigentumsverhaeltnisse?hoaId=${hoa.id}`}>
																<ChevronRight className="size-4" />
															</Link>
														</Button>
														<ConfirmDeleteButton action={deleteHoaAction.bind(null, hoa.id)} confirmMessage={t("hoa.confirm.delete", { name: hoa.name })} />
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
