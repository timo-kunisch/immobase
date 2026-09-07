import { describe, expect, it } from "vitest";

import { calculateContestationDeadline, isContestationDeadlinePassed, nextResolutionSequenceNumber } from "@/lib/hoa-meetings";

describe("calculateContestationDeadline", () => {
	it("berechnet den fristauslösenden Tag im Folgemonat mit gleicher Tageszahl (§ 188 Abs. 2 BGB)", () => {
		const deadline = calculateContestationDeadline(new Date(2026, 4, 15)); // 15. Mai 2026
		expect(deadline.getFullYear()).toBe(2026);
		expect(deadline.getMonth()).toBe(5); // Juni (0-indiziert)
		expect(deadline.getDate()).toBe(15);
	});

	it("kappt auf den letzten Tag des Folgemonats, wenn dieser den Tag nicht hat (§ 188 Abs. 3 BGB)", () => {
		// 31. Januar 2026 -> Februar 2026 hat nur 28 Tage.
		const deadline = calculateContestationDeadline(new Date(2026, 0, 31));
		expect(deadline.getMonth()).toBe(1); // Februar
		expect(deadline.getDate()).toBe(28);
	});

	it("berücksichtigt Schaltjahre beim Kappen auf den letzten Tag des Februar", () => {
		// 31. Januar 2028 -> Februar 2028 ist ein Schaltjahr (29 Tage).
		const deadline = calculateContestationDeadline(new Date(2028, 0, 31));
		expect(deadline.getMonth()).toBe(1);
		expect(deadline.getDate()).toBe(29);
	});

	it("wechselt bei Beschlussfassung im Dezember korrekt ins nächste Jahr", () => {
		const deadline = calculateContestationDeadline(new Date(2026, 11, 20)); // 20. Dezember 2026
		expect(deadline.getFullYear()).toBe(2027);
		expect(deadline.getMonth()).toBe(0); // Januar
		expect(deadline.getDate()).toBe(20);
	});
});

describe("isContestationDeadlinePassed", () => {
	it("ist am letzten Tag der Frist selbst noch NICHT abgelaufen (Frist läuft bis Tagesende)", () => {
		const deadline = new Date(2026, 5, 15);
		expect(isContestationDeadlinePassed(deadline, new Date(2026, 5, 15, 23, 0))).toBe(false);
	});

	it("ist am Tag nach der Frist abgelaufen", () => {
		const deadline = new Date(2026, 5, 15);
		expect(isContestationDeadlinePassed(deadline, new Date(2026, 5, 16, 0, 0, 1))).toBe(true);
	});
});

describe("nextResolutionSequenceNumber", () => {
	it("startet bei 1, wenn noch kein Beschluss existiert", () => {
		expect(nextResolutionSequenceNumber([])).toBe(1);
	});

	it("liefert die höchste vorhandene Nummer + 1", () => {
		expect(nextResolutionSequenceNumber([1, 2, 5])).toBe(6);
	});
});
