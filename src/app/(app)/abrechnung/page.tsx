import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";

import { getCostItemCountsByPeriod, listBillingPeriods, listPropertiesSortedByName } from "@/data/billing";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { BillingPeriodFormDialog } from "@/components/abrechnung/billing-period-form-dialog";
import { BillingPropertyFilter } from "@/components/abrechnung/billing-property-filter";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { billingPeriodStatusStyles } from "@/lib/billing";

import { deleteBillingPeriodAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AbrechnungPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
	const t = await getT();
	const { propertyId } = await searchParams;

	const billingPeriodList = listBillingPeriods(propertyId ? { propertyId } : undefined);
	const propertyList = listPropertiesSortedByName();
	const costItemCountMap = getCostItemCountsByPeriod();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("billing.title")} description={t("billing.description")} actions={<BillingPeriodFormDialog properties={propertyList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{propertyList.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("billing.empty.noProperties")}</p>
				) : (
					<BillingPropertyFilter properties={propertyList} value={propertyId} />
				)}
				<Card>
					<CardContent className="p-0">
						{billingPeriodList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{propertyId ? t("billing.empty.periodsFiltered") : t("billing.empty.periods")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("common.property")}</TableHead>
										<TableHead>{t("billing.table.period")}</TableHead>
										<TableHead>{t("billing.table.costItems")}</TableHead>
										<TableHead>{t("common.status")}</TableHead>
										<TableHead className="w-[140px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{billingPeriodList.map((billingPeriod) => (
										<TableRow key={billingPeriod.id} id={`billing-period-${billingPeriod.id}`}>
											<TableCell className="font-medium">
												<Link href={`/liegenschaften#property-${billingPeriod.propertyId}`} className="hover:underline">
													{billingPeriod.propertyName}
												</Link>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(billingPeriod.periodFrom)} – {formatDate(billingPeriod.periodTo)}
											</TableCell>
											<TableCell className="text-muted-foreground">{costItemCountMap.get(billingPeriod.id) ?? 0}</TableCell>
										<TableCell>
											<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${billingPeriodStatusStyles[billingPeriod.status]}`}>
												{t(`billing.status.${billingPeriod.status}`)}
											</span>
										</TableCell>
										<TableCell>
											<div className="flex items-center justify-end gap-1">
												<Button variant="ghost" size="icon-sm" aria-label={t("common.details")} title={t("common.details")} asChild>
													<Link href={`/abrechnung/${billingPeriod.id}`}>
														<ChevronRight className="size-4" />
													</Link>
												</Button>
												{billingPeriod.status === "DRAFT" ? (
													<ConfirmDeleteButton
														action={deleteBillingPeriodAction.bind(null, billingPeriod.id)}
														confirmMessage={t("billing.confirm.deletePeriod")}
													/>
												) : null}
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
