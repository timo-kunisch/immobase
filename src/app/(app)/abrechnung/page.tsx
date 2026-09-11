import { Calculator, Scale } from "lucide-react";

import { getCostItemCountsByPeriod, listBillingPeriods, listPropertiesSortedByName } from "@/data/billing";
import { listCustomAllocationKeysWithWeights } from "@/data/custom-allocation-keys";
import { listUnits } from "@/data/units";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingPeriodsTable, type BillingPeriodRow } from "@/components/abrechnung/billing-periods-table";
import { BillingPeriodFormDialog } from "@/components/abrechnung/billing-period-form-dialog";
import { BillingPropertyFilter } from "@/components/abrechnung/billing-property-filter";
import { CustomAllocationKeysTable } from "@/components/abrechnung/custom-allocation-keys-table";
import { CustomAllocationKeyFormDialog } from "@/components/abrechnung/custom-allocation-key-form-dialog";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AbrechnungPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
	const t = await getT();
	const { propertyId } = await searchParams;

	const billingPeriodList = listBillingPeriods(propertyId ? { propertyId } : undefined);
	const propertyList = listPropertiesSortedByName();

	// Anzahl der Kostenpositionen je Periode wird serverseitig aufgelöst und
	// in die Zeilen eingebettet (Maps sind als Client-Props nicht serialisierbar).
	const costItemCountMap = getCostItemCountsByPeriod();
	const rows: BillingPeriodRow[] = billingPeriodList.map((billingPeriod) => ({
		...billingPeriod,
		costItemCount: costItemCountMap.get(billingPeriod.id) ?? 0,
	}));

	// Umlageschlüssel + Einheiten werden nur für die ausgewählte Liegenschaft
	// benötigt (ohne Auswahl wird keine Verwaltungs-Tabelle gerendert).
	const customAllocationKeys = propertyId ? listCustomAllocationKeysWithWeights(propertyId) : [];
	const unitList = propertyId ? listUnits({ propertyId }) : [];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("billing.title")} description={t("billing.description")} actions={<BillingPeriodFormDialog properties={propertyList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{propertyList.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("billing.empty.noProperties")}</p>
				) : (
					<BillingPropertyFilter properties={propertyList} value={propertyId} />
				)}
				<Tabs defaultValue="perioden">
					<TabsList>
						<TabsTrigger value="perioden">
							<Calculator /> {t("billing.tabs.periods")}
						</TabsTrigger>
						<TabsTrigger value="umlageschluessel">
							<Scale /> {t("billing.tabs.allocationKeys")}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="perioden" className="space-y-4">
						<Card>
							<CardContent className="p-0">
								{billingPeriodList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<Calculator className="size-8" />
										<p>{propertyId ? t("billing.empty.periodsFiltered") : t("billing.empty.periods")}</p>
									</div>
								) : (
									<BillingPeriodsTable rows={rows} />
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="umlageschluessel" className="space-y-4">
						<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("billing.allocationKeys.info")}</div>
						{!propertyId ? (
							<p className="text-sm text-muted-foreground">{t("billing.allocationKeys.selectProperty")}</p>
						) : (
							<Card>
								<CardContent className="p-0">
									<div className="flex items-center justify-between border-b px-4 py-3">
										<span className="text-sm text-muted-foreground">{t("billing.allocationKeys.management")}</span>
										<CustomAllocationKeyFormDialog propertyId={propertyId} />
									</div>
									{customAllocationKeys.length === 0 ? (
										<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
											<Scale className="size-8" />
											<p>{t("billing.allocationKeys.empty")}</p>
										</div>
									) : (
										<CustomAllocationKeysTable propertyId={propertyId} rows={customAllocationKeys} units={unitList} />
									)}
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
