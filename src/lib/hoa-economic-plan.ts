import type { EconomicPlanStatus, HoaAllocationKey, HoaCostCategory } from "@/data/types";
import { toCents, centsToDecimalString, distributeCents } from "@/lib/money";

/**
 * Berechnungslogik für den Wirtschaftsplan (§ 28 Abs. 1 WEG): verteilt die
 * geplanten Jahreskosten (Gesamtwirtschaftsplan) auf die Einheiten
 * entsprechend ihrer jeweiligen Verteilerschlüssel und leitet daraus den
 * Einzelwirtschaftsplan (Jahres- und Monatsbetrag je Einheit) ab, der beim
 * Finalisieren als economicPlanUnitShares eingefroren wird und die
 * Grundlage für die monatlichen Hausgeld-Sollstellungen bildet (siehe
 * src/app/(app)/weg/wirtschaftsplan/actions.ts).
 *
 * Nutzt für die eigentliche Verteilerschlüssel-Logik
 * src/lib/hoa-allocation.ts::calculateHoaAllocationResult, allerdings ohne
 * Eigentümerwechsel-Zeitanteile (ein Wirtschaftsplan wird für das GESAMTE
 * Geschäftsjahr auf die jeweils AKTUELLE Einheit umgelegt, nicht auf
 * einzelne Eigentümer-Perioden - der Einzelwirtschaftsplan "gehört" der
 * Einheit, nicht einer bestimmten Eigentümer-Periode, siehe § 28 Abs. 2
 * Satz 2 WEG: "Beschlüsse über den Wirtschaftsplan ... wirken auch gegen
 * einen Sondernachfolger").
 */

export type EconomicPlanUnitInput = {
	id: string;
	livingSpace: number | null;
	coOwnershipShare: number | null;
};

export type EconomicPlanCustomWeightInput = {
	unitId: string;
	weight: number;
};

export type EconomicPlanCostItemInput = {
	id: string;
	amount: string;
	allocationKey: HoaAllocationKey;
	directUnitId: string | null;
	customAllocationWeights: EconomicPlanCustomWeightInput[];
};

export type EconomicPlanInput = {
	fiscalYearFrom: Date;
	fiscalYearTo: Date;
	units: EconomicPlanUnitInput[];
	costItems: EconomicPlanCostItemInput[];
};

export type EconomicPlanUnitShareResult = {
	unitId: string;
	annualAmountCents: number;
	monthlyAmountCents: number;
	annualAmount: string;
	monthlyAmount: string;
};

export type EconomicPlanWarning = {
	costItemId: string;
	reason: "NO_ALLOCATION_BASIS";
};

export type EconomicPlanResult = {
	unitShares: EconomicPlanUnitShareResult[];
	warnings: EconomicPlanWarning[];
	totalAnnualAmountCents: number;
};

function unitWeightFor(unit: EconomicPlanUnitInput, costItem: EconomicPlanCostItemInput): number {
	switch (costItem.allocationKey) {
		case "MEA":
			return unit.coOwnershipShare ?? 0;
		case "LIVING_SPACE":
			return unit.livingSpace ?? 0;
		case "UNITS":
			return 1;
		case "DIRECT":
			return unit.id === costItem.directUnitId ? 1 : 0;
		case "CUSTOM": {
			const weight = costItem.customAllocationWeights.find((w) => w.unitId === unit.id);
			return weight?.weight ?? 0;
		}
		// "CONSUMPTION" ist im Wirtschaftsplan (anders als in der
		// Jahresabrechnung) nicht sinnvoll anwendbar, da noch keine
		// tatsächlichen Verbrauchswerte für das (künftige) Geschäftsjahr
		// vorliegen können - wird daher wie ein fehlender Schlüssel
		// behandelt (Gewicht 0 je Einheit -> NO_ALLOCATION_BASIS-Warnung).
		default:
			return 0;
	}
}

/**
 * Berechnet den vollständigen Einzelwirtschaftsplan (Jahres- und
 * Monatsbetrag je Einheit) aus den geplanten Kostenpositionen des
 * Gesamtwirtschaftsplans. Reine, seiteneffektfreie Funktion.
 *
 * Der Monatsbetrag wird über die tatsächliche Anzahl der Monate im
 * Geschäftsjahr taggenau ermittelt (üblicherweise 12, aber ein
 * Rumpfgeschäftsjahr ist möglich) - Rundungsausgleich stellt sicher, dass
 * die Summe der 12 Monatsbeträge exakt dem Jahresbetrag entspricht (siehe
 * src/lib/money.ts::distributeCents).
 */
export function calculateEconomicPlanResult(plan: EconomicPlanInput): EconomicPlanResult {
	const warnings: EconomicPlanWarning[] = [];
	const annualAmountsByUnit = new Map<string, number>();
	for (const unit of plan.units) annualAmountsByUnit.set(unit.id, 0);

	let totalAnnualAmountCents = 0;

	for (const costItem of plan.costItems) {
		const amountCents = toCents(costItem.amount);
		totalAnnualAmountCents += amountCents;

		const unitWeights = plan.units.map((unit) => unitWeightFor(unit, costItem));
		const totalUnitWeight = unitWeights.reduce((sum, w) => sum + w, 0);

		if (totalUnitWeight <= 0) {
			warnings.push({ costItemId: costItem.id, reason: "NO_ALLOCATION_BASIS" });
			continue;
		}

		const unitAmounts = distributeCents(amountCents, unitWeights);
		plan.units.forEach((unit, index) => {
			annualAmountsByUnit.set(unit.id, (annualAmountsByUnit.get(unit.id) ?? 0) + unitAmounts[index]);
		});
	}

	// Anzahl der vollen Kalendermonate im Geschäftsjahr (üblicherweise 12).
	const monthCount = Math.max(
		1,
		(plan.fiscalYearTo.getFullYear() - plan.fiscalYearFrom.getFullYear()) * 12 + (plan.fiscalYearTo.getMonth() - plan.fiscalYearFrom.getMonth()) + 1
	);

	const unitShares: EconomicPlanUnitShareResult[] = plan.units.map((unit) => {
		const annualAmountCents = annualAmountsByUnit.get(unit.id) ?? 0;
		const monthlyShares = distributeCents(annualAmountCents, Array.from({ length: monthCount }, () => 1));
		// Der "Monatsbetrag" für die Anzeige/Sollstellung ist der erste der
		// (bei Rundungsausgleich ggf. um ±1 Cent schwankenden) Monatsanteile -
		// die tatsächlichen monatlichen Hausgeld-Sollstellungen verwenden beim
		// Anlegen ohnehin distributeCents über die konkreten Fälligkeitsmonate
		// (siehe generateHousingChargesAction), sodass die Jahressumme exakt
		// stimmt, auch wenn der hier gespeicherte "glatte" Monatsbetrag
		// gerundet ist.
		const monthlyAmountCents = monthlyShares[0] ?? 0;
		return {
			unitId: unit.id,
			annualAmountCents,
			monthlyAmountCents,
			annualAmount: centsToDecimalString(annualAmountCents),
			monthlyAmount: centsToDecimalString(monthlyAmountCents),
		};
	});

	return { unitShares, warnings, totalAnnualAmountCents };
}

export const economicPlanStatusLabels: Record<EconomicPlanStatus, string> = {
	DRAFT: "Entwurf",
	FINALIZED: "Finalisiert",
};

export const economicPlanStatusStyles: Record<EconomicPlanStatus, string> = {
	DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	FINALIZED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export const hoaCostCategoryLabels: Record<HoaCostCategory, string> = {
	RESERVE_CONTRIBUTION: "Zuführung Erhaltungsrücklage",
	ADMINISTRATOR_FEE: "Verwaltervergütung",
	INSURANCE: "Versicherung",
	CARETAKER: "Hauswart",
	MAINTENANCE_REPAIR: "Instandhaltung/Reparatur",
	WATER_DRAINAGE: "Wasser/Abwasser",
	HEATING: "Heizung",
	ELECTRICITY_COMMON: "Strom Gemeinschaftsflächen",
	CLEANING: "Reinigung",
	GARDEN_MAINTENANCE: "Gartenpflege",
	ELEVATOR: "Aufzug",
	LEGAL_ADVICE: "Rechts-/Steuerberatung",
	BANK_FEES: "Bankgebühren",
	OTHER: "Sonstige Kosten",
};
