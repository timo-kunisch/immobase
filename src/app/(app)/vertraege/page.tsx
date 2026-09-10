import Link from "next/link";
import { FileSignature, FileText, Wallet } from "lucide-react";

import { getTenant, getUnitWithProperty, listLeasesWithDetails, listTenants, listUnitsWithProperty } from "@/data/leases";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { LeaseFormDialog } from "@/components/vertraege/lease-form-dialog";
import { RentHistoryDialog } from "@/components/vertraege/rent-history-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRentForDate } from "@/lib/rent-history";
import { getLeaseStatus, leaseStatusStyles } from "@/lib/lease-status";
import { getT } from "@/lib/i18n/server";

import { deleteLeaseAction } from "./actions";

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
						{leaseList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<FileSignature className="size-8" />
								<p>{filterLabel ? t("leases.emptyFiltered") : t("leases.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("common.unit")}</TableHead>
										<TableHead>{t("common.tenant")}</TableHead>
										<TableHead>{t("leases.table.period")}</TableHead>
										<TableHead className="text-right">{t("leases.table.coldRentCurrent")}</TableHead>
										<TableHead className="text-right">{t("leases.table.serviceChargesCurrent")}</TableHead>
										<TableHead>{t("common.status")}</TableHead>
										<TableHead className="w-[140px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{leaseList.map((lease) => {
										const currentRent = getRentForDate(lease, lease.rentAdjustments);
										const hasAdjustments = lease.rentAdjustments.length > 0;
										const status = getLeaseStatus(lease);
										return (
											<TableRow key={lease.id} id={`lease-${lease.id}`}>
												<TableCell className="font-medium">
													<Link href={`/einheiten#unit-${lease.unitId}`} className="hover:underline">
														{lease.unit.property.name} – {lease.unit.label}
													</Link>
												</TableCell>
												<TableCell>
													<Link href={`/mieter#tenant-${lease.tenantId}`} className="hover:underline">
														{lease.tenant.firstName} {lease.tenant.lastName}
													</Link>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{formatDate(lease.startDate)} – {lease.endDate ? formatDate(lease.endDate) : t("leases.period.open")}
												</TableCell>
												<TableCell className="text-right">{formatCurrency(currentRent.coldRent)}</TableCell>
												<TableCell className="text-right">{formatCurrency(currentRent.serviceCharges)}</TableCell>
												<TableCell>
													<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${leaseStatusStyles[status]}`}>{t(`leases.status.${status}`)}</span>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<RentHistoryDialog lease={lease} adjustments={lease.rentAdjustments} hasAdjustments={hasAdjustments} />
														<Button
															variant="ghost"
															size="icon-sm"
															aria-label={t("leases.actions.finances")}
															title={t("leases.actions.finances")}
															asChild
														>
															<Link href={`/finanzen?leaseId=${lease.id}`}>
																<Wallet className="size-4" />
															</Link>
														</Button>
														<Button
															variant="ghost"
															size="icon-sm"
															aria-label={t("leases.actions.letters")}
															title={t("leases.actions.letters")}
															asChild
														>
															<Link href={`/vorlagen?leaseId=${lease.id}`}>
																<FileText className="size-4" />
															</Link>
														</Button>
														<LeaseFormDialog lease={lease} units={unitList} tenants={tenantList} />
														<ConfirmDeleteButton action={deleteLeaseAction.bind(null, lease.id)} confirmMessage={t("leases.confirm.delete")} />
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
