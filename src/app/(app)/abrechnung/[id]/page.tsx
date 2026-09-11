import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, ChevronLeft } from "lucide-react";

import { getBillingPeriodDetail } from "@/data/billing";
import { listAccountBookingSumsForPeriod } from "@/data/accounts";
import { buildCustomAllocationWeightsByKey } from "@/data/custom-allocation-keys";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BankingImportDialog } from "@/components/abrechnung/banking-import-dialog";
import { BillingPeriodNotesDialog } from "@/components/abrechnung/billing-period-notes-dialog";
import { CostItemsTable } from "@/components/abrechnung/cost-items-table";
import { CostItemFormDialog } from "@/components/abrechnung/cost-item-form-dialog";
import { FinalizeBillingPeriodButton } from "@/components/abrechnung/finalize-billing-period-button";
import { GenerateAllStatementPdfsButton } from "@/components/abrechnung/generate-all-statement-pdfs-button";
import { LeasePreviewTable, type LeasePreviewRow } from "@/components/abrechnung/lease-preview-table";
import { TenantStatementsTable, type TenantStatementRow } from "@/components/abrechnung/tenant-statements-table";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";
import { billingPeriodStatusStyles, calculateBillingResult } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function BillingPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const t = await getT();
	const { id } = await params;

	const detail = getBillingPeriodDetail(id);
	const postalConfigured = isLetterXpressConfigured();

	if (!detail) {
		notFound();
	}

	const { billingPeriod, property, units, costItems, customAllocationKeys, tenantStatements } = detail;
	const isDraft = billingPeriod.status === "DRAFT";

	// Gewichte der frei definierbaren Umlageschlüssel auflösen (gleicher
	// Helfer wie in der Finalisierung), damit die Live-Vorschau
	// CUSTOM-Positionen korrekt verteilt.
	const customWeightsByKey = buildCustomAllocationWeightsByKey(
		[...new Set(costItems.map((costItem) => costItem.customAllocationKeyId).filter((keyId): keyId is string => keyId !== null))]
	);

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
					customAllocationWeights: costItem.customAllocationKeyId ? customWeightsByKey.get(costItem.customAllocationKeyId) ?? [] : [],
				})),
			})
		: null;

	// Mieter-/Einheitsangaben der Live-Vorschau serverseitig auflösen und in
	// die Zeilen einbetten (Maps sind als Client-Props nicht serialisierbar).
	const leaseById = new Map(units.flatMap((unit) => unit.leases.map((lease) => [lease.id, { ...lease, unit }])));
	const previewRows: LeasePreviewRow[] = (liveResult?.leaseResults ?? []).map((leaseResult) => {
		const lease = leaseById.get(leaseResult.leaseId);
		return {
			leaseId: leaseResult.leaseId,
			tenantId: lease?.tenantId ?? null,
			tenantFirstName: lease?.tenant.firstName ?? null,
			tenantLastName: lease?.tenant.lastName ?? null,
			unitId: leaseResult.unitId,
			unitLabel: lease?.unit.label ?? null,
			occupiedFrom: leaseResult.occupiedFrom.toISOString(),
			occupiedTo: leaseResult.occupiedTo.toISOString(),
			occupiedDays: leaseResult.occupiedDays,
			totalAllocatedCostsCents: leaseResult.totalAllocatedCostsCents,
			totalPrepaymentsCents: leaseResult.totalPrepaymentsCents,
			paidPrepaymentCount: leaseResult.paidPrepaymentCount,
			balanceCents: leaseResult.balanceCents,
		};
	});

	// Eingefrorene Einzelabrechnungen zu schlanken Zeilen auflösen (nur die
	// Felder, die die Tabelle braucht - ohne Positionen/Verträge).
	const statementRows: TenantStatementRow[] = tenantStatements.map((statement) => ({
		id: statement.id,
		tenantId: statement.lease.tenantId,
		tenantFirstName: statement.lease.tenant.firstName,
		tenantLastName: statement.lease.tenant.lastName,
		unitId: statement.lease.unitId,
		unitLabel: statement.lease.unit.label,
		occupiedFrom: statement.occupiedFrom,
		occupiedTo: statement.occupiedTo,
		occupiedDays: statement.occupiedDays,
		totalAllocatedCosts: statement.totalAllocatedCosts,
		totalPrepayments: statement.totalPrepayments,
		balance: statement.balance,
		pdfPath: statement.pdfPath,
		pdfFileSize: statement.pdfFileSize,
	}));

	// Vorschau des Buchhaltungs-Imports: Nettosumme der Buchungszeilen je
	// Konto im Abrechnungszeitraum. Konten mit Saldo 0 erzeugen keine
	// Kostenposition (Filter identisch zur Server Action) und werden nicht
	// angezeigt.
	const bankingImportSums = isDraft
		? listAccountBookingSumsForPeriod(property.id, billingPeriod.periodFrom, billingPeriod.periodTo).filter((sum) => sum.totalCents !== 0)
		: [];

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
						<BillingPeriodNotesDialog billingPeriod={billingPeriod} />
					</div>
				}
			/>

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				{billingPeriod.notes ? (
					<Card>
						<CardContent className="py-4">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("common.notes")}</h3>
							<p className="mt-1 whitespace-pre-line text-sm">{billingPeriod.notes}</p>
						</CardContent>
					</Card>
				) : null}

				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold">{t("billing.detail.costItems")}</h2>
					{isDraft ? (
						<div className="flex items-center gap-2">
							<BankingImportDialog billingPeriodId={billingPeriod.id} accountSums={bankingImportSums} />
							<CostItemFormDialog billingPeriodId={billingPeriod.id} units={units} customAllocationKeys={customAllocationKeys} />
						</div>
					) : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{costItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("billing.empty.costItems")}</p>
							</div>
						) : (
							<CostItemsTable
								billingPeriodId={billingPeriod.id}
								isDraft={isDraft}
								rows={costItems}
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
										<span className="font-semibold">{costItem?.label ?? t("billing.warning.fallbackItem")}</span> {t("billing.warning.notAllocated")}{" "}
										{t("billing.warning.noAllocationBasis")}
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
								<LeasePreviewTable rows={previewRows} />
							)
						) : tenantStatements.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("billing.empty.statements")}</p>
							</div>
						) : (
							<TenantStatementsTable rows={statementRows} postalConfigured={postalConfigured} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
