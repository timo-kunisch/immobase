import { describe, expect, it } from "vitest";

import { calculateEconomicPlanResult, type EconomicPlanInput } from "@/lib/hoa-economic-plan";
import { calculateAnnualStatementResult, type HousingChargeForStatementInput } from "@/lib/hoa-annual-statement";
import type { HoaAllocationPeriodInput } from "@/lib/hoa-allocation";
import { buildBetrKvCostItemsFromHoaStatement } from "@/lib/hoa-betrkv-bridge";
import { centsToDecimalString, toCents } from "@/lib/money";

/**
 * Realistischer Durchstich-Test: WEG mit drei Einheiten, Eigentümerwechsel
 * einer Einheit zum 1. Juli, Wirtschaftsplan -> monatliche
 * Hausgeldzahlungen -> Jahresabrechnung inkl. Abrechnungsspitze, sowie der
 * Übertrag der umlagefähigen Positionen einer vermieteten Einheit in die
 * Nebenkostenabrechnung (BetrKV-Brücke).
 *
 * Szenario:
 *  - WEG "Sonnenhof", 3 Einheiten, Geschäftsjahr 01.01.-31.12.2026.
 *  - Einheit 1 (MEA 400, 60 m²): Eigentümer A durchgehend das ganze Jahr,
 *    VERMIETET an einen Mieter (BetrKV-Brücke relevant).
 *  - Einheit 2 (MEA 300, 45 m²): Eigentümer B verkauft zum 1. Juli 2026 an
 *    Eigentümer C (unterjähriger Wechsel).
 *  - Einheit 3 (MEA 300, 45 m²): Eigentümer D durchgehend das ganze Jahr.
 *  - Wirtschaftsplan: 12.000 € Gesamtkosten/Jahr, umgelegt nach MEA.
 *  - Jedem Eigentümer wird monatlich sein Einzelwirtschaftsplan-Anteil als
 *    Hausgeld fällig gestellt und als bezahlt erfasst (status "PAID").
 *  - Jahresabrechnung: tatsächliche Kosten weichen leicht vom Plan ab
 *    (12.600 € statt 12.000 €) - es entsteht eine Abrechnungsspitze
 *    (Nachzahlung).
 */
describe("WEG-Durchstich: Wirtschaftsplan -> Hausgeld -> Jahresabrechnung", () => {
	const fiscalYearFrom = new Date(2026, 0, 1);
	const fiscalYearTo = new Date(2026, 11, 31);

	const units = [
		{ id: "unit-1", livingSpace: 60, coOwnershipShare: 400 },
		{ id: "unit-2", livingSpace: 45, coOwnershipShare: 300 },
		{ id: "unit-3", livingSpace: 45, coOwnershipShare: 300 },
	];

	it("berechnet den Einzelwirtschaftsplan je Einheit nach MEA", () => {
		const plan: EconomicPlanInput = {
			fiscalYearFrom,
			fiscalYearTo,
			units,
			costItems: [
				{ id: "plan-verwaltung", amount: "3600.00", allocationKey: "MEA", directUnitId: null, customAllocationWeights: [] },
				{ id: "plan-versicherung", amount: "1200.00", allocationKey: "MEA", directUnitId: null, customAllocationWeights: [] },
				{ id: "plan-ruecklage", amount: "4800.00", allocationKey: "MEA", directUnitId: null, customAllocationWeights: [] },
				{ id: "plan-wasser", amount: "2400.00", allocationKey: "MEA", directUnitId: null, customAllocationWeights: [] },
			],
			// Gesamt: 12.000 €
		};

		const result = calculateEconomicPlanResult(plan);
		expect(result.totalAnnualAmountCents).toBe(1_200_000);
		expect(result.warnings).toHaveLength(0);

		const shareByUnit = new Map(result.unitShares.map((s) => [s.unitId, s]));
		// MEA-Anteile: 400/1000, 300/1000, 300/1000 von 12.000 € = 4.800 / 3.600 / 3.600.
		expect(shareByUnit.get("unit-1")!.annualAmount).toBe("4800.00");
		expect(shareByUnit.get("unit-2")!.annualAmount).toBe("3600.00");
		expect(shareByUnit.get("unit-3")!.annualAmount).toBe("3600.00");
		// Monatsbeträge: 400.00 / 300.00 / 300.00 (glatt teilbar, kein Rundungsausgleich nötig).
		expect(shareByUnit.get("unit-1")!.monthlyAmount).toBe("400.00");
		expect(shareByUnit.get("unit-2")!.monthlyAmount).toBe("300.00");
		expect(shareByUnit.get("unit-3")!.monthlyAmount).toBe("300.00");

		// Simuliert das monatliche Fälligstellen (12 Monate) des Hausgelds je
		// Eigentümer/Einheit auf Basis des Einzelwirtschaftsplans, inkl.
		// Eigentümerwechsel bei unit-2 zum 1. Juli (Eigentümer B -> C).
		const housingCharges: HousingChargeForStatementInput[] = [];
		const ownerOfUnit2ForMonth = (month: number) => (month < 6 ? "owner-b" : "owner-c");
		const unitOwnerMap: Record<string, (month: number) => string> = {
			"unit-1": () => "owner-a",
			"unit-2": ownerOfUnit2ForMonth,
			"unit-3": () => "owner-d",
		};

		for (const unit of units) {
			const share = shareByUnit.get(unit.id)!;
			for (let month = 0; month < 12; month += 1) {
				housingCharges.push({
					unitId: unit.id,
					ownerId: unitOwnerMap[unit.id](month),
					amount: share.monthlyAmount,
					dueDate: new Date(2026, month, 3).toISOString(),
					status: "PAID",
				});
			}
		}

		// 12 Hausgeldzahlungen je Einheit, Summe je Einheit entspricht exakt dem Jahresbetrag.
		const totalPaidUnit1 = housingCharges.filter((c) => c.unitId === "unit-1").reduce((s, c) => s + toCents(c.amount), 0);
		expect(centsToDecimalString(totalPaidUnit1)).toBe("4800.00");

		// ---------- Jahresabrechnung mit tatsächlichen Kosten (leicht abweichend vom Plan) ----------
		const annualPeriod: HoaAllocationPeriodInput = {
			periodFrom: fiscalYearFrom,
			periodTo: fiscalYearTo,
			units: [
				{ id: "unit-1", livingSpace: 60, coOwnershipShare: 400, ownerships: [{ id: "own-1", ownerId: "owner-a", startDate: "2020-01-01", endDate: null }] },
				{
					id: "unit-2",
					livingSpace: 45,
					coOwnershipShare: 300,
					ownerships: [
						{ id: "own-2a", ownerId: "owner-b", startDate: "2020-01-01", endDate: "2026-06-30" },
						{ id: "own-2b", ownerId: "owner-c", startDate: "2026-07-01", endDate: null },
					],
				},
				{ id: "unit-3", livingSpace: 45, coOwnershipShare: 300, ownerships: [{ id: "own-3", ownerId: "owner-d", startDate: "2020-01-01", endDate: null }] },
			],
			costItems: [
				{ id: "stmt-verwaltung", amount: "3600.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] },
				{ id: "stmt-versicherung", amount: "1200.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] },
				{ id: "stmt-ruecklage", amount: "4800.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] },
				// Wasserkosten sind tatsächlich höher ausgefallen als geplant (2.400 € statt 2.400 € geplant + 600 € Nachforderung).
				{ id: "stmt-wasser", amount: "3000.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] },
			],
			// Gesamt: 12.600 € (600 € mehr als geplant)
		};

		const statementResult = calculateAnnualStatementResult(annualPeriod, housingCharges);
		expect(statementResult.warnings).toHaveLength(0);

		const totalAllocated = statementResult.ownerResults.reduce((s, r) => s + r.totalAllocatedCostsCents, 0);
		expect(totalAllocated).toBe(1_260_000);

		// unit-1 (durchgehend Eigentümer A, MEA 400/1000): 40% von 12.600 € = 5.040 €.
		const unit1Result = statementResult.ownerResults.find((r) => r.unitId === "unit-1")!;
		expect(unit1Result.totalAllocatedCostsCents).toBe(504_000);
		expect(unit1Result.totalPrepaymentsCents).toBe(480_000); // 12 x 400 €
		expect(unit1Result.balanceCents).toBe(24_000); // Nachzahlung 240 €

		// unit-2: MEA 300/1000 = 30% von 12.600 € = 3.780 € Jahresgesamt,
		// taggenau aufgeteilt zwischen Eigentümer B (181 Tage) und C (184 Tage).
		const unit2Results = statementResult.ownerResults.filter((r) => r.unitId === "unit-2");
		expect(unit2Results).toHaveLength(2);
		const ownerBResult = unit2Results.find((r) => r.ownerId === "owner-b")!;
		const ownerCResult = unit2Results.find((r) => r.ownerId === "owner-c")!;
		expect(ownerBResult.ownedDays).toBe(181);
		expect(ownerCResult.ownedDays).toBe(184);
		expect(ownerBResult.totalAllocatedCostsCents + ownerCResult.totalAllocatedCostsCents).toBe(378_000);

		// Eigentümer B hat für 6 Monate (Jan-Juni) Hausgeld bezahlt (6 x 300 € = 1.800 €).
		expect(ownerBResult.totalPrepaymentsCents).toBe(180_000);
		// Eigentümer C hat für 6 Monate (Juli-Dez) Hausgeld bezahlt (6 x 300 € = 1.800 €).
		expect(ownerCResult.totalPrepaymentsCents).toBe(180_000);

		// unit-3 (durchgehend Eigentümer D, MEA 300/1000): 30% von 12.600 € = 3.780 €.
		const unit3Result = statementResult.ownerResults.find((r) => r.unitId === "unit-3")!;
		expect(unit3Result.totalAllocatedCostsCents).toBe(378_000);
		expect(unit3Result.totalPrepaymentsCents).toBe(360_000); // 12 x 300 €
		expect(unit3Result.balanceCents).toBe(18_000); // Nachzahlung 180 €

		// Summe aller Nachzahlungen/Guthaben entspricht der Differenz zwischen
		// tatsächlichen Kosten (12.600 €) und geleisteten Vorauszahlungen
		// (12 x (400+300+300) € = 12.000 €) = 600 € Gesamt-Nachzahlung.
		const totalBalance = statementResult.ownerResults.reduce((s, r) => s + r.balanceCents, 0);
		expect(totalBalance).toBe(60_000);

		// ---------- BetrKV-Brücke: unit-1 ist vermietet, nur umlagefähige Positionen werden übernommen ----------
		const unit1Lines = [
			{ costItemId: "stmt-verwaltung", label: "Verwaltervergütung", isApportionable: false, amountCents: Math.round(504_000 * (3600 / 12600)) },
			{ costItemId: "stmt-versicherung", label: "Versicherung", isApportionable: true, amountCents: Math.round(504_000 * (1200 / 12600)) },
			{ costItemId: "stmt-ruecklage", label: "Zuführung Rücklage", isApportionable: false, amountCents: Math.round(504_000 * (4800 / 12600)) },
			{ costItemId: "stmt-wasser", label: "Wasser/Abwasser", isApportionable: true, amountCents: Math.round(504_000 * (3000 / 12600)) },
		];

		const bridgedItems = buildBetrKvCostItemsFromHoaStatement(unit1Lines);
		// Nur Versicherung und Wasser sind umlagefähig - Verwaltervergütung und Rücklage werden nicht übernommen.
		expect(bridgedItems.map((i) => i.label).sort()).toEqual(["Versicherung", "Wasser/Abwasser"].sort());
		expect(bridgedItems.every((i) => i.allocationKey === "DIRECT")).toBe(true);
	});
});
