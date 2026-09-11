import { describe, expect, it } from "vitest";

import { buildPageNumbers } from "./pagination";

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
