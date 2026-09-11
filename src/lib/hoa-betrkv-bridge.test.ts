import { describe, expect, it } from "vitest";

import { buildBetrKvCostItemsFromHoaStatement } from "@/lib/hoa-betrkv-bridge";

describe("buildBetrKvCostItemsFromHoaStatement", () => {
	it("filtert nicht umlagefähige Positionen heraus (z. B. Verwaltervergütung, Rücklage)", () => {
		const items = buildBetrKvCostItemsFromHoaStatement([
			{ costItemId: "c1", label: "Wasser/Abwasser", isApportionable: true, amountCents: 12000 },
			{ costItemId: "c2", label: "Verwaltervergütung", isApportionable: false, amountCents: 5000 },
			{ costItemId: "c3", label: "Zuführung Rücklage", isApportionable: false, amountCents: 8000 },
		]);

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ label: "Wasser/Abwasser", allocationKey: "DIRECT", amount: "120.00" });
	});

	it("filtert Positionen mit Betrag 0 heraus", () => {
		const items = buildBetrKvCostItemsFromHoaStatement([{ costItemId: "c1", label: "Heizung", isApportionable: true, amountCents: 0 }]);
		expect(items).toHaveLength(0);
	});

	it("entscheidet die Umlagefähigkeit ausschließlich über das isApportionable-Flag (keine Kategorie mehr)", () => {
		// Die frühere Kostenart-Kategorie (inkl. Default-Matrix) ist entfallen -
		// auch eine position mit klassisch "nicht umlagefähiger" Bezeichnung
		// wird übernommen, wenn das Flag explizit gesetzt ist (und umgekehrt).
		const items = buildBetrKvCostItemsFromHoaStatement([
			{ costItemId: "c1", label: "Rechtsberatung Betriebskostenstreit", isApportionable: true, amountCents: 4000 },
			{ costItemId: "c2", label: "Wasser/Abwasser", isApportionable: false, amountCents: 12000 },
		]);

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ label: "Rechtsberatung Betriebskostenstreit", amount: "40.00" });
	});
});