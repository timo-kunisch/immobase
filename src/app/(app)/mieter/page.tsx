import { FileSignature, FileText, Users } from "lucide-react";

import { getTenantStats, listTenants } from "@/data/tenants";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { TenantFormDialog } from "@/components/mieter/tenant-form-dialog";
import { getT } from "@/lib/i18n/server";

import { deleteTenantAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MieterPage() {
	const t = await getT();
	const tenantList = listTenants();
	const statsMap = getTenantStats();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("tenants.title")} description={t("tenants.description")} actions={<TenantFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{tenantList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>{t("tenants.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("common.name")}</TableHead>
										<TableHead>{t("tenants.table.contact")}</TableHead>
										<TableHead>{t("tenants.table.linked")}</TableHead>
										<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
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
														<CountLinkBadge
															href={`/vertraege?tenantId=${tenant.id}`}
															count={stats?.leases ?? 0}
															label={t("tenants.linked.leases")}
															icon={FileSignature}
														/>
														{(stats?.documents ?? 0) > 0 ? (
															<CountLinkBadge
																href={`/dokumente?tenantId=${tenant.id}`}
																count={stats!.documents}
																label={t("tenants.linked.documents")}
																icon={FileText}
															/>
														) : null}
														{(stats?.generatedDocuments ?? 0) > 0 ? (
															<CountLinkBadge
																href={`/vorlagen?tenantId=${tenant.id}`}
																count={stats!.generatedDocuments}
																label={t("tenants.linked.letters")}
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
															confirmMessage={t("tenants.confirm.delete", { name: `${tenant.firstName} ${tenant.lastName}` })}
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
