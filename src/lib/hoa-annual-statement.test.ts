import { describe, expect, it } from "vitest";

import type { HoaAllocationPeriodInput } from "@/lib/hoa-allocation";
import {
	buildAnnualStatementConsistencyCheck,
	calculateAnnualStatementResult,
	calculatePaidPrepaymentsCents,
	type HousingChargeForStatementInput,
} from "@/lib/hoa-annual-statement";

/**
 * Unit-Tests der WEG-Jahresabrechnungs-Berechnung: tatsächlich geleistete
 * (bezahlte) Vorauszahlungen, Verteilung nach Miteigentumsanteilen (§ 16
 * Abs. 2 WEG), taggenaue Eigentümerwechsel, Rücklagen-Zuführung als normale
 * Kostenposition sowie die Plausibilitätsprüfung Gesamt-/Einzelabrechnung
 * vs. Wirtschaftsplan.
 */

const yearFrom = new Date(2026, 0, 1);
const yearTo = new Date(2026, 11, 31);

function buildPeriod(overrides?: Partial<HoaAllocationPeriodInput>): HoaAllocationPeriodInput {
	return {
		periodFrom: yearFrom,
		periodTo: yearTo,
		units: [
			{
				id: "unit-1",
				livingSpace: 60,
				coOwnershipShare: 400,
				ownerships: [{ id: "own-1", ownerId: "owner-a", startDate: "2020-01-01", endDate: null }],
			},
			{
				id: "unit-2",
				livingSpace: 40,
				coOwnershipShare: 600,
				ownerships: [{ id: "own-2", ownerId: "owner-b", startDate: "2020-01-01", endDate: null }],
			},
		],
		costItems: [
			{ id: "cost-1", amount: "1000.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] },
		],
		...overrides,
	};
}

describe("calculatePaidPrepaymentsCents", () => {
	const charges: HousingChargeForStatementInput[] = [
		{ unitId: "unit-1", ownerId: "owner-a", amount: "300.00", dueDate: "2026-01-03", status: "PAID" },
		{ unitId: "unit-1", ownerId: "owner-a", amount: "300.00", dueDate: "2026-02-03", status: "OPEN" },
		{ unitId: "unit-1", ownerId: "owner-a", amount: "300.00", dueDate: "2026-03-03", status: "OVERDUE" },
		{ unitId: "unit-1", ownerId: "owner-a", amount: "300.00", dueDate: "2026-04-03", status: "CANCELLED" },
		{ unitId: "unit-1", ownerId: "owner-a", amount: "300.00", dueDate: "2027-01-03", status: "PAID" },
		{ unitId: "unit-1", ownerId: "owner-b", amount: "300.00", dueDate: "2026-05-03", status: "PAID" },
	];

	it("zählt NUR bezahlte Sollstellungen des Eigentümers im Zeitanteil - der Wirtschaftsplan-Soll wird nicht blind angesetzt", () => {
		const result = calculatePaidPrepaymentsCents(charges, "unit-1", "owner-a", yearFrom, yearTo);
		// Nur die erste PAID-Zeile liegt bei unit-1/owner-a im Zeitraum;
		// OPEN/OVERDUE/CANCELLED zählen nicht, andere Eigentümer nicht,
		// Fälligkeit außerhalb des Zeitanteils nicht.
		expect(result.totalCents).toBe(30_000);
		expect(result.paidCount).toBe(1);
	});

	it("liefert für gemischte Kreise je Eigentümer getrennte Summen", () => {
		const resultB = calculatePaidPrepaymentsCents(charges, "unit-1", "owner-b", yearFrom, yearTo);
		expect(resultB.totalCents).toBe(30_000);
		expect(resultB.paidCount).toBe(1);
	});
});

describe("calculateAnnualStatementResult", () => {
	it("verteilt nach Miteigentumsanteilen (§ 16 Abs. 2 WEG) und rechnet nur bezahlte Vorauszahlungen an", () => {
		const charges: HousingChargeForStatementInput[] = [
			// owner-a zahlt 10 Monate (Jan-Okt), die letzten 2 bleiben offen.
			...Array.from({ length: 10 }, (_, month) => ({
				unitId: "unit-1",
				ownerId: "owner-a",
				amount: "100.00",
				dueDate: new Date(2026, month, 3).toISOString(),
				status: "PAID" as const,
			})),
			{ unitId: "unit-1", ownerId: "owner-a", amount: "100.00", dueDate: new Date(2026, 11, 3).toISOString(), status: "OPEN" },
			// owner-b zahlt vollständig (12 Monate).
			...Array.from({ length: 12 }, (_, month) => ({
				unitId: "unit-2",
				ownerId: "owner-b",
				amount: "150.00",
				dueDate: new Date(2026, month, 3).toISOString(),
				status: "PAID" as const,
			})),
		];

		const result = calculateAnnualStatementResult(buildPeriod(), charges);

		// MEA 400/1000 von 1.000 € = 400 € für unit-1, 600 € für unit-2.
		const resultA = result.ownerResults.find((r) => r.ownerId === "owner-a")!;
		const resultB = result.ownerResults.find((r) => r.ownerId === "owner-b")!;
		expect(resultA.totalAllocatedCostsCents).toBe(40_000);
		expect(resultB.totalAllocatedCostsCents).toBe(60_000);

		// owner-a: nur 10 x 100 € geleistet -> Guthaben von 600 €;
		// die offenen Monate verfälschen das Ergebnis NICHT.
		expect(resultA.totalPrepaymentsCents).toBe(100_000);
		expect(resultA.paidPrepaymentCount).toBe(10);
		expect(resultA.balanceCents).toBe(40_000 - 100_000);

		// owner-b: 12 x 150 € = 1.800 € geleistet -> Guthaben von 1.200 €.
		expect(resultB.totalPrepaymentsCents).toBe(180_000);
		expect(resultB.paidPrepaymentCount).toBe(12);
		expect(resultB.balanceCents).toBe(60_000 - 180_000);
	});

	it("weist bei 0 geleisteten Vorauszahlungen paidPrepaymentCount = 0 aus (UI-Warnhinweis)", () => {
		const result = calculateAnnualStatementResult(buildPeriod(), []);
		for (const ownerResult of result.ownerResults) {
			expect(ownerResult.paidPrepaymentCount).toBe(0);
			expect(ownerResult.totalPrepaymentsCents).toBe(0);
		}
	});

	it("verteilt bei unterjährigem Eigentümerwechsel taggenau auf alte und neue Eigentümer", () => {
		const period = buildPeriod({
			units: [
				{
					id: "unit-1",
					livingSpace: 60,
					coOwnershipShare: 1000,
					ownerships: [
						{ id: "own-old", ownerId: "owner-old", startDate: "2020-01-01", endDate: "2026-06-30" },
						{ id: "own-new", ownerId: "owner-new", startDate: "2026-07-01", endDate: null },
					],
				},
			],
		});

		const result = calculateAnnualStatementResult(period, []);
		expect(result.ownerResults).toHaveLength(2);

		const oldResult = result.ownerResults.find((r) => r.ownerId === "owner-old")!;
		const newResult = result.ownerResults.find((r) => r.ownerId === "owner-new")!;
		// 181 Tage (H1 2026) vs. 184 Tage (H2 2026), Summe = 1.000 €.
		expect(oldResult.ownedDays).toBe(181);
		expect(newResult.ownedDays).toBe(184);
		expect(oldResult.totalAllocatedCostsCents + newResult.totalAllocatedCostsCents).toBe(100_000);
	});

	it("behandelt die Rücklagen-Zuführung als ganz normale (umlagefähige) Kostenposition", () => {
		const period = buildPeriod({
			costItems: [{ id: "ruecklage", amount: "1200.00", allocationKey: "MEA", directUnitId: null, consumptionValues: [], customAllocationWeights: [] }],
		});
		const result = calculateAnnualStatementResult(period, []);
		// Die Zuführung wird wie jede andere Position nach MEA umgelegt und
		// mindert über die geleisteten Vorauszahlungen die Abrechnungsspitze -
		// Entnahmen laufen ausschließlich über das Rücklagen-Kontobuch.
		const resultA = result.ownerResults.find((r) => r.ownerId === "owner-a")!;
		expect(resultA.lines).toHaveLength(1);
		expect(resultA.lines[0].costItemId).toBe("ruecklage");
		expect(resultA.totalAllocatedCostsCents).toBe(48_000);
	});
});

describe("buildAnnualStatementConsistencyCheck", () => {
	it("meldet keine Hinweise, wenn Einzelabrechnungen, Wirtschaftsplan und Hausgeld zusammenpassen", () => {
		const charges: HousingChargeForStatementInput[] = [
			...Array.from({ length: 12 }, (_, month) => ({
				unitId: "unit-1",
				ownerId: "owner-a",
				amount: "100.00",
				dueDate: new Date(2026, month, 3).toISOString(),
				status: "PAID" as const,
			})),
			...Array.from({ length: 12 }, (_, month) => ({
				unitId: "unit-2",
				ownerId: "owner-b",
				amount: "150.00",
				dueDate: new Date(2026, month, 3).toISOString(),
				status: "PAID" as const,
			})),
		];
		const result = calculateAnnualStatementResult(buildPeriod(), charges);

		const issues = buildAnnualStatementConsistencyCheck({
			periodFrom: yearFrom,
			periodTo: yearTo,
			costItemsTotalCents: 100_000,
			result,
			economicPlans: [{ id: "plan-1", fiscalYearFrom: "2026-01-01", fiscalYearTo: "2026-12-31", status: "FINALIZED", plannedTotalCents: 100_000 }],
			housingCharges: charges,
		});

		expect(issues).toHaveLength(0);
	});

	it("meldet Differenzen zwischen Gesamtabrechnung und Summe der Einzelabrechnungen (UNASSIGNED_COSTS)", () => {
		const result = calculateAnnualStatementResult(buildPeriod(), []);
		const issues = buildAnnualStatementConsistencyCheck({
			periodFrom: yearFrom,
			periodTo: yearTo,
			costItemsTotalCents: 100_001, // bewusst 1 Cent mehr als verteilt wird
			result,
			economicPlans: [],
			housingCharges: [],
		});

		const unassigned = issues.find((issue) => issue.type === "UNASSIGNED_COSTS");
		expect(unassigned).toBeDefined();
		expect(unassigned!.type === "UNASSIGNED_COSTS" ? unassigned!.differenceCents : 0).toBe(1);
	});

	it("meldet Abweichungen vom finalisierten Wirtschaftsplan des überlappenden Geschäftsjahrs (PLAN_DEVIATION)", () => {
		const result = calculateAnnualStatementResult(buildPeriod(), []);
		const issues = buildAnnualStatementConsistencyCheck({
			periodFrom: yearFrom,
			periodTo: yearTo,
			costItemsTotalCents: 100_000,
			result,
			economicPlans: [{ id: "plan-1", fiscalYearFrom: "2026-01-01", fiscalYearTo: "2026-12-31", status: "FINALIZED", plannedTotalCents: 90_000 }],
			housingCharges: [],
		});

		const deviation = issues.find((issue) => issue.type === "PLAN_DEVIATION");
		expect(deviation).toBeDefined();
		// Entwürfe überlappender Pläne und nicht überlappende Geschäftsjahre
		// bleiben für den Abgleich außer Betracht.
		expect(issues.some((issue) => issue.type === "NO_ECONOMIC_PLAN")).toBe(false);
	});

	it("ignoriert nicht überlappende und nicht finalisierte Wirtschaftspläne für den Plan-Abgleich", () => {
		const result = calculateAnnualStatementResult(buildPeriod(), []);
		const issues = buildAnnualStatementConsistencyCheck({
			periodFrom: yearFrom,
			periodTo: yearTo,
			costItemsTotalCents: 100_000,
			result,
			economicPlans: [
				{ id: "plan-2025", fiscalYearFrom: "2025-01-01", fiscalYearTo: "2025-12-31", status: "FINALIZED", plannedTotalCents: 50_000 },
				{ id: "plan-draft", fiscalYearFrom: "2026-01-01", fiscalYearTo: "2026-12-31", status: "DRAFT", plannedTotalCents: 50_000 },
			],
			housingCharges: [],
		});

		expect(issues.some((issue) => issue.type === "PLAN_DEVIATION")).toBe(false);
		expect(issues.some((issue) => issue.type === "NO_ECONOMIC_PLAN")).toBe(true);
	});

	it("macht offene Hausgeld-Rückstände sichtbar, ohne sie als Vorauszahlung zu zählen", () => {
		const charges: HousingChargeForStatementInput[] = [
			{ unitId: "unit-1", ownerId: "owner-a", amount: "100.00", dueDate: "2026-01-03", status: "PAID" },
			{ unitId: "unit-1", ownerId: "owner-a", amount: "100.00", dueDate: "2026-02-03", status: "OPEN" },
			{ unitId: "unit-1", ownerId: "owner-a", amount: "50.00", dueDate: "2026-03-03", status: "OVERDUE" },
			{ unitId: "unit-1", ownerId: "owner-a", amount: "100.00", dueDate: "2027-03-03", status: "OPEN" },
		];
		const result = calculateAnnualStatementResult(buildPeriod(), charges);

		const issues = buildAnnualStatementConsistencyCheck({
			periodFrom: yearFrom,
			periodTo: yearTo,
			costItemsTotalCents: 100_000,
			result,
			economicPlans: [],
			housingCharges: charges,
		});

		const arrears = issues.find((issue) => issue.type === "HOUSING_CHARGE_ARREARS");
		expect(arrears).toBeDefined();
		if (arrears!.type === "HOUSING_CHARGE_ARREARS") {
			expect(arrears.openCount).toBe(2); // die 2027er Fälligkeit liegt außerhalb
			expect(arrears.openTotalCents).toBe(15_000);
		}
		// Die offenen Beträge sind NICHT in die Vorauszahlungen eingeflossen:
		const resultA = result.ownerResults.find((r) => r.ownerId === "owner-a")!;
		expect(resultA.totalPrepaymentsCents).toBe(10_000);
	});
});