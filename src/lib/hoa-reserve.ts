import type { ReserveFundBookingType } from "@/data/types";
import { toCents, centsToDecimalString } from "@/lib/money";

/**
 * Berechnungslogik für die Erhaltungsrücklage (§ 19 Abs. 2 Nr. 4 WEG,
 * bis 2020 "Instandhaltungsrücklage" genannt) und den daraus abgeleiteten
 * Vermögensbericht (§ 28 Abs. 4 WEG). Reine, seiteneffektfreie Funktionen
 * (kein DB-Zugriff) - analog zu src/lib/billing.ts/hoa-allocation.ts.
 *
 * Modellierung (reserveFundBookings, siehe src/data/reserve-fund.ts): jede Buchung
 * ist entweder eine Zuführung (CONTRIBUTION, z. B. der im Wirtschaftsplan
 * vorgesehene monatliche Rücklagenanteil) oder eine Entnahme (WITHDRAWAL,
 * z. B. Bezahlung einer größeren Instandhaltungsmaßnahme aus der Rücklage)
 * - IMMER mit positivem Betrag; das Vorzeichen für die Saldoberechnung
 * ergibt sich ausschließlich aus `type`.
 *
 * Getroffene Annahme für den Vermögensbericht (§ 28 Abs. 4 WEG verlangt
 * eine Übersicht über Rücklagen UND sonstiges Vermögen/Verbindlichkeiten):
 * Diese App führt keine vollständige doppelte Buchhaltung mit Bankkonten -
 * der Vermögensbericht wird daher bewusst vereinfacht auf zwei Blöcke
 * reduziert, die aus bereits vorhandenen Daten ableitbar sind:
 *  1. Stand der Erhaltungsrücklage (aus reserveFundBookings).
 *  2. Offene Hausgeldforderungen gegenüber den Eigentümern (aus
 *     housingCharges mit status IN ("OPEN","OVERDUE")) als "sonstiges
 *     Vermögen" (Forderungen). Dieser Vermögensbericht ersetzt keine
 *     Bankbuchhaltung/Kontostand - siehe README.md für den Hinweis an den
 *     Nutzer, den tatsächlichen Bankkontostand weiterhin außerhalb der App
 *     zu führen bzw. künftig über ein eigenes Buchhaltungsmodul.
 */

type ReserveFundBookingLike = {
	bookingDate: string;
	type: ReserveFundBookingType;
	amount: string;
};

/** Saldo der Erhaltungsrücklage zu einem bestimmten Stichtag (Cent). */
export function calculateReserveFundBalanceCents(bookings: ReserveFundBookingLike[], asOf: Date = new Date()): number {
	return bookings
		.filter((booking) => new Date(booking.bookingDate) <= asOf)
		.reduce((balance, booking) => {
			const amountCents = toCents(booking.amount);
			return booking.type === "CONTRIBUTION" ? balance + amountCents : balance - amountCents;
		}, 0);
}

export type ReserveFundLedgerEntry = {
	id: string;
	bookingDate: Date;
	type: ReserveFundBookingType;
	description: string;
	amountCents: number;
	/** Vorzeichenrichtiger Saldo NACH dieser Buchung (Cent). */
	balanceCents: number;
};

type ReserveFundBookingWithDescription = ReserveFundBookingLike & { id: string; description: string };

/**
 * Baut aus den Einzelbuchungen ein chronologisch sortiertes Kontobuch mit
 * laufendem Saldo auf (für die Anzeige in der UI, siehe
 * src/app/(app)/weg/ruecklage/page.tsx). Die id der Ursprungsbuchung
 * wird durchgereicht, damit die UI Bearbeiten-/Löschen-Aktionen ohne
 * fragile Zuordnung über Datum+Bezeichnung anbieten kann.
 */
export function buildReserveFundLedger(bookings: ReserveFundBookingWithDescription[]): ReserveFundLedgerEntry[] {
	const sorted = [...bookings].sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());

	let runningBalance = 0;
	return sorted.map((booking) => {
		const amountCents = toCents(booking.amount);
		runningBalance += booking.type === "CONTRIBUTION" ? amountCents : -amountCents;
		return {
			id: booking.id,
			bookingDate: new Date(booking.bookingDate),
			type: booking.type,
			description: booking.description,
			amountCents,
			balanceCents: runningBalance,
		};
	});
}

export const reserveFundBookingTypeLabels: Record<ReserveFundBookingType, string> = {
	CONTRIBUTION: "Zuführung",
	WITHDRAWAL: "Entnahme",
};

// ============================================================
// Vermögensbericht (§ 28 Abs. 4 WEG)
// ============================================================

type OpenHousingChargeLike = {
	amount: string;
	status: "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";
};

export type HoaWealthReport = {
	reserveFundBalanceCents: number;
	reserveFundBalance: string;
	openReceivablesCents: number;
	openReceivables: string;
	/** Vereinfachtes Gesamtvermögen = Rücklage + offene Forderungen (siehe Modul-Kommentar zu den Einschränkungen). */
	totalAssetsCents: number;
	totalAssets: string;
};

/** Erstellt den (vereinfachten) Vermögensbericht zu einem Stichtag, siehe Modul-Kommentar. */
export function calculateHoaWealthReport(reserveFundBookings: ReserveFundBookingLike[], housingCharges: OpenHousingChargeLike[], asOf: Date = new Date()): HoaWealthReport {
	const reserveFundBalanceCents = calculateReserveFundBalanceCents(reserveFundBookings, asOf);
	const openReceivablesCents = housingCharges.filter((charge) => charge.status === "OPEN" || charge.status === "OVERDUE").reduce((sum, charge) => sum + toCents(charge.amount), 0);
	const totalAssetsCents = reserveFundBalanceCents + openReceivablesCents;

	return {
		reserveFundBalanceCents,
		reserveFundBalance: centsToDecimalString(reserveFundBalanceCents),
		openReceivablesCents,
		openReceivables: centsToDecimalString(openReceivablesCents),
		totalAssetsCents,
		totalAssets: centsToDecimalString(totalAssetsCents),
	};
}
