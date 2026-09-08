/**
 * Geldbeträge werden in der Datenbank ausschließlich als Decimal-String
 * (z. B. "12.34", "-5.00") in TEXT-Spalten gespeichert
 * - SQLite hat keinen exakten Decimal-Typ, ein REAL/FLOAT würde
 * Rundungsfehler riskieren. Diese Datei kapselt die Umrechnung zwischen
 * Decimal-String (DB) und Integer-Cent (Rechnen) an einer zentralen Stelle,
 * damit nirgends im Code direkt mit Float-Beträgen gerechnet wird.
 */

type DecimalLike = { toString(): string } | string | number | null | undefined;

/** Wandelt einen Decimal-String/Number-Betrag (Euro) in ganze Cent (Integer) um. */
export function toCents(value: DecimalLike): number {
	if (value === null || value === undefined) return 0;
	const numeric = typeof value === "number" ? value : Number(value.toString());
	if (Number.isNaN(numeric)) return 0;
	return Math.round(numeric * 100);
}

/** Wandelt ganze Cent zurück in einen Decimal-String (z. B. "12.34") für die DB. */
export function centsToDecimalString(cents: number): string {
	const roundedCents = Math.round(cents);
	const sign = roundedCents < 0 ? "-" : "";
	const abs = Math.abs(roundedCents);
	const euros = Math.floor(abs / 100);
	const rest = abs % 100;
	return `${sign}${euros}.${rest.toString().padStart(2, "0")}`;
}

/**
 * Verteilt einen Gesamtbetrag (in Cent) exakt auf mehrere Gewichte, sodass
 * die Summe der Teilbeträge immer genau dem Gesamtbetrag entspricht - keine
 * Rundungsdrift durch viele Einzelrundungen (Methode des größten Rests /
 * Hamilton-Verfahren). Negative oder ungültige Gewichte werden wie 0
 * behandelt. Ist die Gewichtssumme 0, erhält jede Position 0.
 */
export function distributeCents(totalCents: number, weights: number[]): number[] {
	const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
	const totalWeight = safeWeights.reduce((sum, w) => sum + w, 0);

	if (totalWeight <= 0 || totalCents === 0) {
		return safeWeights.map(() => 0);
	}

	const rawShares = safeWeights.map((w) => (totalCents * w) / totalWeight);
	const flooredShares = rawShares.map((share) => Math.floor(share));
	const distributed = flooredShares.reduce((sum, v) => sum + v, 0);
	let remainder = totalCents - distributed;

	const order = rawShares
		.map((share, index) => ({ index, fraction: share - Math.floor(share) }))
		.sort((a, b) => b.fraction - a.fraction);

	const result = [...flooredShares];
	for (let i = 0; i < order.length && remainder > 0; i += 1) {
		result[order[i].index] += 1;
		remainder -= 1;
	}

	return result;
}
