import { describe, expect, it } from "vitest";

import { calculateHoaAllocationResult, type HoaAllocationPeriodInput } from "@/lib/hoa-allocation";

describe("calculateHoaAllocationResult", () => {
	it("verteilt nach MEA und summiert exakt zum Gesamtbetrag (Rundungsausgleich)", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [
				{ id: "u1", livingSpace: 60, coOwnershipShare: 333, ownerships: [{ id: "o1", ownerId: "owner-1", startDate: "2020-01-01", endDate: null }] },
				{ id: "u2", livingSpace: 60, coOwnershipShare: 333, ownerships: [{ id: "o2", ownerId: "owner-2", startDate: "2020-01-01", endDate: null }] },
				{ id: "u3", livingSpace: 60, coOwnershipShare: 334, ownerships: [{ id: "o3", ownerId: "owner-3", startDate: "2020-01-01", endDate: null }] },
			],
			costItems: [{ id: "c1", amount: "100.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] }],
		};

		const result = calculateHoaAllocationResult(period);
		const totalCents = result.ownerResults.reduce((sum, r) => sum + r.totalAllocatedCostsCents, 0);
		expect(totalCents).toBe(10000);
		expect(result.warnings).toHaveLength(0);
	});

	it("verteilt bei einem unterjährigen Eigentümerwechsel zum 1. Juli taggenau zwischen altem und neuem Eigentümer", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [
				{
					id: "u1",
					livingSpace: 100,
					coOwnershipShare: 1000,
					ownerships: [
						{ id: "o-old", ownerId: "owner-old", startDate: "2020-01-01", endDate: "2026-06-30" },
						{ id: "o-new", ownerId: "owner-new", startDate: "2026-07-01", endDate: null },
					],
				},
			],
			costItems: [{ id: "c1", amount: "365.00", allocationKey: "UNITS", directUnitId: null, consumptionValues: [], customAllocationWeights: [] }],
		};

		const result = calculateHoaAllocationResult(period);
		expect(result.ownerResults).toHaveLength(2);

		const oldOwnerResult = result.ownerResults.find((r) => r.ownerId === "owner-old")!;
		const newOwnerResult = result.ownerResults.find((r) => r.ownerId === "owner-new")!;

		// 2026 ist kein Schaltjahr: Jan-Juni = 181 Tage, Juli-Dez = 184 Tage, Summe 365.
		expect(oldOwnerResult.ownedDays).toBe(181);
		expect(newOwnerResult.ownedDays).toBe(184);
		expect(oldOwnerResult.totalAllocatedCostsCents + newOwnerResult.totalAllocatedCostsCents).toBe(36500);
		// 365 Euro / 365 Tage = 1 Euro/Tag => exakt 181/184 Euro, keine Rundung nötig.
		expect(oldOwnerResult.totalAllocatedCostsCents).toBe(18100);
		expect(newOwnerResult.totalAllocatedCostsCents).toBe(18400);
	});

	it("lässt Tage ohne erfasstes Eigentumsverhältnis unzugeordnet (Datenlücke), analog zum Leerstand in der Nebenkostenabrechnung", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [
				{
					id: "u1",
					livingSpace: 100,
					coOwnershipShare: 1000,
					ownerships: [{ id: "o1", ownerId: "owner-1", startDate: "2026-07-01", endDate: null }],
				},
			],
			costItems: [{ id: "c1", amount: "365.00", allocationKey: "UNITS", directUnitId: null, consumptionValues: [], customAllocationWeights: [] }],
		};

		const result = calculateHoaAllocationResult(period);
		expect(result.ownerResults).toHaveLength(1);
		// Nur der Zeitanteil ab 1. Juli (184 Tage) wird zugeordnet, der Rest (Jan-Juni) bleibt unzugeordnet.
		expect(result.ownerResults[0].totalAllocatedCostsCents).toBe(18400);
	});

	it("verteilt nach Verbrauchswerten (CONSUMPTION)", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [
				{ id: "u1", livingSpace: 50, coOwnershipShare: 500, ownerships: [{ id: "o1", ownerId: "owner-1", startDate: "2020-01-01", endDate: null }] },
				{ id: "u2", livingSpace: 50, coOwnershipShare: 500, ownerships: [{ id: "o2", ownerId: "owner-2", startDate: "2020-01-01", endDate: null }] },
			],
			costItems: [
				{
					id: "c1",
					amount: "300.00",
					allocationKey: "CONSUMPTION",
					directUnitId: null,
					consumptionValues: [
						{ unitId: "u1", value: "100" },
						{ unitId: "u2", value: "200" },
					],
					customAllocationWeights: [],
				},
			],
		};

		const result = calculateHoaAllocationResult(period);
		const u1Result = result.ownerResults.find((r) => r.unitId === "u1")!;
		const u2Result = result.ownerResults.find((r) => r.unitId === "u2")!;
		expect(u1Result.totalAllocatedCostsCents).toBe(10000);
		expect(u2Result.totalAllocatedCostsCents).toBe(20000);
	});

	it("verteilt nach einem frei definierten Schlüssel (CUSTOM)", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [
				{ id: "u1", livingSpace: 50, coOwnershipShare: 500, ownerships: [{ id: "o1", ownerId: "owner-1", startDate: "2020-01-01", endDate: null }] },
				{ id: "u2", livingSpace: 50, coOwnershipShare: 500, ownerships: [{ id: "o2", ownerId: "owner-2", startDate: "2020-01-01", endDate: null }] },
			],
			costItems: [
				{
					id: "c1",
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
		};

		const result = calculateHoaAllocationResult(period);
		const u1Result = result.ownerResults.find((r) => r.unitId === "u1")!;
		const u2Result = result.ownerResults.find((r) => r.unitId === "u2")!;
		expect(u1Result.totalAllocatedCostsCents).toBe(2500);
		expect(u2Result.totalAllocatedCostsCents).toBe(7500);
	});

	it("meldet eine Warnung, wenn für eine Kostenposition keine Verteilungsgrundlage vorliegt", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [{ id: "u1", livingSpace: null, coOwnershipShare: null, ownerships: [{ id: "o1", ownerId: "owner-1", startDate: "2020-01-01", endDate: null }] }],
			costItems: [{ id: "c1", amount: "100.00", allocationKey: "LIVING_SPACE", directUnitId: null, consumptionValues: [], customAllocationWeights: [] }],
		};

		const result = calculateHoaAllocationResult(period);
		expect(result.warnings).toEqual([{ costItemId: "c1", reason: "NO_ALLOCATION_BASIS" }]);
		expect(result.ownerResults[0].totalAllocatedCostsCents).toBe(0);
	});

	it("verteilt nach direkter Zuordnung (DIRECT) ausschließlich auf die angegebene Einheit", () => {
		const period: HoaAllocationPeriodInput = {
			periodFrom: new Date("2026-01-01"),
			periodTo: new Date("2026-12-31"),
			units: [
				{ id: "u1", livingSpace: 50, coOwnershipShare: 500, ownerships: [{ id: "o1", ownerId: "owner-1", startDate: "2020-01-01", endDate: null }] },
				{ id: "u2", livingSpace: 50, coOwnershipShare: 500, ownerships: [{ id: "o2", ownerId: "owner-2", startDate: "2020-01-01", endDate: null }] },
			],
			costItems: [{ id: "c1", amount: "50.00", allocationKey: "DIRECT", directUnitId: "u2", consumptionValues: [], customAllocationWeights: [] }],
		};

		const result = calculateHoaAllocationResult(period);
		const u1Result = result.ownerResults.find((r) => r.unitId === "u1")!;
		const u2Result = result.ownerResults.find((r) => r.unitId === "u2")!;
		expect(u1Result.totalAllocatedCostsCents).toBe(0);
		expect(u2Result.totalAllocatedCostsCents).toBe(5000);
	});
});
