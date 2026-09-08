import { describe, expect, it } from "vitest";

import { buildPageNumbers, resolvePagination } from "./pagination";

describe("resolvePagination", () => {
	it("liefert Seite 1 ohne Parameter", () => {
		const state = resolvePagination(undefined, 120);
		expect(state).toEqual({ page: 1, totalPages: 3, totalItems: 120, limit: 50, offset: 0 });
	});

	it("berechnet Offset/Limit für Folgeseiten", () => {
		const state = resolvePagination("2", 120);
		expect(state.page).toBe(2);
		expect(state.offset).toBe(50);
		expect(state.limit).toBe(50);
	});

	it("behandelt leere Listen als genau eine Seite", () => {
		const state = resolvePagination(undefined, 0);
		expect(state).toEqual({ page: 1, totalPages: 1, totalItems: 0, limit: 50, offset: 0 });
	});

	it("clampt ungültige und zu große Seitenwerte", () => {
		expect(resolvePagination("abc", 120).page).toBe(1);
		expect(resolvePagination("0", 120).page).toBe(1);
		expect(resolvePagination("-5", 120).page).toBe(1);
		// Zu große Werte (z. B. nach Löschung von Einträgen) -> letzte Seite.
		expect(resolvePagination("99", 120).page).toBe(3);
	});

	it("rundet die Gesamtseitenzahl korrekt auf", () => {
		expect(resolvePagination(undefined, 50).totalPages).toBe(1);
		expect(resolvePagination(undefined, 51).totalPages).toBe(2);
	});
});

describe("buildPageNumbers", () => {
	it("listet kurze Seitenzahlen vollständig", () => {
		expect(buildPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
		expect(buildPageNumbers(1, 1)).toEqual([1]);
	});

	it("kürzt lange Listen am Anfang mit Ellipsis hinten", () => {
		expect(buildPageNumbers(1, 20)).toEqual([1, 2, "ellipsis", 20]);
	});

	it("kürzt lange Listen in der Mitte beidseitig", () => {
		expect(buildPageNumbers(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
	});

	it("kürzt lange Listen am Ende mit Ellipsis vorne", () => {
		expect(buildPageNumbers(20, 20)).toEqual([1, "ellipsis", 19, 20]);
	});
});
