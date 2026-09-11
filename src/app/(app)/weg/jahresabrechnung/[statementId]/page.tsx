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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import { AnnualStatementCostItemsTable, type AnnualStatementCostItemRow } from "@/components/weg/annual-statement-cost-items-table";
import { AnnualStatementDraftResultsTable, type AnnualStatementDraftResultRow } from "@/components/weg/annual-statement-draft-results-table";
import { AnnualStatementUnitResultsTable, type AnnualStatementUnitResultRow } from "@/components/weg/annual-statement-unit-results-table";
import { FinalizeAnnualStatementButton } from "@/components/weg/finalize-annual-statement-button";
import { AnnualStatementNotesDialog } from "@/components/weg/annual-statement-notes-dialog";
import { HoaBankingImportDialog } from "@/components/weg/hoa-banking-import-dialog";
import { GenerateAllUnitResultPdfsButton } from "@/components/weg/generate-all-unit-result-pdfs-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { annualStatementStatusStyles, buildAnnualStatementConsistencyCheck, calculateAnnualStatementResult } from "@/lib/hoa-annual-statement";
import { toCents } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";

import { saveAnnualStatementCostItemAction } from "../actions";

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

	// Zeilen der Kostenpositionen-Tabelle: Bezeichnungen der Direkt-Zuordnung/
	// des frei definierten Schlüssels für die Zell-Unterzeilen einbetten (Maps
	// sind als Client-Props nicht serialisierbar).
	const costItemRows: AnnualStatementCostItemRow[] = costItems.map((costItem) => ({
		...costItem,
		directUnitLabel:
			costItem.allocationKey === "DIRECT" && costItem.directUnitId ? unitById.get(costItem.directUnitId)?.label : undefined,
		customAllocationKeyLabel:
			costItem.allocationKey === "CUSTOM" && costItem.customAllocationKeyId
				? customKeyById.get(costItem.customAllocationKeyId)?.label
				: undefined,
	}));

	// Zeilen der Live-Vorschau (Entwurf): Eigentümer-/Einheitsnamen auflösen,
	// Datums-Objekte der Berechnung als ISO-Strings übergeben.
	const draftResultRows: AnnualStatementDraftResultRow[] = liveResult
		? liveResult.ownerResults.map((ownerResult) => ({
				ownershipId: ownerResult.ownershipId,
				ownerName: ownerNameById.get(ownerResult.ownerId) ?? null,
				unitLabel: unitById.get(ownerResult.unitId)?.label ?? null,
				ownedFrom: ownerResult.ownedFrom.toISOString(),
				ownedTo: ownerResult.ownedTo.toISOString(),
				ownedDays: ownerResult.ownedDays,
				totalAllocatedCostsCents: ownerResult.totalAllocatedCostsCents,
				totalPrepaymentsCents: ownerResult.totalPrepaymentsCents,
				paidPrepaymentCount: ownerResult.paidPrepaymentCount,
				balanceCents: ownerResult.balanceCents,
			}))
		: [];

	// Zeilen der eingefrorenen Einzelabrechnungen (finalisiert): Namen und
	// die für die BetrKV-Brücke auswählbaren Perioden der Liegenschaft je
	// Zeile einbetten (Maps sind als Client-Props nicht serialisierbar).
	const unitResultRows: AnnualStatementUnitResultRow[] = unitResults.map((result) => ({
		id: result.id,
		ownerFirstName: result.owner.firstName,
		ownerLastName: result.owner.lastName,
		unitLabel: result.unit.label,
		ownedFrom: result.ownedFrom,
		ownedTo: result.ownedTo,
		ownedDays: result.ownedDays,
		totalAllocatedCosts: result.totalAllocatedCosts,
		totalPrepayments: result.totalPrepayments,
		balance: result.balance,
		pdfPath: result.pdfPath,
		pdfFileSize: result.pdfFileSize,
		availableBillingPeriods: draftBillingPeriodsByProperty.get(result.unit.propertyId) ?? [],
	}));

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
						{costItemRows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaStatement.costItems.empty")}</p>
							</div>
						) : (
							<AnnualStatementCostItemsTable
								rows={costItemRows}
								isDraft={isDraft}
								statementId={statement.id}
								hoaId={statement.hoaId}
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
							draftResultRows.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
									<Calculator className="size-8" />
									<p>{t("hoaStatement.results.emptyDraft")}</p>
								</div>
							) : (
								<AnnualStatementDraftResultsTable rows={draftResultRows} />
							)
						) : unitResultRows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaStatement.results.emptyFinalized")}</p>
							</div>
						) : (
							<AnnualStatementUnitResultsTable rows={unitResultRows} hoaId={statement.hoaId} postalConfigured={postalConfigured} />
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