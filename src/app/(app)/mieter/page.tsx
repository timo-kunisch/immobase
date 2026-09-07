import { FileSignature, FileText, Users } from "lucide-react";

import { getTenantStats, listTenants } from "@/data/tenants";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { TenantFormDialog } from "@/components/mieter/tenant-form-dialog";

import { deleteTenantAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MieterPage() {
	const tenantList = listTenants();
	const statsMap = getTenantStats();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Mieter" description="Alle Mieter im Überblick." actions={<TenantFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{tenantList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>Noch keine Mieter angelegt.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Kontakt</TableHead>
										<TableHead>Verknüpft</TableHead>
										<TableHead className="w-[100px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{tenantList.map((tenant) => {
										const stats = statsMap.get(tenant.id);
										return (
											<TableRow key={tenant.id} id={`tenant-${tenant.id}`}>
												<TableCell className="font-medium">
													{tenant.firstName} {tenant.lastName}
												</TableCell>
												<TableCell className="text-muted-foreground">{[tenant.email, tenant.phone].filter(Boolean).join(" · ") || "–"}</TableCell>
												<TableCell>
													<div className="flex items-center gap-1.5">
														<CountLinkBadge href={`/vertraege?tenantId=${tenant.id}`} count={stats?.leases ?? 0} label="Verträge" icon={FileSignature} />
														{(stats?.documents ?? 0) > 0 ? (
															<CountLinkBadge href={`/dokumente?tenantId=${tenant.id}`} count={stats!.documents} label="Dokumente" icon={FileText} />
														) : null}
														{(stats?.generatedDocuments ?? 0) > 0 ? (
															<CountLinkBadge
																href={`/vorlagen?tenantId=${tenant.id}`}
																count={stats!.generatedDocuments}
																label="Schreiben"
																icon={FileText}
															/>
														) : null}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<TenantFormDialog tenant={tenant} />
														<ConfirmDeleteButton
															action={deleteTenantAction.bind(null, tenant.id)}
															confirmMessage={`Mieter "${tenant.firstName} ${tenant.lastName}" wirklich löschen?`}
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
