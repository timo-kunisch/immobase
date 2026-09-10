import type { HoaAllocationKey } from "@/data/types";
import { daysBetweenInclusive, overlapRange } from "@/lib/date-range";
import { toCents, distributeCents } from "@/lib/money";

/**
 * Zentrale Berechnungslogik für die Kostenumlage der WEG-Verwaltung -
 * gemeinsam genutzt von Wirtschaftsplan (src/lib/hoa-economic-plan.ts) UND
 * Jahresabrechnung (src/lib/hoa-annual-statement.ts), analog zur Rolle von
 * src/lib/billing.ts für die Nebenkostenabrechnung der Mietverwaltung.
 *
 * WICHTIG: Alle Geldbeträge werden ausschließlich als ganze Cent (Integer)
 * verarbeitet, niemals als Float - siehe src/lib/money.ts.
 *
 * Unterschiede zur Nebenkostenabrechnung (src/lib/billing.ts):
 *  - Der gesetzliche Regelverteilerschlüssel ist "MEA" (Miteigentumsanteile,
 *    § 16 Abs. 2 WEG) statt "Wohnfläche" - zusätzlich zu den von der
 *    Nebenkostenabrechnung bekannten Schlüsseln "Einheiten"/"Verbrauch"/
 *    "Direkte Zuordnung" sowie einem frei definierbaren Schlüssel
 *    ("CUSTOM", je Einheit frei vergebbare Gewichte).
 *  - Es gibt keinen "Personen"-Schlüssel (WEG-Kosten werden nicht nach
 *    Personenzahl der Bewohner umgelegt).
 *  - Die zweite Verteilungsstufe (Einheit -> Zeitanteil) verteilt nicht auf
 *    Mietverhältnisse, sondern auf Eigentumsverhältnisse (unitOwnerships) -
 *    bei einem unterjährigen Eigentümerwechsel wird der auf eine Einheit
 *    entfallende Betrag taggenau zwischen altem und neuem Eigentümer
 *    aufgeteilt. Ist eine Einheit für einen Teil des Zeitraums ohne
 *    erfasstes Eigentumsverhältnis (Datenlücke), verbleibt dieser Anteil
 *    unzugeordnet (analog zum Leerstand in src/lib/billing.ts).
 */

export type HoaAllocationUnitInput = {
	id: string;
	livingSpace: number | null;
	/** Miteigentumsanteil (Zähler); der Nenner ist hoas.totalShares. */
	coOwnershipShare: number | null;
	ownerships: HoaOwnershipInput[];
};

export type HoaOwnershipInput = {
	id: string;
	ownerId: string;
	startDate: string;
	endDate: string | null;
};

export type HoaConsumptionValueInput = {
	unitId: string;
	value: string;
};

export type HoaCustomAllocationWeightInput = {
	unitId: string;
	weight: number;
};

export type HoaAllocationCostItemInput = {
	id: string;
	amount: string;
	allocationKey: HoaAllocationKey;
	/** Nur relevant bei allocationKey = "DIRECT". */
	directUnitId: string | null;
	/** Nur relevant bei allocationKey = "CONSUMPTION". */
	consumptionValues: HoaConsumptionValueInput[];
	/** Nur relevant bei allocationKey = "CUSTOM" (bereits für diese Kostenposition aufgelöste Gewichte je Einheit). */
	customAllocationWeights: HoaCustomAllocationWeightInput[];
};

export type HoaAllocationPeriodInput = {
	periodFrom: Date;
	periodTo: Date;
	units: HoaAllocationUnitInput[];
	costItems: HoaAllocationCostItemInput[];
};

export type OwnerStatementLine = {
	costItemId: string;
	amountCents: number;
};

export type OwnerAllocationResult = {
	ownershipId: string;
	unitId: string;
	ownerId: string;
	ownedFrom: Date;
	ownedTo: Date;
	ownedDays: number;
	lines: OwnerStatementLine[];
	totalAllocatedCostsCents: number;
};

export type HoaAllocationWarning = {
	costItemId: string;
	reason: "NO_ALLOCATION_BASIS";
};

export type HoaAllocationResult = {
	ownerResults: OwnerAllocationResult[];
	warnings: HoaAllocationWarning[];
};

type OwnershipOverlap = {
	ownership: HoaOwnershipInput;
	unitId: string;
	ownedFrom: Date;
	ownedTo: Date;
	ownedDays: number;
};

function unitWeightFor(unit: HoaAllocationUnitInput, costItem: HoaAllocationCostItemInput): number {
	switch (costItem.allocationKey) {
		case "MEA":
			return unit.coOwnershipShare ?? 0;
		case "LIVING_SPACE":
			return unit.livingSpace ?? 0;
		case "UNITS":
			return 1;
		case "CONSUMPTION": {
			const consumption = costItem.consumptionValues.find((c) => c.unitId === unit.id);
			return consumption?.value ? Number(consumption.value) : 0;
		}
		case "DIRECT":
			return unit.id === costItem.directUnitId ? 1 : 0;
		case "CUSTOM": {
			const weight = costItem.customAllocationWeights.find((w) => w.unitId === unit.id);
			return weight?.weight ?? 0;
		}
		default:
			return 0;
	}
}

/**
 * Berechnet für einen Zeitraum (Wirtschaftsplan-Geschäftsjahr oder
 * Jahresabrechnungs-Zeitraum) die vollständige Kostenumlage je
 * Eigentumsverhältnis. Reine, seiteneffektfreie Funktion (kein DB-Zugriff),
 * analog zu src/lib/billing.ts::calculateBillingResult.
 */
export function calculateHoaAllocationResult(period: HoaAllocationPeriodInput): HoaAllocationResult {
	const periodTotalDays = daysBetweenInclusive(period.periodFrom, period.periodTo);
	const warnings: HoaAllocationWarning[] = [];

	const overlapsByUnit = new Map<string, OwnershipOverlap[]>();
	const allOverlaps: OwnershipOverlap[] = [];

	for (const unit of period.units) {
		const overlaps: OwnershipOverlap[] = [];
		for (const ownership of unit.ownerships) {
			const ownershipStart = new Date(ownership.startDate);
			const ownershipEnd = ownership.endDate ? new Date(ownership.endDate) : period.periodTo;
			const range = overlapRange(ownershipStart, ownershipEnd, period.periodFrom, period.periodTo);
			if (!range) continue;
			const ownedDays = daysBetweenInclusive(range.from, range.to);
			if (ownedDays <= 0) continue;
			const overlap: OwnershipOverlap = {
				ownership,
				unitId: unit.id,
				ownedFrom: range.from,
				ownedTo: range.to,
				ownedDays,
			};
			overlaps.push(overlap);
			allOverlaps.push(overlap);
		}
		overlaps.sort((a, b) => a.ownedFrom.getTime() - b.ownedFrom.getTime());
		overlapsByUnit.set(unit.id, overlaps);
	}

	const linesByOwnership = new Map<string, OwnerStatementLine[]>();
	const ensureOwnershipLines = (ownershipId: string): OwnerStatementLine[] => {
		if (!linesByOwnership.has(ownershipId)) linesByOwnership.set(ownershipId, []);
		return linesByOwnership.get(ownershipId)!;
	};

	for (const costItem of period.costItems) {
		const amountCents = toCents(costItem.amount);

		// Schritt 1: Kostenposition auf die Einheiten der WEG verteilen.
		const unitWeights = period.units.map((unit) => unitWeightFor(unit, costItem));
		const totalUnitWeight = unitWeights.reduce((sum, w) => sum + w, 0);

		if (totalUnitWeight <= 0) {
			warnings.push({ costItemId: costItem.id, reason: "NO_ALLOCATION_BASIS" });
			continue;
		}

		const unitAmounts = distributeCents(amountCents, unitWeights);

		// Schritt 2: Den Einheiten-Betrag taggenau auf die Eigentumsverhältnisse
		// verteilen, die die Einheit im Zeitraum gehört haben.
		period.units.forEach((unit, unitIndex) => {
			const unitAmountCents = unitAmounts[unitIndex];
			if (unitAmountCents === 0) return;

			const overlaps = overlapsByUnit.get(unit.id) ?? [];
			const ownedDaysSum = overlaps.reduce((s, o) => s + o.ownedDays, 0);
			// Tage ohne erfasstes Eigentumsverhältnis (Datenlücke) - bleiben
			// analog zum Leerstand in src/lib/billing.ts unzugeordnet.
			const unassignedDays = Math.max(periodTotalDays - ownedDaysSum, 0);

			const weights = [...overlaps.map((o) => o.ownedDays), unassignedDays];
			const shares = distributeCents(unitAmountCents, weights);

			overlaps.forEach((overlap, index) => {
				const shareCents = shares[index];
				if (shareCents === 0) return;
				ensureOwnershipLines(overlap.ownership.id).push({
					costItemId: costItem.id,
					amountCents: shareCents,
				});
			});
		});
	}

	const ownerResults: OwnerAllocationResult[] = allOverlaps.map((overlap) => {
		const lines = linesByOwnership.get(overlap.ownership.id) ?? [];
		const totalAllocatedCostsCents = lines.reduce((s, l) => s + l.amountCents, 0);
		return {
			ownershipId: overlap.ownership.id,
			unitId: overlap.unitId,
			ownerId: overlap.ownership.ownerId,
			ownedFrom: overlap.ownedFrom,
			ownedTo: overlap.ownedTo,
			ownedDays: overlap.ownedDays,
			lines,
			totalAllocatedCostsCents,
		};
	});

	return { ownerResults, warnings };
}

// ============================================================
// Beschriftungen (für UI, analog zu src/lib/billing.ts)
// ============================================================

