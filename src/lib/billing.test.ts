import { describe, expect, it } from "vitest";

import { calculateBillingResult, buildCostItemsFromAccountBookingSums, computePaidPrepaymentsCents } from "@/lib/billing";

/**
 * Tests für die reine Berechnungslogik der Nebenkostenabrechnung
 * (src/lib/billing.ts) - ohne DB-Zugriff:
 * - computePaidPrepaymentsCents: Nur TATSÄCHLICH geleistete (als bezahlt
 *   markierte) Vorauszahlungen zählen, taggenau anteilig.
 * - calculateBillingResult: Verteilung über individuell definierte
 *   Umlageschlüssel (allocationKey "CUSTOM").
 * - buildCostItemsFromAccountBookingSums: Import der Buchhaltungs-
 *   Kontobewegungen als Kostenpositionen (Vorzeichen/Saldo-0-Filter).
 */

type AdjustmentLike = { id: string; validFrom: string; coldRent: string; serviceCharges: string; notes: string | null };

const BASE_LEASE = {
	startDate: "2026-01-01",
	coldRent: "800.00",
	serviceCharges: "150.00",
};

const NO_ADJUSTMENTS: AdjustmentLike[] = [];

function paidPayment(dueDate: string): { dueDate: string } {
	return { dueDate };
}

describe("computePaidPrepaymentsCents", () => {
	it("zählt nur Monate mit bezahlter Sollstellung (nicht die vertraglich vereinbarte Vorauszahlung)", () => {
		// 12 Abrechnungsmonate, aber nur Jan-Jun bezahlt -> 6 x 150,00 €.
		const paidPayments = ["2026-01-03", "2026-02-03", "2026-03-03", "2026-04-03", "2026-05-03", "2026-06-03"].map(paidPayment);
		const result = computePaidPrepaymentsCents(BASE_LEASE, NO_ADJUSTMENTS, paidPayments, new Date("2026-01-01"), new Date("2026-12-31"));
		expect(result.totalCents).toBe(90_000);
		expect(result.paidPaymentsCount).toBe(6);
	});

	it("rechnet bei unterjährigem Vertragsende den letzten Monat taggenau anteilig", () => {
		// Vertrag endet am 15.06.: Jan-Mai voll, Juni 15/30.
		const paidPayments = ["2026-01-03", "2026-02-03", "2026-03-03", "2026-04-03", "2026-05-03", "2026-06-03"].map(paidPayment);
		const result = computePaidPrepaymentsCents(BASE_LEASE, NO_ADJUSTMENTS, paidPayments, new Date("2026-01-01"), new Date("2026-06-15"));
		expect(result.totalCents).toBe(82_500);
	});

	it("liefert 0 ohne bezahlte Sollstellungen (Warnhinweis in der UI über paidPaymentsCount)", () => {
		const result = computePaidPrepaymentsCents(BASE_LEASE, NO_ADJUSTMENTS, [], new Date("2026-01-01"), new Date("2026-12-31"));
		expect(result.totalCents).toBe(0);
		expect(result.paidPaymentsCount).toBe(0);
	});

	it("berücksichtigt Mietanpassungen über den Verlauf (getRentForDate)", () => {
		const adjustments: AdjustmentLike[] = [
			{ id: "adj-1", validFrom: "2026-07-01", coldRent: "820.00", serviceCharges: "160.00", notes: null },
		];
		// Nur Juli bezahlt - dort gilt die angepasste Vorauszahlung.
		const result = computePaidPrepaymentsCents(BASE_LEASE, adjustments, [paidPayment("2026-07-03")], new Date("2026-01-01"), new Date("2026-12-31"));
		expect(result.totalCents).toBe(16_000);
	});

	it("zählt mehrere bezahlte Sollstellungen desselben Monats nur einmal", () => {
		const result = computePaidPrepaymentsCents(
			BASE_LEASE,
			NO_ADJUSTMENTS,
			[paidPayment("2026-03-01"), paidPayment("2026-03-20")],
			new Date("2026-01-01"),
			new Date("2026-12-31")
		);
		expect(result.totalCents).toBe(15_000);
		expect(result.paidPaymentsCount).toBe(1);
	});

	it("ignoriert Zahlungen, deren Fälligkeitsmonat den Zeitanteil nicht überlappt", () => {
		// Zeitanteil Feb-Dez; Zahlung fällig im Januar zählt nicht.
		const result = computePaidPrepaymentsCents(BASE_LEASE, NO_ADJUSTMENTS, [paidPayment("2026-01-03")], new Date("2026-02-01"), new Date("2026-12-31"));
		expect(result.totalCents).toBe(0);
		expect(result.paidPaymentsCount).toBe(0);
	});
});

describe("calculateBillingResult mit individuellem Umlageschlüssel (CUSTOM)", () => {
	function unitWithLease(id: string, leaseId: string) {
		return {
			id,
			livingSpace: 50,
			leases: [
				{
					id: leaseId,
					unitId: id,
					startDate: "2026-01-01",
					endDate: null,
					coldRent: "800.00",
					serviceCharges: "150.00",
					numberOfOccupants: 1,
					rentAdjustments: NO_ADJUSTMENTS,
					paidTransactions: [],
				},
			],
		};
	}

	it("verteilt nach individuell hinterlegten Gewichten centgenau", () => {
		const result = calculateBillingResult({
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [unitWithLease("u1", "l1"), unitWithLease("u2", "l2")],
			costItems: [
				{
					id: "ci-1",
					amount: "100.00",
					allocationKey: "CUSTOM",
					directUnitId: null,
					consumptionValues: [],
					customAllocationWeights: [
						{ unitId: "u1", weight: 1 },
						{ unitId: "u2", weight: 3 },
					],
				},
			],
		});

		expect(result.warnings).toHaveLength(0);
		const byLease = new Map(result.leaseResults.map((leaseResult) => [leaseResult.leaseId, leaseResult]));
		expect(byLease.get("l1")?.lines[0].amountCents).toBe(2_500);
		expect(byLease.get("l2")?.lines[0].amountCents).toBe(7_500);
	});

	it("meldet NO_ALLOCATION_BASIS, wenn für CUSTOM keine Gewichte hinterlegt sind", () => {
		const result = calculateBillingResult({
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [unitWithLease("u1", "l1")],
			costItems: [
				{
					id: "ci-1",
					amount: "100.00",
					allocationKey: "CUSTOM",
					directUnitId: null,
					consumptionValues: [],
					customAllocationWeights: [],
				},
			],
		});

		expect(result.warnings).toEqual([{ costItemId: "ci-1", reason: "NO_ALLOCATION_BASIS" }]);
		expect(result.leaseResults[0].lines).toHaveLength(0);
		expect(result.leaseResults[0].totalPrepaymentsCents).toBe(0);
		expect(result.leaseResults[0].paidPrepaymentCount).toBe(0);
	});
});

describe("buildCostItemsFromAccountBookingSums (Import aus der Buchhaltung)", () => {
	it("übernimmt Aufwand als positive und Erstattungsüberschuss als negative Kostenposition", () => {
		const items = buildCostItemsFromAccountBookingSums(
			[
				{ id: "a1", label: "Gebäudeversicherung", totalCents: -40_000, bookingCount: 2 },
				{ id: "a2", label: "Mieter-Erstattung", totalCents: 1_250, bookingCount: 1 },
			],
			"UNITS"
		);

		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({ label: "Gebäudeversicherung", amount: "400.00", allocationKey: "UNITS", sourceAccountId: "a1" });
		expect(items[0].notes).toBe("Übernommen aus der Buchhaltung (2 Buchungen im Abrechnungszeitraum).");
		expect(items[1]).toMatchObject({ label: "Mieter-Erstattung", amount: "-12.50", allocationKey: "UNITS", sourceAccountId: "a2" });
	});

	it("überspringt Konten mit Saldo 0 und dokumentiert die Buchungsanzahl in der Notiz", () => {
		const items = buildCostItemsFromAccountBookingSums(
			[
				{ id: "a1", label: "Heizung", totalCents: 0, bookingCount: 2 },
				{ id: "a2", label: "Wasserversorgung", totalCents: -25_050, bookingCount: 1 },
			],
			"LIVING_SPACE"
		);

		expect(items).toHaveLength(1);
		expect(items[0].label).toBe("Wasserversorgung");
		expect(items[0].amount).toBe("250.50");
		expect(items[0].notes).toBe("Übernommen aus der Buchhaltung (1 Buchung im Abrechnungszeitraum).");
	});
});