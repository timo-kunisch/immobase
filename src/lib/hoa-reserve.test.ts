import { describe, expect, it } from "vitest";

import { buildReserveFundLedger, calculateHoaWealthReport, calculateReserveFundBalanceCents } from "@/lib/hoa-reserve";

describe("calculateReserveFundBalanceCents", () => {
	it("summiert Zuführungen und subtrahiert Entnahmen", () => {
		const balance = calculateReserveFundBalanceCents([
			{ bookingDate: "2026-01-01", type: "CONTRIBUTION", amount: "1000.00" },
			{ bookingDate: "2026-02-01", type: "CONTRIBUTION", amount: "500.00" },
			{ bookingDate: "2026-03-01", type: "WITHDRAWAL", amount: "300.00" },
		]);
		expect(balance).toBe(120000);
	});

	it("berücksichtigt nur Buchungen bis zum Stichtag", () => {
		const balance = calculateReserveFundBalanceCents(
			[
				{ bookingDate: "2026-01-01", type: "CONTRIBUTION", amount: "1000.00" },
				{ bookingDate: "2026-06-01", type: "CONTRIBUTION", amount: "500.00" },
			],
			new Date("2026-03-01")
		);
		expect(balance).toBe(100000);
	});
});

describe("buildReserveFundLedger", () => {
	it("liefert einen chronologisch sortierten laufenden Saldo", () => {
		const ledger = buildReserveFundLedger([
			{ id: "b2", bookingDate: "2026-02-01", type: "WITHDRAWAL", amount: "200.00", description: "Reparatur" },
			{ id: "b1", bookingDate: "2026-01-01", type: "CONTRIBUTION", amount: "1000.00", description: "Zuführung Januar" },
		]);

		expect(ledger.map((e) => e.description)).toEqual(["Zuführung Januar", "Reparatur"]);
		expect(ledger.map((e) => e.id)).toEqual(["b1", "b2"]);
		expect(ledger[0].balanceCents).toBe(100000);
		expect(ledger[1].balanceCents).toBe(80000);
	});
});

describe("calculateHoaWealthReport", () => {
	it("addiert Rücklagenstand und offene Forderungen zum vereinfachten Gesamtvermögen", () => {
		const report = calculateHoaWealthReport(
			[{ bookingDate: "2026-01-01", type: "CONTRIBUTION", amount: "5000.00" }],
			[
				{ amount: "300.00", status: "OPEN" },
				{ amount: "150.00", status: "OVERDUE" },
				{ amount: "999.00", status: "PAID" },
				{ amount: "50.00", status: "CANCELLED" },
			]
		);

		expect(report.reserveFundBalance).toBe("5000.00");
		expect(report.openReceivables).toBe("450.00");
		expect(report.totalAssets).toBe("5450.00");
	});
});
