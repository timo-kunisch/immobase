import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, ChevronLeft, StickyNote } from "lucide-react";

import {
	getAnnualStatementDetail,
	listDraftBillingPeriodsForProperty,
	listHousingChargesForUnits,
	listOwners,
} from "@/data/annual-statements";
import { listAccountBookingSumsForPeriod } from "@/data/accounts";
import { listEconomicPlanTotalsForHoa } from "@/data/economic-plans";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import { HoaConsumptionValuesDialog } from "@/components/weg/hoa-consumption-values-dialog";
import { FinalizeAnnualStatementButton } from "@/components/weg/finalize-annual-statement-button";
import { BridgeToBetrKvDialog } from "@/components/weg/bridge-to-betrkv-dialog";
import { AnnualStatementNotesDialog } from "@/components/weg/annual-statement-notes-dialog";
import { HoaBankingImportDialog } from "@/components/weg/hoa-banking-import-dialog";
import { GenerateUnitResultPdfButton } from "@/components/weg/generate-unit-result-pdf-button";
import { GenerateAllUnitResultPdfsButton } from "@/components/weg/generate-all-unit-result-pdfs-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { annualStatementStatusStyles, buildAnnualStatementConsistencyCheck, calculateAnnualStatementResult } from "@/lib/hoa-annual-statement";
import { toCents } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";

import { deleteAnnualStatementCostItemAction, saveAnnualStatementCostItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AnnualStatementDetailPage({ params }: { params: Promise<{ statementId: string }> }) {
	const { statementId } = await params;
	const t = await getT();

	const detail = getAnnualStatementDetail(statementId);

	if (!detail) {
		notFound();
	}

	const { statement, hoa, customAllocationKeys, units, costItems, unitResults } = detail;
	const isDraft = statement.status === "DRAFT";

	const housingChargeRows = listHousingChargesForUnits(units.map((u) => u.id));

	const liveResult = isDraft
		? calculateAnnualStatementResult(
				{
					periodFrom: new Date(statement.periodFrom),
					periodTo: new Date(statement.periodTo),
					units: units.map((unit) => ({
						id: unit.id,
						livingSpace: unit.livingSpace,
						coOwnershipShare: unit.coOwnershipShare,
						ownerships: unit.ownerships.map((o) => ({ id: o.id, ownerId: o.ownerId, startDate: o.startDate, endDate: o.endDate })),
					})),
					costItems: costItems.map((costItem) => ({
						id: costItem.id,
						amount: costItem.amount,
						allocationKey: costItem.allocationKey,
						directUnitId: costItem.directUnitId,
						consumptionValues: costItem.consumptionValues,
						customAllocationWeights: [],
					})),
				},
				housingChargeRows.map((c) => ({ unitId: c.unitId, ownerId: c.ownerId, amount: c.amount, dueDate: c.dueDate, status: c.status }))
			)
		: null;

	// Plausibilitätsprüfung (Gesamtabrechnung vs. Einzelabrechnungen vs.
	// Wirtschaftsplan, Rückstände) - nur im Entwurf relevant, finalisierte
	// Abrechnungen sind eingefroren. Reine Berechnung in
	// src/lib/hoa-annual-statement.ts, Daten hier.
	const consistencyIssues = isDraft && liveResult
		? buildAnnualStatementConsistencyCheck({
				periodFrom: new Date(statement.periodFrom),
				periodTo: new Date(statement.periodTo),
				costItemsTotalCents: costItems.reduce((sum, costItem) => sum + toCents(costItem.amount), 0),
				result: liveResult,
				economicPlans: listEconomicPlanTotalsForHoa(statement.hoaId),
				housingCharges: housingChargeRows.map((c) => ({ unitId: c.unitId, ownerId: c.ownerId, amount: c.amount, dueDate: c.dueDate, status: c.status })),
			})
		: [];

	// Banking-Import-Vorschau: Nettosummen der Kontobuchungen des
	// Abrechnungszeitraums auf dem Bankkonto der Liegenschaft der WEG. Die
	// Action ermittelt die Summen beim Übernehmen serverseitig NEU
	// (autoritativ) - hier nur die Vorschau, wie in der Mietverwaltung.
	const accountSums = isDraft
		? listAccountBookingSumsForPeriod(hoa.propertyId, statement.periodFrom, statement.periodTo).filter((sum) => sum.totalCents !== 0)
		: [];

	const unitById = new Map(units.map((unit) => [unit.id, unit]));
	const customKeyById = new Map(customAllocationKeys.map((key) => [key.id, key]));
	// Für die Live-Vorschau (Entwurf) müssen Eigentümer-Namen separat
	// geladen werden, da units.ownerships bewusst schlank gehalten wird
	// (keine owner-Relation, siehe Annahme in eigentumsverhaeltnisse/page.tsx).
	const allOwners = isDraft ? listOwners() : [];
	const ownerNameById = new Map(allOwners.map((o) => [o.id, `${o.firstName} ${o.lastName}`]));

	// Für die BetrKV-Brücke: Entwurfs-Abrechnungsperioden je Liegenschaft
	// der vermieteten Einheit (nur relevant für bereits finalisierte
	// Ergebnisse).
	const draftBillingPeriodsByProperty = new Map<string, { id: string; periodFrom: string; periodTo: string }[]>();
	if (!isDraft) {
		const propertyIds = [...new Set(units.map((u) => u.propertyId))];
		for (const propertyId of propertyIds) {
			draftBillingPeriodsByProperty.set(propertyId, listDraftBillingPeriodsForProperty(propertyId));
		}
	}
	const postalConfigured = isLetterXpressConfigured();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("hoaStatement.detail.title", { name: hoa.name })}
				description={`${formatDate(statement.periodFrom)} – ${formatDate(statement.periodTo)}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href={`/weg/jahresabrechnung?hoaId=${statement.hoaId}`}>
								<ChevronLeft />
								{t("common.back")}
							</Link>
						</Button>
						<AnnualStatementNotesDialog statement={statement} />
						<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${annualStatementStatusStyles[statement.status]}`}>{t(`hoaStatement.status.${statement.status}`)}</span>
					</div>
				}
			/>
			<div className="flex-1 space-y-6 p-4 sm:p-6">
				{statement.notes ? (
					<Card>
						<CardContent className="flex items-start gap-3 py-4">
							<StickyNote className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
							<p className="whitespace-pre-line text-sm">{statement.notes}</p>
						</CardContent>
					</Card>
				) : null}

				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">
						{t("hoaStatement.costItems.heading", { from: formatDate(statement.periodFrom), to: formatDate(statement.periodTo) })}
					</h2>
					{isDraft ? (
						<div className="flex items-center gap-2">
							<HoaBankingImportDialog annualStatementId={statement.id} accountSums={accountSums} />
							<HoaCostItemFormDialog action={saveAnnualStatementCostItemAction} parentIdFieldName="annualStatementId" parentId={statement.id} hoaId={statement.hoaId} units={units} customAllocationKeys={customAllocationKeys} showApportionable />
						</div>
					) : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{costItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaStatement.costItems.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("hoaStatement.table.label")}</TableHead>
										<TableHead>{t("hoaStatement.table.allocationKey")}</TableHead>
										<TableHead>{t("hoaStatement.table.apportionable")}</TableHead>
										<TableHead className="text-right">{t("common.amount")}</TableHead>
										<TableHead className="w-[130px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{costItems.map((costItem) => (
										<TableRow key={costItem.id}>
											<TableCell className="font-medium">
												{costItem.label}
												{costItem.notes ? <span className="block text-xs text-muted-foreground">{costItem.notes}</span> : null}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{t(`hoaPlan.allocationKey.${costItem.allocationKey}`)}
												{costItem.allocationKey === "DIRECT" && costItem.directUnitId ? <span className="block text-xs text-muted-foreground">{unitById.get(costItem.directUnitId)?.label}</span> : null}
												{costItem.allocationKey === "CUSTOM" && costItem.customAllocationKeyId ? (
													<span className="block text-xs text-muted-foreground">{customKeyById.get(costItem.customAllocationKeyId)?.label}</span>
												) : null}
											</TableCell>
											<TableCell className="text-muted-foreground">{costItem.isApportionable ? t("common.yes") : t("common.no")}</TableCell>
											<TableCell className="text-right">{formatCurrency(costItem.amount)}</TableCell>
											<TableCell>
												{isDraft ? (
													<div className="flex items-center justify-end gap-1">
														{costItem.allocationKey === "CONSUMPTION" ? <HoaConsumptionValuesDialog hoaId={statement.hoaId} costItemId={costItem.id} costItemLabel={costItem.label} units={units} consumptionValues={costItem.consumptionValues} /> : null}
														<HoaCostItemFormDialog action={saveAnnualStatementCostItemAction} parentIdFieldName="annualStatementId" parentId={statement.id} hoaId={statement.hoaId} costItem={costItem} units={units} customAllocationKeys={customAllocationKeys} showApportionable />
														<ConfirmDeleteButton action={deleteAnnualStatementCostItemAction.bind(null, costItem.id, statement.hoaId, statement.id)} confirmMessage={t("hoaStatement.confirm.deleteCostItem", { label: costItem.label })} />
													</div>
												) : (
													<span className="text-xs text-muted-foreground">{t("hoaStatement.status.FINALIZED")}</span>
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
											<span className="font-semibold">{costItem?.label ?? t("hoaStatement.costItems.fallbackLabel")}</span> {t("hoaStatement.warnings.noBasis")}
										</p>
									</div>
								);
							})}
						</CardContent>
					</Card>
				) : null}

				{isDraft && consistencyIssues.length > 0 ? (
					<Card className="border-amber-200 dark:border-amber-900">
						<CardContent className="flex flex-col gap-2 py-4">
							{consistencyIssues.map((issue, index) => (
								<div key={`${issue.type}-${index}`} className="flex items-center gap-3">
									<AlertTriangle className="size-5 shrink-0 text-amber-600" />
									<p className="text-sm">
										{issue.type === "UNASSIGNED_COSTS"
											? t("hoaStatement.consistency.unassignedCosts", { amount: formatCurrency(Math.abs(issue.differenceCents) / 100) })
											: issue.type === "PLAN_DEVIATION"
												? t("hoaStatement.consistency.planDeviation", {
														year: periodLabel(issue.fiscalYearFrom, issue.fiscalYearTo),
														planned: formatCurrency(issue.plannedTotalCents / 100),
														actual: formatCurrency(issue.actualTotalCents / 100),
														difference: formatCurrency(Math.abs(issue.differenceCents) / 100),
													})
												: issue.type === "HOUSING_CHARGE_ARREARS"
													? t("hoaStatement.consistency.housingChargeArrears", { count: issue.openCount, amount: formatCurrency(issue.openTotalCents / 100) })
													: t("hoaStatement.consistency.noEconomicPlan")}
									</p>
								</div>
							))}
						</CardContent>
					</Card>
				) : null}

				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-base font-semibold">{t("hoaStatement.results.heading")}</h2>
					{isDraft ? (
						<FinalizeAnnualStatementButton annualStatementId={statement.id} hoaId={statement.hoaId} consistencyIssueCount={consistencyIssues.length} />
					) : (
						<GenerateAllUnitResultPdfsButton annualStatementId={statement.id} />
					)}
				</div>

				<Card>
					<CardContent className="p-0">
						{isDraft ? (
							!liveResult || liveResult.ownerResults.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
									<Calculator className="size-8" />
									<p>{t("hoaStatement.results.emptyDraft")}</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("hoaStatement.table.ownerUnit")}</TableHead>
											<TableHead>{t("hoaStatement.table.timeShare")}</TableHead>
											<TableHead className="text-right">{t("hoaStatement.table.allocatedCosts")}</TableHead>
											<TableHead className="text-right">{t("hoaStatement.table.prepayments")}</TableHead>
											<TableHead className="text-right">{t("hoaStatement.table.balance")}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{liveResult.ownerResults.map((ownerResult) => {
											const balanceEuros = ownerResult.balanceCents / 100;
											return (
												<TableRow key={ownerResult.ownershipId}>
													<TableCell className="font-medium">
														{ownerNameById.get(ownerResult.ownerId) ?? "–"}
														<span className="block text-xs text-muted-foreground">{unitById.get(ownerResult.unitId)?.label}</span>
													</TableCell>
													<TableCell className="text-muted-foreground">
														{formatDate(ownerResult.ownedFrom)} – {formatDate(ownerResult.ownedTo)} ({t("hoaStatement.results.days", { days: ownerResult.ownedDays })})
													</TableCell>
													<TableCell className="text-right">{formatCurrency(ownerResult.totalAllocatedCostsCents / 100)}</TableCell>
													<TableCell className="text-right">
														{formatCurrency(ownerResult.totalPrepaymentsCents / 100)}
														{ownerResult.paidPrepaymentCount === 0 ? (
															<span className="block text-xs text-amber-600">{t("hoaStatement.results.noPaidPrepayments")}</span>
														) : null}
													</TableCell>
													<TableCell className={`text-right font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>{balanceEuros > 0 ? t("hoaStatement.results.balanceDue", { amount: formatCurrency(balanceEuros) }) : balanceEuros < 0 ? t("hoaStatement.results.balanceCredit", { amount: formatCurrency(Math.abs(balanceEuros)) }) : formatCurrency(0)}</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)
						) : unitResults.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaStatement.results.emptyFinalized")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("hoaStatement.table.ownerUnit")}</TableHead>
										<TableHead>{t("hoaStatement.table.timeShare")}</TableHead>
										<TableHead className="text-right">{t("hoaStatement.table.allocatedCosts")}</TableHead>
										<TableHead className="text-right">{t("hoaStatement.table.prepayments")}</TableHead>
										<TableHead className="text-right">{t("hoaStatement.table.balance")}</TableHead>
										<TableHead className="text-right">{t("hoaStatement.table.pdf")}</TableHead>
										<TableHead className="w-[80px] text-right">{t("hoaStatement.table.betrkv")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{unitResults.map((result) => {
										const balanceEuros = Number(result.balance);
										const availablePeriods = draftBillingPeriodsByProperty.get(result.unit.propertyId) ?? [];
										return (
											<TableRow key={result.id}>
												<TableCell className="font-medium">
													{result.owner.firstName} {result.owner.lastName}
													<span className="block text-xs text-muted-foreground">{result.unit.label}</span>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{formatDate(result.ownedFrom)} – {formatDate(result.ownedTo)} ({t("hoaStatement.results.days", { days: result.ownedDays })})
												</TableCell>
												<TableCell className="text-right">{formatCurrency(result.totalAllocatedCosts)}</TableCell>
												<TableCell className="text-right">{formatCurrency(result.totalPrepayments)}</TableCell>
												<TableCell className={`text-right font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>{balanceEuros > 0 ? t("hoaStatement.results.balanceDue", { amount: formatCurrency(balanceEuros) }) : balanceEuros < 0 ? t("hoaStatement.results.balanceCredit", { amount: formatCurrency(Math.abs(balanceEuros)) }) : formatCurrency(0)}</TableCell>
												<TableCell>
													<div className="flex justify-end">
														<GenerateUnitResultPdfButton unitResultId={result.id} pdfPath={result.pdfPath} pdfFileSize={result.pdfFileSize} postalConfigured={postalConfigured} />
													</div>
												</TableCell>
												<TableCell>
													<div className="flex justify-end">
														<BridgeToBetrKvDialog unitResultId={result.id} hoaId={statement.hoaId} availableBillingPeriods={availablePeriods} />
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

/** Kurzbezeichnung eines Geschäftsjahrs („2026“ bzw. „2026–2027"). */
function periodLabel(from: string, to: string): string {
	const fromYear = new Date(from).getFullYear();
	const toYear = new Date(to).getFullYear();
	return fromYear === toYear ? `${fromYear}` : `${fromYear}–${toYear}`;
}