import { activeLeaseWhere } from "@/lib/lease-status";

import { getDb } from "./db";
import type { ReserveFundBookingType, Ticket } from "./types";

/**
 * Repository für die Dashboard-Aggregationen (Startseite). Bündelt bewusst
 * alle modulübergreifenden Zähl-/Summen-Abfragen an einem Ort, statt sie
 * über die Fach-Repositories zu verteilen - Aufrufer:
 * src/app/(app)/actions/dashboard.ts.
 *
 * Das Dashboard bildet ALLE Fachbereiche ab (allgemeine Stammdaten,
 * Mietverwaltung, WEG-Verwaltung) - daher liegen hier auch die WEG-Zähler
 * und -Summen. Die fachliche Auswertung (Leerstandsquote, aktuell gültige
 * Miete über getRentForDate, Summen) bleibt im Aufrufer - hier liegen nur
 * die rohen Zeilen/Zähler. Geldbeträge kommen als Decimal-Strings aus der
 * DB und werden (wie bisher) im Aufrufer in JS summiert.
 */

/** Zähler für die Kennzahlen-Karten der Startseite. */
export interface DashboardCounts {
	propertiesCount: number;
	unitsCount: number;
	tenantsCount: number;
	openTicketsCount: number;
	/** Anzahl unterschiedlicher Einheiten mit aktuell laufendem Mietvertrag. */
	occupiedUnitsCount: number;
	/** Anzahl aktuell laufender Mietverträge (Stand `date`). */
	activeLeasesCount: number;
	/** Nebenkostenabrechnungs-Perioden im Entwurf (noch nicht finalisiert). */
	draftBillingPeriodsCount: number;
	/** WEGs (Wohnungseigentümergemeinschaften). */
	hoasCount: number;
	/** Eigentümer der WEG-Verwaltung. */
	ownersCount: number;
	/** Wirtschaftspläne im Entwurf (noch nicht finalisiert). */
	draftEconomicPlansCount: number;
	/** WEG-Jahresabrechnungen im Entwurf (noch nicht finalisiert). */
	draftAnnualStatementsCount: number;
	/** Aktive Dokumente im DMS (hochgeladene Dokumente + erzeugte Schreiben, ohne Papierkorb). */
	documentsCount: number;
}

/** Flache Join-Zeile für listActiveLeasesForRent (Tabelle `leases`). */
interface LeaseRentRow {
	id: string;
	startDate: string;
	coldRent: string;
	serviceCharges: string;
}

/** RentAdjustment-Teilmenge, wie sie getRentForDate benötigt. */
export interface DashboardRentAdjustment {
	id: string;
	validFrom: string;
	coldRent: string;
	serviceCharges: string;
	notes: string | null;
}

/** Aktuell laufender Mietvertrag inkl. aller Mietanpassungen. */
export interface DashboardActiveLease {
	startDate: string;
	coldRent: string;
	serviceCharges: string;
	rentAdjustments: DashboardRentAdjustment[];
}

/** Offenes Ticket inkl. verknüpfter Liegenschaft und (optionaler) Einheit. */
export interface DashboardTicket extends Ticket {
	// Liegenschaft ist optional (Ticket ohne Objektbezug) - property ist
	// daher null, wenn kein property_id gesetzt ist.
	property: { id: string; name: string } | null;
	unit: { id: string; label: string } | null;
}

/** Flache Join-Zeile aus listLatestOpenTickets (vor dem Mapping). */
interface DashboardTicketJoinRow extends Ticket {
	propertyName: string | null;
	unitLabel: string | null;
}

/**
 * Zählt Liegenschaften, Einheiten, Mieter, offene Tickets (OPEN/IN_PROGRESS)
 * sowie die Anzahl unterschiedlicher vermieteter Einheiten (distinct unitId
 * der aktuell laufenden Mietverträge, Stand `date`) - dazu die Zähler der
 * übrigen Fachbereiche: laufende Mietverträge, Abrechnungs-Entwürfe und die
 * WEG-Verwaltung (WEGs, Eigentümer, Plan-/Abrechnungs-Entwürfe) sowie die
 * aktiven Dokumente des DMS.
 */
export function getDashboardCounts(date: Date): DashboardCounts {
	const db = getDb();
	const count = (sql: string, ...params: string[]): number =>
		(db.prepare(sql).get(...params) as { value: number }).value;

	const active = activeLeaseWhere(date);

	return {
		propertiesCount: count("SELECT COUNT(*) AS value FROM properties"),
		unitsCount: count("SELECT COUNT(*) AS value FROM units"),
		tenantsCount: count("SELECT COUNT(*) AS value FROM tenants"),
		openTicketsCount: count("SELECT COUNT(*) AS value FROM tickets WHERE status IN ('OPEN', 'IN_PROGRESS')"),
		occupiedUnitsCount: count(
			`SELECT COUNT(*) AS value FROM (SELECT unit_id FROM leases WHERE ${active.sql} GROUP BY unit_id)`,
			...active.params
		),
		activeLeasesCount: count(`SELECT COUNT(*) AS value FROM leases WHERE ${active.sql}`, ...active.params),
		draftBillingPeriodsCount: count("SELECT COUNT(*) AS value FROM billing_periods WHERE status = 'DRAFT'"),
		hoasCount: count("SELECT COUNT(*) AS value FROM hoas"),
		ownersCount: count("SELECT COUNT(*) AS value FROM owners"),
		draftEconomicPlansCount: count("SELECT COUNT(*) AS value FROM economic_plans WHERE status = 'DRAFT'"),
		draftAnnualStatementsCount: count("SELECT COUNT(*) AS value FROM annual_statements WHERE status = 'DRAFT'"),
		documentsCount:
			count("SELECT COUNT(*) AS value FROM documents WHERE deleted_at IS NULL") +
			count("SELECT COUNT(*) AS value FROM generated_documents WHERE deleted_at IS NULL"),
	};
}

/**
 * Alle aktuell laufenden Mietverträge (Stand `date`) mit ihren
 * Mietanpassungen - Grundlage für die Summe der aktuell gültigen
 * Kaltmieten/Nebenkosten (getRentForDate im Aufrufer).
 */
export function listActiveLeasesForRent(date: Date): DashboardActiveLease[] {
	const db = getDb();
	const active = activeLeaseWhere(date);

	const leaseRows = db
		.prepare(
			`SELECT id, start_date AS startDate, cold_rent AS coldRent, service_charges AS serviceCharges
			 FROM leases
			 WHERE ${active.sql}`
		)
		.all(...active.params) as LeaseRentRow[];

	if (leaseRows.length === 0) return [];

	const placeholders = leaseRows.map(() => "?").join(", ");
	const adjustmentRows = db
		.prepare(
			`SELECT id, lease_id AS leaseId, valid_from AS validFrom,
				cold_rent AS coldRent, service_charges AS serviceCharges, notes
			 FROM rent_adjustments
			 WHERE lease_id IN (${placeholders})`
		)
		.all(...leaseRows.map((row) => row.id)) as (DashboardRentAdjustment & { leaseId: string })[];

	const adjustmentsByLeaseId = new Map<string, DashboardRentAdjustment[]>();
	for (const row of adjustmentRows) {
		const { leaseId, ...adjustment } = row;
		const list = adjustmentsByLeaseId.get(leaseId);
		if (list) {
			list.push(adjustment);
		} else {
			adjustmentsByLeaseId.set(leaseId, [adjustment]);
		}
	}

	return leaseRows.map((row) => ({
		startDate: row.startDate,
		coldRent: row.coldRent,
		serviceCharges: row.serviceCharges,
		rentAdjustments: adjustmentsByLeaseId.get(row.id) ?? [],
	}));
}

/**
 * Offene Restbeträge (Decimal-Strings) aller fälligen/überfälligen
 * Mieteingänge (Status OPEN/OVERDUE, Fälligkeit <= `date`). Bereits
 * zugeordnete Teilzahlungen aus der Buchhaltung (Buchungszeilen gegen die
 * Sollstellung) werden abgezogen - analog zu
 * listOpenTransactionArrearAmounts in transactions.ts. Die Summe wird
 * bewusst im Aufrufer gebildet (bisheriges Verhalten: Number()-Addition
 * in JS).
 */
export function listRentArrearAmounts(date: Date): string[] {
	const rows = getDb()
		.prepare(
			`SELECT tr.amount,
					COALESCE((SELECT SUM(a.amount) FROM bank_transaction_allocations a WHERE a.transaction_id = tr.id), 0) AS allocated
			 FROM transactions tr WHERE tr.status IN ('OPEN', 'OVERDUE') AND tr.due_date <= ?`
		)
		.all(date.toISOString()) as { amount: string; allocated: string | number }[];
	const remainders: string[] = [];
	for (const row of rows) {
		const remainderCents = Math.round(Number(row.amount) * 100) - Math.round(Number(row.allocated) * 100);
		if (remainderCents > 0) remainders.push((remainderCents / 100).toFixed(2));
	}
	return remainders;
}

/**
 * Offene Hausgeld-Rückstände (Decimal-Strings) über ALLE WEGs: volle
 * Beträge der fälligen/überfälligen Hausgeld-Sollstellungen (Status
 * OPEN/OVERDUE, Fälligkeit <= `date`) - identisch zur Rückstands-Karte auf
 * /weg/hausgeld (dort ohne Teilzahlungs-Abzug: eine Sollstellung gilt erst
 * bei vollständiger Zuordnung als bezahlt, siehe bank-transactions.ts).
 * Die Summe wird im Aufrufer gebildet.
 */
export function listHousingChargeArrearAmounts(date: Date): string[] {
	const rows = getDb()
		.prepare("SELECT amount FROM housing_charges WHERE status IN ('OPEN', 'OVERDUE') AND due_date <= ?")
		.all(date.toISOString()) as { amount: string }[];
	return rows.map((row) => row.amount);
}

/** Rücklagenbuchungs-Teilmenge, wie sie calculateReserveFundBalanceCents benötigt. */
export interface DashboardReserveFundBooking {
	bookingDate: string;
	type: ReserveFundBookingType;
	amount: string;
}

/**
 * Alle Rücklagenbuchungen aller WEGs (unsortiert) - Grundlage für den
 * Gesamt-Saldo der Erhaltungsrücklagen auf der Startseite. Die Berechnung
 * (Vorzeichen je Buchungsart, Stichtag) läuft im Aufrufer über
 * calculateReserveFundBalanceCents (src/lib/hoa-reserve.ts) - das gleiche
 * Muster wie auf /weg/ruecklage.
 */
export function listAllReserveFundBookings(): DashboardReserveFundBooking[] {
	return getDb()
		.prepare("SELECT booking_date AS bookingDate, type, amount FROM reserve_fund_bookings")
		.all() as DashboardReserveFundBooking[];
}

/**
 * Die neuesten offenen Tickets (Status OPEN/IN_PROGRESS, neueste zuerst)
 * für die Liste auf der Startseite, inkl. Liegenschaftsname und Einheit.
 */
export function listLatestOpenTickets(limit = 5): DashboardTicket[] {
	const rows = getDb()
		.prepare(
			`SELECT t.id AS id, t.property_id AS propertyId, t.unit_id AS unitId,
				t.title AS title, t.description AS description, t.status AS status,
				t.resolved_at AS resolvedAt,
				t.created_at AS createdAt, t.updated_at AS updatedAt,
				p.name AS propertyName, u.label AS unitLabel
			 FROM tickets t
			 LEFT JOIN properties p ON t.property_id = p.id
			 LEFT JOIN units u ON t.unit_id = u.id
			 WHERE t.status IN ('OPEN', 'IN_PROGRESS')
			 ORDER BY t.created_at DESC
			 LIMIT ?`
		)
		.all(limit) as DashboardTicketJoinRow[];

	return rows.map((row) => {
		const { propertyName, unitLabel, ...ticket } = row;
		return {
			...ticket,
			property: row.propertyId && propertyName ? { id: row.propertyId, name: propertyName } : null,
			unit: row.unitId && unitLabel ? { id: row.unitId, label: unitLabel } : null,
		};
	});
}
