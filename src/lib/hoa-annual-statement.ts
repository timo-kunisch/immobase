import type { AnnualStatementStatus } from "@/data/types";
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
	/** Nur bezahlte (bzw. als bezahlt erfasste) Vorauszahlungen fließen in die Abrechnung ein - siehe calculatePrepaymentsCents. */
	status: "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";
};

/**
 * Summiert die Hausgeld-Vorauszahlungen eines Eigentümers für eine Einheit
 * im Zeitanteil [ownedFrom, ownedTo]. Anders als bei der Nebenkosten-
 * abrechnung der Mietverwaltung (die den VERTRAGLICH VEREINBARTEN Betrag
 * taggenau umrechnet, siehe computePrepaymentsCents in src/lib/billing.ts)
 * werden hier die TATSÄCHLICH FÄLLIG GESTELLTEN housingCharges-Datensätze
 * anhand ihres Fälligkeitsdatums dem Zeitanteil zugeordnet - das bildet die
 * WEG-Praxis besser ab, in der das Hausgeld nicht wie eine Miete
 * "taggenau" anfällt, sondern als monatliche Sollstellung mit festem
 * Fälligkeitstag (siehe economicPlanUnitShares/generateHousingChargesAction).
 * Nur der Status "PAID" (tatsächlich geleistete Vorauszahlung) fließt ein -
 * offene/überfällige/stornierte Sollstellungen sind keine Vorauszahlung.
 */
export function calculatePrepaymentsCents(charges: HousingChargeForStatementInput[], unitId: string, ownerId: string, ownedFrom: Date, ownedTo: Date): number {
	return charges
		.filter((charge) => charge.unitId === unitId && charge.ownerId === ownerId && charge.status === "PAID")
		.filter((charge) => {
			const dueDate = new Date(charge.dueDate);
			return dueDate >= ownedFrom && dueDate <= ownedTo;
		})
		.reduce((sum, charge) => sum + toCents(charge.amount), 0);
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
		const totalPrepaymentsCents = calculatePrepaymentsCents(housingCharges, ownerResult.unitId, ownerResult.ownerId, ownerResult.ownedFrom, ownerResult.ownedTo);
		return {
			...ownerResult,
			totalPrepaymentsCents,
			balanceCents: ownerResult.totalAllocatedCostsCents - totalPrepaymentsCents,
		};
	});

	return { ownerResults, warnings: allocation.warnings };
}

export const annualStatementStatusStyles: Record<AnnualStatementStatus, string> = {
	DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	FINALIZED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};
