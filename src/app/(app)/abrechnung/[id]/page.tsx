import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, ChevronLeft } from "lucide-react";

import { getBillingPeriodDetail } from "@/data/billing";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CostItemFormDialog } from "@/components/abrechnung/cost-item-form-dialog";
import { ConsumptionValuesDialog } from "@/components/abrechnung/consumption-values-dialog";
import { FinalizeBillingPeriodButton } from "@/components/abrechnung/finalize-billing-period-button";
import { GenerateStatementPdfButton } from "@/components/abrechnung/generate-statement-pdf-button";
import { GenerateAllStatementPdfsButton } from "@/components/abrechnung/generate-all-statement-pdfs-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";
import { billingPeriodStatusStyles, calculateBillingResult } from "@/lib/billing";

import { deleteCostItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BillingPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const t = await getT();
	const { id } = await params;

	const detail = getBillingPeriodDetail(id);
	const postalConfigured = isLetterXpressConfigured();

	if (!detail) {
		notFound();
	}

	const { billingPeriod, property, units, costItems, tenantStatements } = detail;
	const isDraft = billingPeriod.status === "DRAFT";

	// Im Entwurf wird das Ergebnis bei jedem Aufruf live neu berechnet, damit
	// Änderungen an Kostenpositionen/Verbrauchswerten sofort sichtbar sind.
	const liveResult = isDraft
		? calculateBillingResult({
				periodFrom: new Date(billingPeriod.periodFrom),
				periodTo: new Date(billingPeriod.periodTo),
				units: units.map((unit) => ({
					id: unit.id,
					livingSpace: unit.livingSpace,
					leases: unit.leases,
				})),
				costItems: costItems.map((costItem) => ({
					id: costItem.id,
					amount: costItem.amount,
					allocationKey: costItem.allocationKey,
					directUnitId: costItem.directUnitId,
					consumptionValues: costItem.consumptionValues,
				})),
			})
		: null;

	const leaseById = new Map(units.flatMap((unit) => unit.leases.map((lease) => [lease.id, { ...lease, unit }])));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("billing.detail.title", { name: property.name })}
				description={`${formatDate(billingPeriod.periodFrom)} – ${formatDate(billingPeriod.periodTo)}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href="/abrechnung">
								<ChevronLeft />
								{t("common.back")}
							</Link>
						</Button>
						<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${billingPeriodStatusStyles[billingPeriod.status]}`}>
							{t(`billing.status.${billingPeriod.status}`)}
						</span>
					</div>
				}
			/>

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">{t("billing.detail.costItems")}</h2>
					{isDraft ? <CostItemFormDialog billingPeriodId={billingPeriod.id} units={units} /> : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{costItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("billing.empty.costItems")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("billing.table.label")}</TableHead>
										<TableHead>{t("billing.table.category")}</TableHead>
										<TableHead>{t("billing.table.allocationKey")}</TableHead>
										<TableHead className="text-right">{t("common.amount")}</TableHead>
										<TableHead className="w-[140px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{costItems.map((costItem) => (
										<TableRow key={costItem.id}>
											<TableCell className="font-medium">
												{costItem.label}
												{costItem.allocationKey === "DIRECT" && costItem.directUnit ? <span className="block text-xs text-muted-foreground">{costItem.directUnit.label}</span> : null}
											</TableCell>
										<TableCell className="text-muted-foreground">{t(`billing.category.${costItem.category}`)}</TableCell>
										<TableCell className="text-muted-foreground">{t(`billing.allocationKey.${costItem.allocationKey}`)}</TableCell>
										<TableCell className="text-right">{formatCurrency(costItem.amount)}</TableCell>
										<TableCell>
											{isDraft ? (
												<div className="flex items-center justify-end gap-1">
													{costItem.allocationKey === "CONSUMPTION" ? (
														<ConsumptionValuesDialog costItemId={costItem.id} costItemLabel={costItem.label} units={units} consumptionValues={costItem.consumptionValues} />
													) : null}
													<CostItemFormDialog billingPeriodId={billingPeriod.id} costItem={costItem} units={units} />
													<ConfirmDeleteButton
														action={deleteCostItemAction.bind(null, costItem.id)}
														confirmMessage={t("billing.confirm.deleteCostItem", { label: costItem.label })}
													/>
												</div>
											) : (
												<span className="text-xs text-muted-foreground">{t("billing.detail.finalized")}</span>
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
											<span className="font-semibold">{costItem?.label ?? t("billing.warning.fallbackItem")}</span> {t("billing.warning.notAllocated")}{" "}
											{warning.reason === "NO_OCCUPANTS" ? t("billing.warning.noOccupants") : t("billing.warning.noAllocationBasis")}
										</p>
									</div>
								);
							})}
						</CardContent>
					</Card>
				) : null}

				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">{t("billing.detail.statements")}</h2>
					{isDraft ? (
						<FinalizeBillingPeriodButton billingPeriodId={billingPeriod.id} />
					) : tenantStatements.length > 0 ? (
						<GenerateAllStatementPdfsButton billingPeriodId={billingPeriod.id} />
					) : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{isDraft ? (
							!liveResult || liveResult.leaseResults.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
									<Calculator className="size-8" />
									<p>{t("billing.empty.leases")}</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("billing.table.tenantUnit")}</TableHead>
											<TableHead>{t("billing.table.timeShare")}</TableHead>
											<TableHead className="text-right">{t("billing.table.allocatedCosts")}</TableHead>
											<TableHead className="text-right">{t("billing.table.prepayments")}</TableHead>
											<TableHead className="text-right">{t("billing.table.balance")}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{liveResult.leaseResults.map((leaseResult) => {
											const lease = leaseById.get(leaseResult.leaseId);
											const balanceEuros = leaseResult.balanceCents / 100;
											return (
												<TableRow key={leaseResult.leaseId}>
													<TableCell className="font-medium">
														<Link href={`/mieter#tenant-${lease?.tenantId}`} className="hover:underline">
															{lease?.tenant.firstName} {lease?.tenant.lastName}
														</Link>
														<Link href={`/einheiten#unit-${leaseResult.unitId}`} className="block text-xs text-muted-foreground hover:underline">
															{lease?.unit.label}
														</Link>
													</TableCell>
												<TableCell className="text-muted-foreground">
													{formatDate(leaseResult.occupiedFrom)} – {formatDate(leaseResult.occupiedTo)} ({leaseResult.occupiedDays} {t("billing.detail.days")})
												</TableCell>
												<TableCell className="text-right">{formatCurrency(leaseResult.totalAllocatedCostsCents / 100)}</TableCell>
												<TableCell className="text-right">{formatCurrency(leaseResult.totalPrepaymentsCents / 100)}</TableCell>
												<TableCell className={`text-right font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>
													{balanceEuros > 0
														? t("billing.detail.balancePayment", { amount: formatCurrency(balanceEuros) })
														: balanceEuros < 0
															? t("billing.detail.balanceCredit", { amount: formatCurrency(Math.abs(balanceEuros)) })
															: formatCurrency(0)}
												</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)
					) : tenantStatements.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
							<Calculator className="size-8" />
							<p>{t("billing.empty.statements")}</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("billing.table.tenantUnit")}</TableHead>
									<TableHead>{t("billing.table.timeShare")}</TableHead>
									<TableHead className="text-right">{t("billing.table.allocatedCosts")}</TableHead>
									<TableHead className="text-right">{t("billing.table.prepayments")}</TableHead>
									<TableHead className="text-right">{t("billing.table.balance")}</TableHead>
									<TableHead className="w-[220px] text-right">{t("billing.table.pdf")}</TableHead>
								</TableRow>
							</TableHeader>
								<TableBody>
									{tenantStatements.map((statement) => {
										const balanceEuros = Number(statement.balance);
										return (
											<TableRow key={statement.id}>
												<TableCell className="font-medium">
													<Link href={`/mieter#tenant-${statement.lease.tenantId}`} className="hover:underline">
														{statement.lease.tenant.firstName} {statement.lease.tenant.lastName}
													</Link>
													<Link href={`/einheiten#unit-${statement.lease.unitId}`} className="block text-xs text-muted-foreground hover:underline">
														{statement.lease.unit.label}
													</Link>
												</TableCell>
											<TableCell className="text-muted-foreground">
												{formatDate(statement.occupiedFrom)} – {formatDate(statement.occupiedTo)} ({statement.occupiedDays} {t("billing.detail.days")})
											</TableCell>
											<TableCell className="text-right">{formatCurrency(statement.totalAllocatedCosts)}</TableCell>
											<TableCell className="text-right">{formatCurrency(statement.totalPrepayments)}</TableCell>
											<TableCell className={`text-right font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>
												{balanceEuros > 0
													? t("billing.detail.balancePayment", { amount: formatCurrency(balanceEuros) })
													: balanceEuros < 0
														? t("billing.detail.balanceCredit", { amount: formatCurrency(Math.abs(balanceEuros)) })
														: formatCurrency(0)}
											</TableCell>
												<TableCell>
													<div className="flex justify-end">
														<GenerateStatementPdfButton tenantStatementId={statement.id} pdfPath={statement.pdfPath} pdfFileSize={statement.pdfFileSize} postalConfigured={postalConfigured} />
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
