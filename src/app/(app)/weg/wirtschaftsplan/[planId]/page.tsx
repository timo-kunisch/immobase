import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, ChevronLeft } from "lucide-react";

import { getEconomicPlanDetail } from "@/data/economic-plans";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import { EconomicPlanCostItemsTable } from "@/components/weg/economic-plan-cost-items-table";
import { EconomicPlanUnitSharesTable } from "@/components/weg/economic-plan-unit-shares-table";
import { FinalizeEconomicPlanButton } from "@/components/weg/finalize-economic-plan-button";
import { GenerateHousingChargesDialog } from "@/components/weg/generate-housing-charges-dialog";
import { formatDate } from "@/lib/format";
import { economicPlanStatusStyles, calculateEconomicPlanResult } from "@/lib/hoa-economic-plan";
import { getT } from "@/lib/i18n/server";

import { saveEconomicPlanCostItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EconomicPlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
	const { planId } = await params;
	const t = await getT();

	const detail = getEconomicPlanDetail(planId);

	if (!detail) {
		notFound();
	}

	const { plan, hoa, units, customAllocationKeys, costItems, unitShares } = detail;
	const isDraft = plan.status === "DRAFT";

	const liveResult = isDraft
		? calculateEconomicPlanResult({
				fiscalYearFrom: new Date(plan.fiscalYearFrom),
				fiscalYearTo: new Date(plan.fiscalYearTo),
				units: units.map((unit) => ({ id: unit.id, livingSpace: unit.livingSpace, coOwnershipShare: unit.coOwnershipShare })),
				costItems: costItems.map((costItem) => ({
					id: costItem.id,
					amount: costItem.amount,
					allocationKey: costItem.allocationKey,
					directUnitId: costItem.directUnitId,
					customAllocationWeights: [],
				})),
			})
		: null;

	const unitById = new Map(units.map((unit) => [unit.id, unit]));
	const customKeyById = new Map(customAllocationKeys.map((key) => [key.id, key]));

	// Bezeichnungen der Direkt-Zuordnung/des frei definierten Schlüssels für
	// die Zell-Unterzeilen in die Zeilen einbetten (Maps sind als Client-Props
	// nicht serialisierbar).
	const costItemRows = costItems.map((costItem) => ({
		...costItem,
		directUnitLabel:
			costItem.allocationKey === "DIRECT" && costItem.directUnitId ? unitById.get(costItem.directUnitId)?.label : undefined,
		customAllocationKeyLabel:
			costItem.allocationKey === "CUSTOM" && costItem.customAllocationKeyId
				? customKeyById.get(costItem.customAllocationKeyId)?.label
				: undefined,
	}));

	// Zeilen der Einzelwirtschaftsplan-Tabelle: Entwurf = Live-Vorschau der
	// berechneten Ergebnisse (Key = Einheits-ID), finalisiert = eingefrorene
	// Ergebnisse (Key = Zeilen-ID).
	const draftShareRows = liveResult
		? liveResult.unitShares.map((share) => ({
				key: share.unitId,
				unitLabel: unitById.get(share.unitId)?.label ?? "",
				annualAmount: share.annualAmount,
				monthlyAmount: share.monthlyAmount,
			}))
		: [];
	const finalizedShareRows = unitShares.map((share) => ({
		key: share.id,
		unitLabel: share.unit.label,
		annualAmount: share.annualAmount,
		monthlyAmount: share.monthlyAmount,
	}));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("hoaPlan.detail.title", { name: hoa.name })}
				description={`${formatDate(plan.fiscalYearFrom)} – ${formatDate(plan.fiscalYearTo)}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href={`/weg/wirtschaftsplan?hoaId=${plan.hoaId}`}>
								<ChevronLeft />
								{t("common.back")}
							</Link>
						</Button>
						<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${economicPlanStatusStyles[plan.status]}`}>{t(`hoaPlan.status.${plan.status}`)}</span>
					</div>
				}
			/>
			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">
						{t("hoaPlan.costItems.heading", { from: formatDate(plan.fiscalYearFrom), to: formatDate(plan.fiscalYearTo) })}
					</h2>
					{isDraft ? <HoaCostItemFormDialog action={saveEconomicPlanCostItemAction} parentIdFieldName="economicPlanId" parentId={plan.id} hoaId={plan.hoaId} units={units} customAllocationKeys={customAllocationKeys} /> : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{costItemRows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaPlan.costItems.empty")}</p>
							</div>
						) : (
							<EconomicPlanCostItemsTable
								rows={costItemRows}
								isDraft={isDraft}
								planId={plan.id}
								hoaId={plan.hoaId}
								units={units}
								customAllocationKeys={customAllocationKeys}
							/>
						)}
					</CardContent>
				</Card>

				{isDraft && liveResult && liveResult.warnings.length > 0 ? (
					<Card className="border-amber-200 dark:border-amber-900">
						<CardContent className="flex flex-col gap-2 py-4">
							{liveResult.warnings.map((warning, index) => {
								const costItem = costItems.find((c) => c.id === warning.costItemId);
								return (
									<div key={`${warning.costItemId}-${index}`} className="flex items-center gap-3">
										<AlertTriangle className="size-5 shrink-0 text-amber-600" />
										<p className="text-sm">
											<span className="font-semibold">{costItem?.label ?? t("hoaPlan.costItems.fallbackLabel")}</span> {t("hoaPlan.warnings.noBasis")}
										</p>
									</div>
								);
							})}
						</CardContent>
					</Card>
				) : null}

				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">{t("hoaPlan.unitShares.heading")}</h2>
					{isDraft ? <FinalizeEconomicPlanButton economicPlanId={plan.id} hoaId={plan.hoaId} /> : <GenerateHousingChargesDialog economicPlanId={plan.id} hoaId={plan.hoaId} />}
				</div>

				<Card>
					<CardContent className="p-0">
						{isDraft ? (
							!liveResult || liveResult.unitShares.every((s) => s.annualAmountCents === 0) ? (
								<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
									<Calculator className="size-8" />
									<p>{t("hoaPlan.unitShares.emptyDraft")}</p>
								</div>
							) : (
								<EconomicPlanUnitSharesTable rows={draftShareRows} />
							)
						) : unitShares.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaPlan.unitShares.emptyFinalized")}</p>
							</div>
						) : (
							<EconomicPlanUnitSharesTable rows={finalizedShareRows} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
