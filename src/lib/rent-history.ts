/**
 * Zentrale Auswertungslogik für den Miet-/Nebenkosten-Verlauf eines
 * Mietvertrags. Ein Lease hat immer einen Basiswert (coldRent/serviceCharges,
 * gültig ab startDate) und optional beliebig viele spätere Änderungen
 * (RentAdjustment, jeweils gültig ab einem eigenen Datum). Diese Datei
 * kapselt sämtliche Logik, um daraus
 *  - den zu einem bestimmten Datum gültigen Betrag,
 *  - die vollständige, chronologisch sortierte Historie sowie
 *  - die jeweiligen Gültigkeitszeiträume (validFrom/validUntil)
 * abzuleiten. Wird u. a. im Vertrags-, Finanzen- und Dashboard-Modul
 * verwendet, damit überall dieselbe Regel gilt.
 */

export type RentPeriod = {
	validFrom: Date;
	/** Exklusives Enddatum (Beginn der nächsten Periode) oder null, falls aktuell gültig. */
	validUntil: Date | null;
	coldRent: number;
	serviceCharges: number;
	/** Notiz der zugrunde liegenden Änderung (nur bei validFrom > lease.startDate). */
	notes: string | null;
	/** Id der zugrunde liegenden RentAdjustment (fehlt bei der ursprünglichen Vertragsperiode). */
	adjustmentId: string | null;
};

type LeaseRentFields = {
	startDate: string;
	coldRent: string;
	serviceCharges: string;
};

type RentAdjustmentFields = {
	id: string;
	validFrom: string;
	coldRent: string;
	serviceCharges: string;
	notes: string | null;
};

/**
 * Baut aus dem Lease-Basiswert und den RentAdjustments eine chronologisch
 * sortierte Liste aller Gültigkeitszeiträume auf ("gültig von ... bis ...").
 */
export function buildRentHistory(lease: LeaseRentFields, adjustments: RentAdjustmentFields[]): RentPeriod[] {
	const sortedAdjustments = [...adjustments].sort(
		(a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
	);

	const periods: Omit<RentPeriod, "validUntil">[] = [
		{
			validFrom: new Date(lease.startDate),
			coldRent: Number(lease.coldRent),
			serviceCharges: Number(lease.serviceCharges),
			notes: null,
			adjustmentId: null,
		},
		...sortedAdjustments.map((adjustment) => ({
			validFrom: new Date(adjustment.validFrom),
			coldRent: Number(adjustment.coldRent),
			serviceCharges: Number(adjustment.serviceCharges),
			notes: adjustment.notes,
			adjustmentId: adjustment.id,
		})),
	];

	return periods.map((period, index) => ({
		...period,
		validUntil: periods[index + 1]?.validFrom ?? null,
	}));
}

/**
 * Ermittelt die zu einem bestimmten Datum (Standard: jetzt) gültige
 * Kaltmiete + Nebenkosten für einen Mietvertrag. Liegt das Datum vor
 * Vertragsbeginn, wird trotzdem der Basiswert zurückgegeben (es gibt keine
 * "davor"-Periode).
 */
export function getRentForDate(
	lease: LeaseRentFields,
	adjustments: RentAdjustmentFields[],
	date: Date = new Date()
): { coldRent: number; serviceCharges: number } {
	const history = buildRentHistory(lease, adjustments);

	// Rückwärts suchen: die letzte Periode, deren validFrom <= date ist.
	let current = history[0];
	for (const period of history) {
		if (period.validFrom.getTime() <= date.getTime()) {
			current = period;
		} else {
			break;
		}
	}

	return { coldRent: current.coldRent, serviceCharges: current.serviceCharges };
}

/** Gesamtmiete (Kalt + NK) zu einem bestimmten Datum, siehe getRentForDate. */
export function getTotalRentForDate(
	lease: LeaseRentFields,
	adjustments: RentAdjustmentFields[],
	date: Date = new Date()
): number {
	const { coldRent, serviceCharges } = getRentForDate(lease, adjustments, date);
	return coldRent + serviceCharges;
}
