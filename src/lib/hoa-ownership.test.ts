import { describe, expect, it } from "vitest";

import { findOwnershipForDate, getOwnershipStatus } from "@/lib/hoa-ownership";

describe("getOwnershipStatus", () => {
	it("liefert UPCOMING, wenn der Beginn in der Zukunft liegt", () => {
		const status = getOwnershipStatus({ startDate: "2030-01-01T00:00:00.000Z", endDate: null }, new Date("2026-01-01T00:00:00.000Z"));
		expect(status).toBe("UPCOMING");
	});

	it("liefert ENDED, wenn das Ende in der Vergangenheit liegt", () => {
		const status = getOwnershipStatus({ startDate: "2020-01-01T00:00:00.000Z", endDate: "2021-01-01T00:00:00.000Z" }, new Date("2026-01-01T00:00:00.000Z"));
		expect(status).toBe("ENDED");
	});

	it("liefert ACTIVE, wenn das Datum zwischen Beginn und Ende liegt", () => {
		const status = getOwnershipStatus({ startDate: "2020-01-01T00:00:00.000Z", endDate: null }, new Date("2026-01-01T00:00:00.000Z"));
		expect(status).toBe("ACTIVE");
	});
});

describe("findOwnershipForDate", () => {
	const ownerships = [
		{ id: "o1", startDate: "2020-01-01T00:00:00.000Z", endDate: "2026-06-30T00:00:00.000Z" },
		{ id: "o2", startDate: "2026-07-01T00:00:00.000Z", endDate: null },
	];

	it("findet das vor dem Wechsel gültige Eigentumsverhältnis", () => {
		const result = findOwnershipForDate(ownerships, new Date("2026-03-15T00:00:00.000Z"));
		expect(result?.id).toBe("o1");
	});

	it("findet das nach dem Wechsel gültige Eigentumsverhältnis (am Stichtag selbst)", () => {
		const result = findOwnershipForDate(ownerships, new Date("2026-07-01T00:00:00.000Z"));
		expect(result?.id).toBe("o2");
	});

	it("liefert null, wenn kein Eigentumsverhältnis das Datum abdeckt", () => {
		const result = findOwnershipForDate(ownerships, new Date("2010-01-01T00:00:00.000Z"));
		expect(result).toBeNull();
	});
});
