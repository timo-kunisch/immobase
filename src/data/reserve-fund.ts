import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Hoa, HousingChargeStatus, ReserveFundBooking, ReserveFundBookingType } from "./types";

/**
 * Repository für die Erhaltungsrücklage (Tabelle `reserve_fund_bookings`).
 * Konventionen siehe src/data/properties.ts.
 *
 * Der Vermögensbericht (§ 28 Abs. 4 WEG) wird NICHT gespeichert, sondern
 * aus den Buchungen und den offenen Hausgeldforderungen berechnet (siehe
 * src/lib/hoa-reserve.ts) - dieses Repository liefert dafür mit
 * listHousingChargeAmountsForHoa das benötigte domänenübergreifende
 * Lesefragment (housing_charges der Einheiten der WEG-Liegenschaft).
 */

const RESERVE_FUND_BOOKING_COLUMNS = `
	id, hoa_id AS hoaId, booking_date AS bookingDate, type, amount, description, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const HOA_COLUMNS = `
	id, property_id AS propertyId, name, total_shares AS totalShares,
	bank_iban AS bankIban, bank_bic AS bankBic, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

// ============================================================
// Querschnitts-Lesefragmente (WEG-Stammdaten)
// ============================================================

/** Alle WEGs, alphabetisch sortiert (für den HoaFilter auf den WEG-Seiten). */
export function listHoasSortedByName(): Hoa[] {
	return getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas ORDER BY name`).all() as Hoa[];
}

export function getHoa(id: string): Hoa | null {
	const row = getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas WHERE id = ?`).get(id) as Hoa | undefined;
	return row ?? null;
}

/**
 * Betrag und Status aller Hausgeld-Sollstellungen der Einheiten der
 * WEG-Liegenschaft - Grundlage für die "offenen Hausgeldforderungen" im
 * vereinfachten Vermögensbericht (src/lib/hoa-reserve.ts filtert selbst
 * nach status OPEN/OVERDUE, daher werden hier bewusst ALLE Status
 * geliefert).
 */
export function listHousingChargeAmountsForHoa(hoaId: string): { amount: string; status: HousingChargeStatus }[] {
	return getDb()
		.prepare(
			`SELECT c.amount, c.status
			 FROM housing_charges c
			 JOIN units u ON u.id = c.unit_id
			 JOIN hoas h ON h.property_id = u.property_id
			 WHERE h.id = ?`
		)
		.all(hoaId) as { amount: string; status: HousingChargeStatus }[];
}

// ============================================================
// Buchungen der Erhaltungsrücklage (ReserveFundBooking)
// ============================================================

export interface ReserveFundBookingInput {
	hoaId: string;
	bookingDate: string;
	type: ReserveFundBookingType;
	/** Immer positiver Betrag - das Vorzeichen ergibt sich aus `type`. */
	amount: string;
	description: string;
	notes: string | null;
}

export function listReserveFundBookings(hoaId: string): ReserveFundBooking[] {
	return getDb()
		.prepare(`SELECT ${RESERVE_FUND_BOOKING_COLUMNS} FROM reserve_fund_bookings WHERE hoa_id = ? ORDER BY booking_date DESC`)
		.all(hoaId) as ReserveFundBooking[];
}

export function createReserveFundBooking(input: ReserveFundBookingInput): ReserveFundBooking {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO reserve_fund_bookings (id, hoa_id, booking_date, type, amount, description, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.hoaId, input.bookingDate, input.type, input.amount, input.description, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateReserveFundBooking(id: string, input: ReserveFundBookingInput): void {
	getDb()
		.prepare(
			`UPDATE reserve_fund_bookings
			 SET hoa_id = ?, booking_date = ?, type = ?, amount = ?, description = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.hoaId, input.bookingDate, input.type, input.amount, input.description, input.notes, now(), id);
}

export function deleteReserveFundBooking(id: string): void {
	getDb().prepare("DELETE FROM reserve_fund_bookings WHERE id = ?").run(id);
}
