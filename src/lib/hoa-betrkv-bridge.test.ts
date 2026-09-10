import { describe, expect, it } from "vitest";

import { buildBetrKvCostItemsFromHoaStatement, hoaCostCategoryDefaultApportionable } from "@/lib/hoa-betrkv-bridge";

describe("buildBetrKvCostItemsFromHoaStatement", () => {
	it("filtert nicht umlagefähige Positionen heraus (z. B. Verwaltervergütung, Rücklage)", () => {
		const items = buildBetrKvCostItemsFromHoaStatement([
			{ costItemId: "c1", label: "Wasser/Abwasser", category: "WATER_DRAINAGE", isApportionable: true, amountCents: 12000 },
			{ costItemId: "c2", label: "Verwaltervergütung", category: "ADMINISTRATOR_FEE", isApportionable: false, amountCents: 5000 },
			{ costItemId: "c3", label: "Zuführung Rücklage", category: "RESERVE_CONTRIBUTION", isApportionable: false, amountCents: 8000 },
		]);

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ label: "Wasser/Abwasser", allocationKey: "DIRECT", amount: "120.00" });
	});

	it("filtert Positionen mit Betrag 0 heraus", () => {
		const items = buildBetrKvCostItemsFromHoaStatement([{ costItemId: "c1", label: "Heizung", category: "HEATING", isApportionable: true, amountCents: 0 }]);
		expect(items).toHaveLength(0);
	});

	it("hat für jede WEG-Kostenart eine Default-Vorbelegung für isApportionable", () => {
		expect(hoaCostCategoryDefaultApportionable.RESERVE_CONTRIBUTION).toBe(false);
		expect(hoaCostCategoryDefaultApportionable.ADMINISTRATOR_FEE).toBe(false);
		expect(hoaCostCategoryDefaultApportionable.WATER_DRAINAGE).toBe(true);
		expect(hoaCostCategoryDefaultApportionable.HEATING).toBe(true);
	});
});
