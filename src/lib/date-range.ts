/**
 * Generische Datums-/Zeitraum-Hilfsfunktionen, die sowohl von der
 * Nebenkostenabrechnung (src/lib/billing.ts) als auch von der
 * WEG-Verwaltung (src/lib/hoa-*.ts) verwendet werden - z. B. für die
 * taggenaue Aufteilung von Kosten bei einem Mieter- bzw. Eigentümerwechsel
 * innerhalb eines Abrechnungszeitraums. Bewusst in einer eigenen,
 * domänenneutralen Datei statt in billing.ts belassen, damit die
 * WEG-Module nicht aus einer nach der Mietverwaltung benannten Datei
 * importieren müssen.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function atMidnight(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Anzahl der Kalendertage zwischen zwei Daten, beide Enden inklusive. */
export function daysBetweenInclusive(from: Date, to: Date): number {
	const diff = atMidnight(to).getTime() - atMidnight(from).getTime();
	return Math.round(diff / MS_PER_DAY) + 1;
}

/** Schnittmenge zweier Zeiträume (inklusive), oder null falls keine Überlappung. */
export function overlapRange(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): { from: Date; to: Date } | null {
	const from = aFrom > bFrom ? aFrom : bFrom;
	const to = aTo < bTo ? aTo : bTo;
	if (from > to) return null;
	return { from, to };
}

/** Anzahl der Tage im Kalendermonat des übergebenen Datums. */
export function daysInMonth(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
