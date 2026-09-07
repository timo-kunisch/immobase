import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, ChevronLeft } from "lucide-react";

import {
	getAnnualStatementDetail,
	listDraftBillingPeriodsForProperty,
	listHousingChargesForUnits,
	listOwners,
} from "@/data/annual-statements";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { HoaCostItemFormDialog } from "@/components/weg/hoa-cost-item-form-dialog";
import { HoaConsumptionValuesDialog } from "@/components/weg/hoa-consumption-values-dialog";
import { FinalizeAnnualStatementButton } from "@/components/weg/finalize-annual-statement-button";
import { BridgeToBetrKvDialog } from "@/components/weg/bridge-to-betrkv-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { annualStatementStatusLabels, annualStatementStatusStyles, calculateAnnualStatementResult } from "@/lib/hoa-annual-statement";
import { hoaAllocationKeyLabels } from "@/lib/hoa-allocation";
import { hoaCostCategoryLabels } from "@/lib/hoa-economic-plan";

import { deleteAnnualStatementCostItemAction, saveAnnualStatementCostItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AnnualStatementDetailPage({ params }: { params: Promise<{ statementId: string }> }) {
	const { statementId } = await params;

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
				housingChargeRows.map((c) => ({ unitId: c.unitId, ownerId: c.ownerId, amount: c.amount, dueDate: c.dueDate, status: c.status })),
			)
		: null;

	const unitById = new Map(units.map((unit) => [unit.id, unit]));
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

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={`Jahresabrechnung: ${hoa.name}`}
				description={`${formatDate(statement.periodFrom)} – ${formatDate(statement.periodTo)}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href={`/weg/jahresabrechnung?hoaId=${statement.hoaId}`}>
								<ChevronLeft />
								Zurück
							</Link>
						</Button>
						<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${annualStatementStatusStyles[statement.status]}`}>{annualStatementStatusLabels[statement.status]}</span>
					</div>
				}
			/>
			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">
						Kostenpositionen ({formatDate(statement.periodFrom)} – {formatDate(statement.periodTo)})
					</h2>
					{isDraft ? <HoaCostItemFormDialog action={saveAnnualStatementCostItemAction} parentIdFieldName="annualStatementId" parentId={statement.id} hoaId={statement.hoaId} units={units} customAllocationKeys={customAllocationKeys} showApportionable /> : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{costItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>Noch keine Kostenpositionen erfasst.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Bezeichnung</TableHead>
										<TableHead>Kostenart</TableHead>
										<TableHead>Umlageschlüssel</TableHead>
										<TableHead>Umlagefähig</TableHead>
										<TableHead className="text-right">Betrag</TableHead>
										<TableHead className="w-[130px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{costItems.map((costItem) => (
										<TableRow key={costItem.id}>
											<TableCell className="font-medium">
												{costItem.label}
												{costItem.allocationKey === "DIRECT" && costItem.directUnitId ? <span className="block text-xs text-muted-foreground">{unitById.get(costItem.directUnitId)?.label}</span> : null}
											</TableCell>
											<TableCell className="text-muted-foreground">{hoaCostCategoryLabels[costItem.category]}</TableCell>
											<TableCell className="text-muted-foreground">{hoaAllocationKeyLabels[costItem.allocationKey]}</TableCell>
											<TableCell className="text-muted-foreground">{costItem.isApportionable ? "Ja" : "Nein"}</TableCell>
											<TableCell className="text-right">{formatCurrency(costItem.amount)}</TableCell>
											<TableCell>
												{isDraft ? (
													<div className="flex items-center justify-end gap-1">
														{costItem.allocationKey === "CONSUMPTION" ? <HoaConsumptionValuesDialog hoaId={statement.hoaId} costItemId={costItem.id} costItemLabel={costItem.label} units={units} consumptionValues={costItem.consumptionValues} /> : null}
														<HoaCostItemFormDialog action={saveAnnualStatementCostItemAction} parentIdFieldName="annualStatementId" parentId={statement.id} hoaId={statement.hoaId} costItem={costItem} units={units} customAllocationKeys={customAllocationKeys} showApportionable />
														<ConfirmDeleteButton action={deleteAnnualStatementCostItemAction.bind(null, costItem.id, statement.hoaId, statement.id)} confirmMessage={`Kostenposition "${costItem.label}" wirklich löschen?`} />
													</div>
												) : (
													<span className="text-xs text-muted-foreground">Finalisiert</span>
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
											<span className="font-semibold">{costItem?.label ?? "Kostenposition"}</span> konnte nicht umgelegt werden: Es liegt keine gültige Verteilungsgrundlage vor.
										</p>
									</div>
								);
							})}
						</CardContent>
					</Card>
				) : null}

				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">Einzelabrechnung je Eigentümer-Zeitanteil</h2>
					{isDraft ? <FinalizeAnnualStatementButton annualStatementId={statement.id} hoaId={statement.hoaId} /> : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{isDraft ? (
							!liveResult || liveResult.ownerResults.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
									<Calculator className="size-8" />
									<p>Für den gewählten Zeitraum wurden keine Eigentumsverhältnisse gefunden.</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Eigentümer / Einheit</TableHead>
											<TableHead>Zeitanteil</TableHead>
											<TableHead className="text-right">Umgelegte Kosten</TableHead>
											<TableHead className="text-right">Vorauszahlungen</TableHead>
											<TableHead className="text-right">Saldo</TableHead>
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
														{formatDate(ownerResult.ownedFrom)} – {formatDate(ownerResult.ownedTo)} ({ownerResult.ownedDays} Tage)
													</TableCell>
													<TableCell className="text-right">{formatCurrency(ownerResult.totalAllocatedCostsCents / 100)}</TableCell>
													<TableCell className="text-right">{formatCurrency(ownerResult.totalPrepaymentsCents / 100)}</TableCell>
													<TableCell className={`text-right font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>{balanceEuros > 0 ? `Nachzahlung ${formatCurrency(balanceEuros)}` : balanceEuros < 0 ? `Guthaben ${formatCurrency(Math.abs(balanceEuros))}` : formatCurrency(0)}</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)
						) : unitResults.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>Keine Abrechnungsergebnisse vorhanden.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Eigentümer / Einheit</TableHead>
										<TableHead>Zeitanteil</TableHead>
										<TableHead className="text-right">Umgelegte Kosten</TableHead>
										<TableHead className="text-right">Vorauszahlungen</TableHead>
										<TableHead className="text-right">Saldo</TableHead>
										<TableHead className="w-[80px] text-right">BetrKV</TableHead>
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
													{formatDate(result.ownedFrom)} – {formatDate(result.ownedTo)} ({result.ownedDays} Tage)
												</TableCell>
												<TableCell className="text-right">{formatCurrency(result.totalAllocatedCosts)}</TableCell>
												<TableCell className="text-right">{formatCurrency(result.totalPrepayments)}</TableCell>
												<TableCell className={`text-right font-medium ${balanceEuros > 0 ? "text-red-600" : balanceEuros < 0 ? "text-emerald-600" : ""}`}>{balanceEuros > 0 ? `Nachzahlung ${formatCurrency(balanceEuros)}` : balanceEuros < 0 ? `Guthaben ${formatCurrency(Math.abs(balanceEuros))}` : formatCurrency(0)}</TableCell>
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
