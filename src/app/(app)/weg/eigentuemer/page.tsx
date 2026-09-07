import { Building2, Users } from "lucide-react";

import { getOwnershipCountsByOwner, listOwners } from "@/data/owners";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { OwnerFormDialog } from "@/components/weg/owner-form-dialog";

import { deleteOwnerAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EigentuemerPage() {
	const ownerList = listOwners();
	const ownershipCountMap = getOwnershipCountsByOwner();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Eigentümer" description="Alle Eigentümer im Überblick." actions={<OwnerFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{ownerList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>Noch keine Eigentümer angelegt.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Anschrift</TableHead>
										<TableHead>Kontakt</TableHead>
										<TableHead>Verknüpft</TableHead>
										<TableHead className="w-[100px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{ownerList.map((owner) => (
										<TableRow key={owner.id} id={`owner-${owner.id}`}>
											<TableCell className="font-medium">
												{owner.firstName} {owner.lastName}
												{owner.isCompany && owner.companyName ? <span className="block text-xs text-muted-foreground">{owner.companyName}</span> : null}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{owner.street}, {owner.zipCode} {owner.city}
											</TableCell>
											<TableCell className="text-muted-foreground">{[owner.email, owner.phone].filter(Boolean).join(" · ") || "–"}</TableCell>
											<TableCell>
												<CountLinkBadge href="/weg/eigentumsverhaeltnisse" count={ownershipCountMap.get(owner.id) ?? 0} label="Eigentumsverhältnisse" icon={Building2} />
											</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<OwnerFormDialog owner={owner} />
													<ConfirmDeleteButton action={deleteOwnerAction.bind(null, owner.id)} confirmMessage={`Eigentümer "${owner.firstName} ${owner.lastName}" wirklich löschen?`} />
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
