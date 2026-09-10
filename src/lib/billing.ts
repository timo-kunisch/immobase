import type { AllocationKey, BillingPeriodStatus } from "@/data/types";
import { getRentForDate } from "@/lib/rent-history";
import { toCents, distributeCents } from "@/lib/money";
import { atMidnight, daysBetweenInclusive, daysInMonth, overlapRange } from "@/lib/date-range";

/**
 * Zentrale Berechnungslogik für die Nebenkostenabrechnung (Betriebskosten-
 * abrechnung nach § 2 BetrKV). Kapselt die komplette Umlage-Logik, damit sie
 * sowohl beim (jederzeit neu berechenbaren) Entwurf als auch beim einmaligen
 * Finalisieren identisch angewendet wird.
 *
 * WICHTIG: Alle Geldbeträge werden ausschließlich als ganze Cent (Integer)
 * verarbeitet, niemals als Float/Fließkommazahl - siehe src/lib/money.ts.
 * Für die Speicherung in der Datenbank wird daraus wieder ein Decimal-String
 * (z. B. "12.34") erzeugt, passend zu den TEXT-Geldspalten im DB-Schema.
 *
 * Grundprinzip der Umlage (zwei Schritte):
 *  1. Die Kostenposition wird - abhängig vom Umlageschlüssel - auf die
 *     Einheiten der Liegenschaft verteilt (Wohnfläche/Anzahl Einheiten/
 *     Verbrauch/Direktzuordnung/individuelle Gewichte). Der Umlageschlüssel
 *     "Personen" bildet hiervon eine Ausnahme, siehe unten.
 *  2. Der auf eine Einheit entfallende Betrag wird - taggenau - auf die
 *     Mietverhältnisse verteilt, die die Einheit während des
 *     Abrechnungszeitraums bewohnt haben (zeitanteilige Verteilung bei
 *     Mieterwechsel). War die Einheit zeitweise unvermietet, verbleibt der
 *     entsprechende Anteil beim Vermieter (wird keinem Mieter berechnet).
 *
 * Für den Umlageschlüssel "Personen" entfällt der Zwischenschritt auf
 * Einheiten-Ebene: Es wird direkt mit "Personentagen" (Personenzahl ×
 * bewohnte Tage) je Mietverhältnis über die gesamte Liegenschaft gerechnet -
 * das bildet sowohl die Gewichtung nach Einheit als auch die zeitanteilige
 * Verteilung bei Mieterwechsel in einem Schritt ab.
 */

type RentAdjustmentLike = {
	id: string;
	validFrom: string;
	coldRent: string;
	serviceCharges: string;
	notes: string | null;
};

/**
 * Eine im System als bezahlt markierte Monats-Sollstellung (Zahlung des
 * Mietvertrags, siehe /finanzen bzw. transactions): Grundlage der
 * TATSÄCHLICH geleisteten Nebenkosten-Vorauszahlungen.
 */
export type BillingPaidPaymentInput = {
	/** Fälligkeitsdatum der bezahlten Sollstellung - der zugehörige Monat zählt als geleistet. */
	dueDate: string;
};

/**
 * Summiert die TATSÄCHLICH geleisteten (im System als bezahlt markierten)
 * Nebenkosten-Vorauszahlungen für den Zeitanteil [occupiedFrom, occupiedTo]
 * eines Mietvertrags. Grundlage sind die bezahlten Monats-Sollstellungen des
 * Vertrags: Fällt für einen Monat mindestens eine bezahlte Sollstellung in
 * den Zeitanteil, gilt der Monat als geleistete Vorauszahlung - in Höhe des
 * zum Fälligkeitsdatum gültigen vertraglichen Nebenkostenanteils
 * (getRentForDate inkl. RentAdjustments, src/lib/rent-history.ts), anteilig
 * taggenau auf die Überlappung des Fälligkeitsmonats mit dem Zeitanteil
 * umgerechnet (1/Tage des Monats pro Tag, analog § 191 BGB-Tagesbruchteile).
 *
 * Nicht bezahlte Monate zählen bewusst NICHT (kein blindes Vertrauen auf
 * die vertraglich vereinbarte Vorauszahlung - gezählt wird nur, was der
 * Mieter tatsächlich überwiesen hat). Pro Monat wird höchstens eine
 * Sollstellung angerechnet, unabhängig davon, ob Miete und Vorauszahlung in
 * einer oder in getrennten Sollstellungen erfasst wurden.
 */
export function computePaidPrepaymentsCents(
	lease: { startDate: string; coldRent: string; serviceCharges: string },
	adjustments: RentAdjustmentLike[],
	paidPayments: BillingPaidPaymentInput[],
	occupiedFrom: Date,
	occupiedTo: Date
): { totalCents: number; paidPaymentsCount: number } {
	let totalEuros = 0;
	let countedMonths = 0;
	const from = atMidnight(occupiedFrom);
	const to = atMidnight(occupiedTo);
	const seenMonths = new Set<string>();

	for (const payment of paidPayments) {
		const due = atMidnight(new Date(payment.dueDate));
		if (Number.isNaN(due.getTime())) continue;

		const monthKey = `${due.getFullYear()}-${due.getMonth()}`;
		if (seenMonths.has(monthKey)) continue;

		// Überlappung des Fälligkeitsmonats mit dem Zeitanteil des Vertrags.
		const monthStart = atMidnight(new Date(due.getFullYear(), due.getMonth(), 1));
		const monthEnd = atMidnight(new Date(due.getFullYear(), due.getMonth() + 1, 0));
		const range = overlapRange(monthStart, monthEnd, from, to);
		if (!range) continue;

		const days = daysBetweenInclusive(range.from, range.to);
		if (days <= 0) continue;

		const { serviceCharges } = getRentForDate(lease, adjustments, due);
		totalEuros += (serviceCharges * days) / daysInMonth(due);
		seenMonths.add(monthKey);
		countedMonths += 1;
	}

	return { totalCents: Math.round(totalEuros * 100), paidPaymentsCount: countedMonths };
}

// ============================================================
// Eingabetypen für die Berechnung
// ============================================================

export type BillingLeaseInput = {
	id: string;
	unitId: string;
	startDate: string;
	endDate: string | null;
	coldRent: string;
	serviceCharges: string;
	numberOfOccupants: number;
	rentAdjustments: RentAdjustmentLike[];
	/** Als bezahlt markierte Sollstellungen des Vertrags (Vorauszahlungs-Grundlage). */
	paidTransactions: BillingPaidPaymentInput[];
};

export type BillingUnitInput = {
	id: string;
	livingSpace: number | null;
	leases: BillingLeaseInput[];
};

export type BillingConsumptionValueInput = {
	unitId: string;
	value: string;
};

/** Gewicht einer Einheit für allocationKey = "CUSTOM" (bereits aufgelöst). */
export type BillingCustomWeightInput = {
	unitId: string;
	weight: number;
};

export type BillingCostItemInput = {
	id: string;
	amount: string;
	allocationKey: AllocationKey;
	/** Nur relevant bei allocationKey = "DIRECT". */
	directUnitId: string | null;
	/** Nur relevant bei allocationKey = "CONSUMPTION". */
	consumptionValues: BillingConsumptionValueInput[];
	/** Nur relevant bei allocationKey = "CUSTOM" (Gewichte des referenzierten Schlüssels). */
	customAllocationWeights: BillingCustomWeightInput[];
};

export type BillingPeriodInput = {
	periodFrom: Date;
	periodTo: Date;
	units: BillingUnitInput[];
	costItems: BillingCostItemInput[];
};

// ============================================================
// Ergebnistypen
// ============================================================

export type LeaseStatementLine = {
	costItemId: string;
	amountCents: number;
};

export type LeaseBillingResult = {
	leaseId: string;
	unitId: string;
	occupiedFrom: Date;
	occupiedTo: Date;
	occupiedDays: number;
	lines: LeaseStatementLine[];
	totalAllocatedCostsCents: number;
	/** Tatsächlich geleistete Vorauszahlungen (nur bezahlte Monate). */
	totalPrepaymentsCents: number;
	/** Anzahl angerechneter bezahlter Monats-Zahlungen (0 = Warnhinweis in der UI). */
	paidPrepaymentCount: number;
	/** umgelegte Kosten - Vorauszahlungen: positiv = Nachzahlung, negativ = Guthaben. */
	balanceCents: number;
};

export type CostItemAllocationWarning = {
	costItemId: string;
	reason: "NO_ALLOCATION_BASIS" | "NO_OCCUPANTS";
};

export type BillingResult = {
	leaseResults: LeaseBillingResult[];
	warnings: CostItemAllocationWarning[];
};

// ============================================================
// Hauptberechnung
// ============================================================

type LeaseOverlap = {
	lease: BillingLeaseInput;
	unitId: string;
	occupiedFrom: Date;
	occupiedTo: Date;
	occupiedDays: number;
};

function unitWeightFor(unit: BillingUnitInput, costItem: BillingCostItemInput): number {
	switch (costItem.allocationKey) {
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
 * Berechnet für eine Abrechnungsperiode die vollständige Kostenumlage je
 * Mietvertrag. Reine, seiteneffektfreie Funktion (kein DB-Zugriff) - die
 * benötigten Daten werden vom Aufrufer (Server Action/Server Component) aus
 * dem Repository-Layer (src/data/billing.ts) geladen und hier nur noch
 * ausgewertet. Wird sowohl für die Live-Vorschau im Entwurf als auch beim
 * einmaligen Finalisieren (Einfrieren als TenantStatement) verwendet.
 */
export function calculateBillingResult(period: BillingPeriodInput): BillingResult {
	const periodTotalDays = daysBetweenInclusive(period.periodFrom, period.periodTo);
	const warnings: CostItemAllocationWarning[] = [];

	const overlapsByUnit = new Map<string, LeaseOverlap[]>();
	const allOverlaps: LeaseOverlap[] = [];

	for (const unit of period.units) {
		const overlaps: LeaseOverlap[] = [];
		for (const lease of unit.leases) {
			const leaseStart = new Date(lease.startDate);
			const leaseEnd = lease.endDate ? new Date(lease.endDate) : period.periodTo;
			const range = overlapRange(leaseStart, leaseEnd, period.periodFrom, period.periodTo);
			if (!range) continue;
			const occupiedDays = daysBetweenInclusive(range.from, range.to);
			if (occupiedDays <= 0) continue;
			const overlap: LeaseOverlap = {
				lease,
				unitId: unit.id,
				occupiedFrom: range.from,
				occupiedTo: range.to,
				occupiedDays,
			};
			overlaps.push(overlap);
			allOverlaps.push(overlap);
		}
		overlaps.sort((a, b) => a.occupiedFrom.getTime() - b.occupiedFrom.getTime());
		overlapsByUnit.set(unit.id, overlaps);
	}

	const linesByLease = new Map<string, LeaseStatementLine[]>();
	const ensureLeaseLines = (leaseId: string): LeaseStatementLine[] => {
		if (!linesByLease.has(leaseId)) linesByLease.set(leaseId, []);
		return linesByLease.get(leaseId)!;
	};

	for (const costItem of period.costItems) {
		const amountCents = toCents(costItem.amount);

		if (costItem.allocationKey === "OCCUPANTS") {
			// Direkte Verteilung über "Personentage" (Personenzahl × bewohnte
			// Tage) - bildet Einheiten-Gewichtung und Zeitanteil bei
			// Mieterwechsel in einem Schritt ab, siehe Dateikopf.
			const weights = allOverlaps.map((o) => o.lease.numberOfOccupants * o.occupiedDays);
			const totalWeight = weights.reduce((sum, w) => sum + w, 0);
			if (totalWeight <= 0) {
				warnings.push({ costItemId: costItem.id, reason: "NO_OCCUPANTS" });
				continue;
			}
			const shares = distributeCents(amountCents, weights);
			allOverlaps.forEach((overlap, index) => {
				if (shares[index] === 0) return;
				ensureLeaseLines(overlap.lease.id).push({
					costItemId: costItem.id,
					amountCents: shares[index],
				});
			});
			continue;
		}

		// Schritt 1: Kostenposition auf die Einheiten der Liegenschaft verteilen.
		const unitWeights = period.units.map((unit) => unitWeightFor(unit, costItem));
		const totalUnitWeight = unitWeights.reduce((sum, w) => sum + w, 0);

		if (totalUnitWeight <= 0) {
			warnings.push({ costItemId: costItem.id, reason: "NO_ALLOCATION_BASIS" });
			continue;
		}

		const unitAmounts = distributeCents(amountCents, unitWeights);

		// Schritt 2: Den Einheiten-Betrag taggenau auf die Mietverhältnisse
		// verteilen, die die Einheit im Abrechnungszeitraum bewohnt haben.
		period.units.forEach((unit, unitIndex) => {
			const unitAmountCents = unitAmounts[unitIndex];
			if (unitAmountCents === 0) return;

			const overlaps = overlapsByUnit.get(unit.id) ?? [];
			const occupiedDaysSum = overlaps.reduce((s, o) => s + o.occupiedDays, 0);
			const vacantDays = Math.max(periodTotalDays - occupiedDaysSum, 0);

			// Leerstandsanteil als zusätzliches Gewicht mitgeben: dadurch summieren
			// sich die Mieteranteile bei Vollvermietung exakt zum Einheiten-
			// Betrag; ein etwaiger Leerstandsanteil verbleibt beim Vermieter statt
			// fälschlich (bevorzugt) auf die vorhandenen Mieter verteilt zu werden.
			const weights = [...overlaps.map((o) => o.occupiedDays), vacantDays];
			const shares = distributeCents(unitAmountCents, weights);

			overlaps.forEach((overlap, index) => {
				const shareCents = shares[index];
				if (shareCents === 0) return;
				ensureLeaseLines(overlap.lease.id).push({
					costItemId: costItem.id,
					amountCents: shareCents,
				});
			});
			// shares[shares.length - 1] entspricht dem Leerstandsanteil und bleibt
			// absichtlich unberücksichtigt (kein Mietverhältnis dafür vorhanden).
		});
	}

	const leaseResults: LeaseBillingResult[] = allOverlaps.map((overlap) => {
		const lines = linesByLease.get(overlap.lease.id) ?? [];
		const totalAllocatedCostsCents = lines.reduce((s, l) => s + l.amountCents, 0);
		const { totalCents: totalPrepaymentsCents, paidPaymentsCount: paidPrepaymentCount } = computePaidPrepaymentsCents(
			overlap.lease,
			overlap.lease.rentAdjustments,
			overlap.lease.paidTransactions,
			overlap.occupiedFrom,
			overlap.occupiedTo
		);
		return {
			leaseId: overlap.lease.id,
			unitId: overlap.unitId,
			occupiedFrom: overlap.occupiedFrom,
			occupiedTo: overlap.occupiedTo,
			occupiedDays: overlap.occupiedDays,
			lines,
			totalAllocatedCostsCents,
			totalPrepaymentsCents,
			paidPrepaymentCount,
			balanceCents: totalAllocatedCostsCents - totalPrepaymentsCents,
		};
	});

	return { leaseResults, warnings };
}

// ============================================================
// Beschriftungen (für UI, analog zu src/lib/lease-status.ts)
// ============================================================

export const billingPeriodStatusLabels: Record<BillingPeriodStatus, string> = {
	DRAFT: "Entwurf",
	FINALIZED: "Finalisiert",
};

export const billingPeriodStatusStyles: Record<BillingPeriodStatus, string> = {
	DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	FINALIZED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export const allocationKeyLabels: Record<AllocationKey, string> = {
	LIVING_SPACE: "Wohnfläche",
	OCCUPANTS: "Personen",
	UNITS: "Einheiten",
	CONSUMPTION: "Verbrauch",
	DIRECT: "Direkte Zuordnung",
	CUSTOM: "Individuell",
};
