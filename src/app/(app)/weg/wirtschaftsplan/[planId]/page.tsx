import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, ChevronLeft } from "lucide-react";

import { getEconomicPlanDetail } from "@/data/economic-plans";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import { FinalizeEconomicPlanButton } from "@/components/weg/finalize-economic-plan-button";
import { GenerateHousingChargesDialog } from "@/components/weg/generate-housing-charges-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { economicPlanStatusStyles, calculateEconomicPlanResult } from "@/lib/hoa-economic-plan";
import { getT } from "@/lib/i18n/server";

import { deleteEconomicPlanCostItemAction, saveEconomicPlanCostItemAction } from "../actions";

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
						{costItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaPlan.costItems.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("hoaPlan.table.label")}</TableHead>
										<TableHead>{t("hoaPlan.table.allocationKey")}</TableHead>
										<TableHead className="text-right">{t("common.amount")}</TableHead>
										<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{costItems.map((costItem) => (
										<TableRow key={costItem.id}>
											<TableCell className="font-medium">
												{costItem.label}
												{costItem.allocationKey === "DIRECT" && costItem.directUnitId ? <span className="block text-xs text-muted-foreground">{unitById.get(costItem.directUnitId)?.label}</span> : null}
												{costItem.allocationKey === "CUSTOM" && costItem.customAllocationKeyId ? <span className="block text-xs text-muted-foreground">{customKeyById.get(costItem.customAllocationKeyId)?.label}</span> : null}
											</TableCell>
											<TableCell className="text-muted-foreground">{t(`hoaPlan.allocationKey.${costItem.allocationKey}`)}</TableCell>
											<TableCell className="text-right">{formatCurrency(costItem.amount)}</TableCell>
											<TableCell>
												{isDraft ? (
													<div className="flex items-center justify-end gap-1">
														<HoaCostItemFormDialog action={saveEconomicPlanCostItemAction} parentIdFieldName="economicPlanId" parentId={plan.id} hoaId={plan.hoaId} costItem={costItem} units={units} customAllocationKeys={customAllocationKeys} />
														<ConfirmDeleteButton action={deleteEconomicPlanCostItemAction.bind(null, costItem.id, plan.hoaId, plan.id)} confirmMessage={t("hoaPlan.confirm.deleteCostItem", { label: costItem.label })} />
													</div>
												) : (
													<span className="text-xs text-muted-foreground">{t("hoaPlan.status.FINALIZED")}</span>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
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
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("common.unit")}</TableHead>
											<TableHead className="text-right">{t("hoaPlan.table.annualAmount")}</TableHead>
											<TableHead className="text-right">{t("hoaPlan.table.monthlyAmount")}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{liveResult.unitShares.map((share) => (
											<TableRow key={share.unitId}>
												<TableCell className="font-medium">{unitById.get(share.unitId)?.label}</TableCell>
												<TableCell className="text-right">{formatCurrency(share.annualAmount)}</TableCell>
												<TableCell className="text-right">{formatCurrency(share.monthlyAmount)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)
						) : unitShares.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaPlan.unitShares.emptyFinalized")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("common.unit")}</TableHead>
										<TableHead className="text-right">{t("hoaPlan.table.annualAmount")}</TableHead>
										<TableHead className="text-right">{t("hoaPlan.table.monthlyAmount")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{unitShares.map((share) => (
										<TableRow key={share.id}>
											<TableCell className="font-medium">{share.unit.label}</TableCell>
											<TableCell className="text-right">{formatCurrency(share.annualAmount)}</TableCell>
											<TableCell className="text-right">{formatCurrency(share.monthlyAmount)}</TableCell>
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
