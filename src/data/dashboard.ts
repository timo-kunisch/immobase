import { activeLeaseWhere } from "@/lib/lease-status";

import { getDb } from "./db";
import type { Ticket } from "./types";

/**
 * Repository für die Dashboard-Aggregationen (Startseite). Bündelt bewusst
 * alle modulübergreifenden Zähl-/Summen-Abfragen an einem Ort, statt sie
 * über die Fach-Repositories zu verteilen - Aufrufer:
 * src/app/(app)/actions/dashboard.ts.
 *
 * Die fachliche Auswertung (Leerstandsquote, aktuell gültige Miete über
 * getRentForDate, Summen) bleibt im Aufrufer - hier liegen nur die rohen
 * Zeilen/Zähler. Geldbeträge kommen als Decimal-Strings aus der DB und
 * werden (wie bisher) im Aufrufer in JS summiert.
 */

/** Zähler für die Kennzahlen-Karten der Startseite. */
export interface DashboardCounts {
	propertiesCount: number;
	unitsCount: number;
	tenantsCount: number;
	openTicketsCount: number;
	/** Anzahl unterschiedlicher Einheiten mit aktuell laufendem Mietvertrag. */
	occupiedUnitsCount: number;
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
	// property_id ist NOT NULL mit FK restrict - die Liegenschaft existiert
	// daher garantiert (kein null-Fall nötig).
	property: { id: string; name: string };
	unit: { id: string; label: string } | null;
}

/** Flache Join-Zeile aus listLatestOpenTickets (vor dem Mapping). */
interface DashboardTicketJoinRow extends Ticket {
	propertyName: string;
	unitLabel: string | null;
}

/**
 * Zählt Liegenschaften, Einheiten, Mieter, offene Tickets (OPEN/IN_PROGRESS)
 * sowie die Anzahl unterschiedlicher vermieteter Einheiten (distinct unitId
 * der aktuell laufenden Mietverträge, Stand `date`).
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
 * Die neuesten offenen Tickets (Status OPEN/IN_PROGRESS, neueste zuerst)
 * für die Liste auf der Startseite, inkl. Liegenschaftsname und Einheit.
 */
export function listLatestOpenTickets(limit = 5): DashboardTicket[] {
	const rows = getDb()
		.prepare(
			`SELECT t.id AS id, t.property_id AS propertyId, t.unit_id AS unitId,
				t.title AS title, t.description AS description, t.status AS status,
				t.contractor_notes AS contractorNotes, t.resolved_at AS resolvedAt,
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
			property: { id: row.propertyId, name: propertyName },
			unit: row.unitId && unitLabel ? { id: row.unitId, label: unitLabel } : null,
		};
	});
}
