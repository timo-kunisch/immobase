import { describe, expect, it } from "vitest";

import { calculateEconomicPlanResult, type EconomicPlanInput } from "@/lib/hoa-economic-plan";

describe("calculateEconomicPlanResult", () => {
	it("verteilt nach MEA und die Summe der Jahresbeträge entspricht exakt dem Gesamtbetrag", () => {
		const plan: EconomicPlanInput = {
			fiscalYearFrom: new Date(2026, 0, 1),
			fiscalYearTo: new Date(2026, 11, 31),
			units: [
				{ id: "u1", livingSpace: 60, coOwnershipShare: 333 },
				{ id: "u2", livingSpace: 60, coOwnershipShare: 333 },
				{ id: "u3", livingSpace: 60, coOwnershipShare: 334 },
			],
			costItems: [{ id: "c1", amount: "10000.00", allocationKey: "MEA", directUnitId: null, customAllocationWeights: [] }],
		};

		const result = calculateEconomicPlanResult(plan);
		const totalCents = result.unitShares.reduce((sum, s) => sum + s.annualAmountCents, 0);
		expect(totalCents).toBe(1000000);
		expect(result.warnings).toHaveLength(0);
	});

	it("berechnet einen Monatsbetrag, der (bis auf Rundung) 1/12 des Jahresbetrags entspricht", () => {
		const plan: EconomicPlanInput = {
			fiscalYearFrom: new Date(2026, 0, 1),
			fiscalYearTo: new Date(2026, 11, 31),
			units: [{ id: "u1", livingSpace: 100, coOwnershipShare: 1000 }],
			costItems: [{ id: "c1", amount: "1200.00", allocationKey: "UNITS", directUnitId: null, customAllocationWeights: [] }],
		};

		const result = calculateEconomicPlanResult(plan);
		expect(result.unitShares[0].annualAmount).toBe("1200.00");
		expect(result.unitShares[0].monthlyAmount).toBe("100.00");
	});

	it("meldet eine Warnung für CONSUMPTION (im Wirtschaftsplan nicht anwendbar)", () => {
		const plan: EconomicPlanInput = {
			fiscalYearFrom: new Date(2026, 0, 1),
			fiscalYearTo: new Date(2026, 11, 31),
			units: [{ id: "u1", livingSpace: 100, coOwnershipShare: 1000 }],
			costItems: [{ id: "c1", amount: "100.00", allocationKey: "CONSUMPTION", directUnitId: null, customAllocationWeights: [] }],
		};

		const result = calculateEconomicPlanResult(plan);
		expect(result.warnings).toEqual([{ costItemId: "c1", reason: "NO_ALLOCATION_BASIS" }]);
	});
});
