import type { AnnualStatementStatus, HoaAllocationKey } from "@/data/types";
import { toCents } from "@/lib/money";
import { calculateHoaAllocationResult, type HoaAllocationPeriodInput, type HoaAllocationResult } from "@/lib/hoa-allocation";

/**
 * Berechnungslogik für die Jahresabrechnung/Hausgeldabrechnung (§ 28
 * Abs. 2, Abs. 4 WEG): kombiniert die Kostenumlage aus
 * src/lib/hoa-allocation.ts mit den geleisteten Hausgeld-Vorauszahlungen
 * (housingCharges) je Eigentümer-Zeitanteil, um die Abrechnungsspitze
 * (Saldo = umgelegte Kosten - Vorauszahlungen) zu ermitteln - analog zur
 * Rolle von src/lib/billing.ts für die Nebenkostenabrechnung der
 * Mietverwaltung.
 */

export type HousingChargeForStatementInput = {
	unitId: string;
	ownerId: string;
	amount: string;
	dueDate: string;
	/** Nur bezahlte (bzw. als bezahlt erfasste) Vorauszahlungen fließen in die Abrechnung ein - siehe calculatePaidPrepaymentsCents. */
	status: "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";
};

/**
 * Summiert die HAUSGELD-Vorauszahlungen eines Eigentümers für eine Einheit
 * im Zeitanteil [ownedFrom, ownedTo]. Wie bei der Nebenkostenabrechnung der
 * Mietverwaltung (computePaidPrepaymentsCents in src/lib/billing.ts, dort
 * bezogen auf bezahlte Monats-Sollstellungen) fließen nur TATSÄCHLICH
 * GELEISTETE Vorauszahlungen ein - hier die als "PAID" erfassten
 * housingCharges-Datensätze (ob manuell markiert oder automatisch durch
 * vollständige Zuordnung einer Bankbuchung, siehe
 * src/data/bank-transactions.ts), die anhand ihres Fälligkeitsdatums dem
 * Zeitanteil als GANZES zugeordnet werden (keine Tag-Umrechnung): Das
 * bildet die WEG-Praxis ab, in der das Hausgeld nicht wie eine Miete
 * "taggenau" anfällt, sondern als monatliche Sollstellung mit festem
 * Fälligkeitstag (siehe economicPlanUnitShares/generateHousingChargesAction).
 * Offene/überfällige/stornierte Sollstellungen sind KEINE Vorauszahlung -
 * der laut Wirtschaftsplan geschuldete Betrag wird bewusst NICHT blind
 * angesetzt; offene Beträge bleiben als Rückstand sichtbar (siehe
 * buildAnnualStatementConsistencyCheck) und verfälschen das
 * Abrechnungsergebnis nicht.
 */
export function calculatePaidPrepaymentsCents(charges: HousingChargeForStatementInput[], unitId: string, ownerId: string, ownedFrom: Date, ownedTo: Date): { totalCents: number; paidCount: number } {
	let totalCents = 0;
	let paidCount = 0;
	for (const charge of charges) {
		if (charge.unitId !== unitId || charge.ownerId !== ownerId || charge.status !== "PAID") continue;
		const dueDate = new Date(charge.dueDate);
		if (dueDate < ownedFrom || dueDate > ownedTo) continue;
		totalCents += toCents(charge.amount);
		paidCount += 1;
	}
	return { totalCents, paidCount };
}

export type AnnualStatementOwnerResult = {
	ownershipId: string;
	unitId: string;
	ownerId: string;
	ownedFrom: Date;
	ownedTo: Date;
	ownedDays: number;
	lines: { costItemId: string; amountCents: number }[];
	totalAllocatedCostsCents: number;
	totalPrepaymentsCents: number;
	/** Anzahl geleisteter (bezahlter) Vorauszahlungen im Zeitanteil (0 = Warnhinweis in der UI). */
	paidPrepaymentCount: number;
	/** umgelegte Kosten - Vorauszahlungen: positiv = Nachzahlung, negativ = Guthaben ("Abrechnungsspitze"). */
	balanceCents: number;
};

export type AnnualStatementResult = {
	ownerResults: AnnualStatementOwnerResult[];
	warnings: HoaAllocationResult["warnings"];
};

/**
 * Berechnet die vollständige Jahresabrechnung (Kostenumlage +
 * Abrechnungsspitze je Eigentümer-Zeitanteil) für eine WEG. Reine,
 * seiteneffektfreie Funktion (kein DB-Zugriff) - wird sowohl für die
 * Live-Vorschau im Entwurf als auch beim einmaligen Finalisieren
 * verwendet, analog zu src/lib/billing.ts::calculateBillingResult.
 */
export function calculateAnnualStatementResult(period: HoaAllocationPeriodInput, housingCharges: HousingChargeForStatementInput[]): AnnualStatementResult {
	const allocation = calculateHoaAllocationResult(period);

	const ownerResults: AnnualStatementOwnerResult[] = allocation.ownerResults.map((ownerResult) => {
		const { totalCents: totalPrepaymentsCents, paidCount: paidPrepaymentCount } = calculatePaidPrepaymentsCents(
			housingCharges,
			ownerResult.unitId,
			ownerResult.ownerId,
			ownerResult.ownedFrom,
			ownerResult.ownedTo
		);
		return {
			...ownerResult,
			totalPrepaymentsCents,
			paidPrepaymentCount,
			balanceCents: ownerResult.totalAllocatedCostsCents - totalPrepaymentsCents,
		};
	});

	return { ownerResults, warnings: allocation.warnings };
}

// ============================================================
// Plausibilitätsprüfung vor der Finalisierung
// ============================================================

/** Wirtschaftsplan-Summen für den Plan-Abgleich (aus src/data/economic-plans.ts geladen). */
export type EconomicPlanTotalsForCheck = {
	id: string;
	fiscalYearFrom: string;
	fiscalYearTo: string;
	status: "DRAFT" | "FINALIZED";
	/** Summe der PLAN-Kostenpositionen (Cent). */
	plannedTotalCents: number;
};

export type AnnualStatementConsistencyIssue =
	| {
			/** Summe der Einzelabrechnungen weicht von den Kostenpositionen ab (Tage ohne Eigentumsverhältnis / Cent-Rundung). */
			type: "UNASSIGNED_COSTS";
			/** Differenz in Cent: Kostenpositionen - Summe der Einzelabrechnungen (> 0 = unzugeordneter Anteil). */
			differenceCents: number;
	  }
	| {
			/** Tatsächliche Kosten weichen vom (finalisierten) Wirtschaftsplan des überlappenden Geschäftsjahrs ab. */
			type: "PLAN_DEVIATION";
			planId: string;
			fiscalYearFrom: string;
			fiscalYearTo: string;
			plannedTotalCents: number;
			actualTotalCents: number;
			differenceCents: number;
	  }
	| {
			/** Offene/überfällige Hausgeld-Sollstellungen im Abrechnungszeitraum (Rückstände - Hinweis, keine Sperre). */
			type: "HOUSING_CHARGE_ARREARS";
			openCount: number;
			openTotalCents: number;
	  }
	| {
			/** Zeitraum ohne finalisierten Wirtschaftsplan - Plan-/Ist-Abgleich nicht möglich. */
			type: "NO_ECONOMIC_PLAN";
	  };

/**
 * Plausibilitätsprüfung "passt die Gesamtabrechnung zu den
 * Einzelabrechnungen und zum Wirtschaftsplan?" (reine Funktion, vor der
 * Finalisierung als Hinweis-Karte angezeigt; bewusst KEINE harte Sperre -
 * Abweichungen können fachlich gewollt sein, z. B. ein abweichender
 * Abrechnungszeitraum gegenüber dem Geschäftsjahr):
 *
 * 1. UNASSIGNED_COSTS: Die Summe der Einzelabrechnungen muss der Summe der
 *    Kostenpositionen entsprechen. Eine Differenz entsteht, wenn Einheiten
 *    zeitweise ohne erfasstes Eigentumsverhältnis sind (der Anteil bleibt
 *    bewusst unzugeordnet, siehe hoa-allocation.ts) oder durch
 *    Cent-Rundungen (± wenige Cent).
 * 2. PLAN_DEVIATION: Abgleich der tatsächlichen Kosten gegen jeden
 *    finalisierten Wirtschaftsplan, dessen Geschäftsjahr den
 *    Abrechnungszeitraum überlappt (Soll-/Ist-Vergleich).
 * 3. HOUSING_CHARGE_ARREARS: Offene/überfällige Hausgeld-Sollstellungen im
 *    Zeitraum - diese flieren NICHT in die Abrechnung ein (siehe
 *    calculatePaidPrepaymentsCents), bleiben aber als Rückstand sichtbar.
 * 4. NO_ECONOMIC_PLAN: Kein finalisierter Wirtschaftsplan überlappt den
 *    Zeitraum - der Plan-/Ist-Abgleich ist dann nicht aussagekräftig.
 */
export function buildAnnualStatementConsistencyCheck(input: {
	periodFrom: Date;
	periodTo: Date;
	/** Summe der Kostenpositionen der Abrechnung (Cent). */
	costItemsTotalCents: number;
	result: AnnualStatementResult;
	/** Finalisierte Wirtschaftspläne der WEG (bereits vorab geladen). */
	economicPlans: EconomicPlanTotalsForCheck[];
	/** ALLE Hausgeld-Sollstellungen der Einheiten im Umfeld des Zeitraums (auch offene). */
	housingCharges: HousingChargeForStatementInput[];
}): AnnualStatementConsistencyIssue[] {
	const { periodFrom, periodTo, costItemsTotalCents, result, economicPlans, housingCharges } = input;
	const issues: AnnualStatementConsistencyIssue[] = [];

	// 1. Summe der Einzelabrechnungen vs. Gesamtabrechnung.
	const assignedTotalCents = result.ownerResults.reduce((sum, ownerResult) => sum + ownerResult.totalAllocatedCostsCents, 0);
	const differenceCents = costItemsTotalCents - assignedTotalCents;
	if (differenceCents !== 0) {
		issues.push({ type: "UNASSIGNED_COSTS", differenceCents });
	}

	// 2. Plan-/Ist-Abgleich gegen überlappende finalisierte Wirtschaftspläne.
	const overlappingFinalizedPlans = economicPlans.filter(
		(plan) => plan.status === "FINALIZED" && new Date(plan.fiscalYearFrom) <= periodTo && new Date(plan.fiscalYearTo) >= periodFrom
	);
	if (overlappingFinalizedPlans.length === 0) {
		issues.push({ type: "NO_ECONOMIC_PLAN" });
	}
	for (const plan of overlappingFinalizedPlans) {
		const planDifferenceCents = plan.plannedTotalCents - costItemsTotalCents;
		if (planDifferenceCents !== 0) {
			issues.push({
				type: "PLAN_DEVIATION",
				planId: plan.id,
				fiscalYearFrom: plan.fiscalYearFrom,
				fiscalYearTo: plan.fiscalYearTo,
				plannedTotalCents: plan.plannedTotalCents,
				actualTotalCents: costItemsTotalCents,
				differenceCents: planDifferenceCents,
			});
		}
	}

	// 3. Offene Hausgeld-Sollstellungen im Abrechnungszeitraum (Rückstände).
	let openCount = 0;
	let openTotalCents = 0;
	for (const charge of housingCharges) {
		if (charge.status !== "OPEN" && charge.status !== "OVERDUE") continue;
		const dueDate = new Date(charge.dueDate);
		if (dueDate < periodFrom || dueDate > periodTo) continue;
		openCount += 1;
		openTotalCents += toCents(charge.amount);
	}
	if (openCount > 0) {
		issues.push({ type: "HOUSING_CHARGE_ARREARS", openCount, openTotalCents });
	}

	return issues;
}

export const annualStatementStatusStyles: Record<AnnualStatementStatus, string> = {
	DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	FINALIZED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

/**
 * Deutsche Beschriftungen der WEG-Verteilerschlüssel - bewusst hartcodiert
 * (analog zu allocationKeyLabels in src/lib/billing.ts), da generierte
 * PDF-Inhalte fachlich deutsche Dokumente sind (siehe AGENTS.md Abschnitt 7).
 */
export const hoaAllocationKeyLabels: Record<HoaAllocationKey, string> = {
	MEA: "Miteigentumsanteile",
	LIVING_SPACE: "Wohnfläche",
	UNITS: "Einheiten",
	CONSUMPTION: "Verbrauch",
	DIRECT: "Direkte Zuordnung",
	CUSTOM: "Individuell",
};