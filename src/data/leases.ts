import { getDb } from "./db";
import { newId, now } from "./helpers";
import {
	mapTenant,
	mapUnitWithProperty,
	TENANT_COLUMNS,
	UNIT_PROPERTY_COLUMNS,
	type TenantJoinRow,
	type UnitPropertyJoinRow,
	type UnitWithProperty,
} from "./lease-joins";
import type { Deposit, DepositStatus, DepositType, Lease, RentAdjustment, Tenant } from "./types";

/**
 * Repository für Mietverträge (Tabelle `leases`) inkl. der zugehörigen
 * Miet-/Nebenkosten-Änderungen (`rent_adjustments`).
 *
 * Zusätzlich enthalten: die Lesezugriffe auf Einheiten (inkl. Liegenschaft)
 * und Mieter, die das Vertrags- und Finanzmodul für Listen/Filter braucht.
 * Die Tabellen gehören fachlich zu anderen Modulen (Einheiten/Mieter) - die
 * Abfragen liegen hier, weil nur diese Module sie aktuell benötigen.
 */

const LEASE_COLUMNS = `
	id, unit_id AS unitId, tenant_id AS tenantId, start_date AS startDate, end_date AS endDate,
	cold_rent AS coldRent, service_charges AS serviceCharges, number_of_occupants AS numberOfOccupants,
	deposit, notes, created_at AS createdAt, updated_at AS updatedAt
`;

const RENT_ADJUSTMENT_COLUMNS = `
	id, lease_id AS leaseId, valid_from AS validFrom, cold_rent AS coldRent,
	service_charges AS serviceCharges, notes, created_at AS createdAt, updated_at AS updatedAt
`;

/**
 * SELECT-Fragment für den Lease-Stammjoin (Einheit + Liegenschaft + Mieter
 * + optionales Kautionskonto). Tabellen-Aliase: l/u/p/t/d.
 */
const LEASE_JOIN_COLUMNS = `
	l.id, l.unit_id AS unitId, l.tenant_id AS tenantId, l.start_date AS startDate, l.end_date AS endDate,
	l.cold_rent AS coldRent, l.service_charges AS serviceCharges, l.number_of_occupants AS numberOfOccupants,
	l.deposit, l.notes, l.created_at AS createdAt, l.updated_at AS updatedAt,
	${UNIT_PROPERTY_COLUMNS},
	${TENANT_COLUMNS},
	d.id AS depositId, d.type AS depositType, d.amount AS depositAmount, d.status AS depositStatus,
	d.received_date AS depositReceivedDate, d.refunded_date AS depositRefundedDate,
	d.refunded_amount AS depositRefundedAmount, d.notes AS depositNotes,
	d.created_at AS depositCreatedAt, d.updated_at AS depositUpdatedAt
`;

/** Zeilenform der Deposit-Spalten aus dem LEFT JOIN (alles null, wenn kein Konto existiert). */
interface DepositJoinRow {
	depositId: string | null;
	depositType: DepositType | null;
	depositAmount: string | null;
	depositStatus: DepositStatus | null;
	depositReceivedDate: string | null;
	depositRefundedDate: string | null;
	depositRefundedAmount: string | null;
	depositNotes: string | null;
	depositCreatedAt: string | null;
	depositUpdatedAt: string | null;
}

interface LeaseJoinRow extends Lease, UnitPropertyJoinRow, TenantJoinRow, DepositJoinRow {}

function mapDepositJoin(row: DepositJoinRow, leaseId: string): Deposit | null {
	if (!row.depositId) return null;
	// LEFT JOIN: Sobald depositId gesetzt ist, sind auch alle NOT-NULL-Spalten
	// der deposits-Zeile gefüllt.
	return {
		id: row.depositId,
		leaseId,
		type: row.depositType as DepositType,
		amount: row.depositAmount as string,
		status: row.depositStatus as DepositStatus,
		receivedDate: row.depositReceivedDate,
		refundedDate: row.depositRefundedDate,
		refundedAmount: row.depositRefundedAmount,
		notes: row.depositNotes,
		createdAt: row.depositCreatedAt as string,
		updatedAt: row.depositUpdatedAt as string,
	};
}

function mapLeaseRow(row: LeaseJoinRow, rentAdjustments: RentAdjustment[]): LeaseWithDetails {
	return {
		id: row.id,
		unitId: row.unitId,
		tenantId: row.tenantId,
		startDate: row.startDate,
		endDate: row.endDate,
		coldRent: row.coldRent,
		serviceCharges: row.serviceCharges,
		numberOfOccupants: row.numberOfOccupants,
		deposit: row.deposit,
		notes: row.notes,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		unit: mapUnitWithProperty(row.unitId, row),
		tenant: mapTenant(row.tenantId, row),
		rentAdjustments,
		depositAccount: mapDepositJoin(row, row.id),
	};
}

/**
 * Lädt die Miet-/Nebenkosten-Änderungen für eine Menge von Verträgen in
 * einer Abfrage (chronologisch aufsteigend) und gruppiert sie je leaseId.
 */
function listRentAdjustmentsByLeaseIds(leaseIds: string[]): Map<string, RentAdjustment[]> {
	const result = new Map<string, RentAdjustment[]>();
	if (leaseIds.length === 0) return result;
	const placeholders = leaseIds.map(() => "?").join(", ");
	const rows = getDb()
		.prepare(
			`SELECT ${RENT_ADJUSTMENT_COLUMNS} FROM rent_adjustments
			 WHERE lease_id IN (${placeholders}) ORDER BY valid_from ASC`
		)
		.all(...leaseIds) as RentAdjustment[];
	for (const row of rows) {
		const list = result.get(row.leaseId) ?? [];
		list.push(row);
		result.set(row.leaseId, list);
	}
	return result;
}

// ============================================================
// Mietverträge (Lease)
// ============================================================

export interface LeaseInput {
	unitId: string;
	tenantId: string;
	startDate: string;
	endDate: string | null;
	coldRent: string;
	serviceCharges: string;
	numberOfOccupants: number;
	deposit: string | null;
	notes: string | null;
}

export interface LeaseFilter {
	leaseId?: string;
	unitId?: string;
	tenantId?: string;
}

/** Mietvertrag inkl. Einheit/Liegenschaft, Mieter, Mietverlauf und Kautionskonto. */
export interface LeaseWithDetails extends Lease {
	unit: UnitWithProperty;
	tenant: Tenant;
	rentAdjustments: RentAdjustment[];
	depositAccount: Deposit | null;
}

/**
 * Listet Mietverträge (neuester Mietbeginn zuerst) inkl. aller für die
 * Vertrags- und Finanzansicht benötigten Relationen. Filter werden
 * UND-verknüpft.
 */
export function listLeasesWithDetails(filter: LeaseFilter = {}): LeaseWithDetails[] {
	const conditions: string[] = [];
	const params: string[] = [];
	if (filter.leaseId) {
		conditions.push("l.id = ?");
		params.push(filter.leaseId);
	}
	if (filter.unitId) {
		conditions.push("l.unit_id = ?");
		params.push(filter.unitId);
	}
	if (filter.tenantId) {
		conditions.push("l.tenant_id = ?");
		params.push(filter.tenantId);
	}
	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	const rows = getDb()
		.prepare(
			`SELECT ${LEASE_JOIN_COLUMNS} FROM leases l
			 JOIN units u ON u.id = l.unit_id
			 JOIN properties p ON p.id = u.property_id
			 JOIN tenants t ON t.id = l.tenant_id
			 LEFT JOIN deposits d ON d.lease_id = l.id
			 ${where}
			 ORDER BY l.start_date DESC`
		)
		.all(...params) as LeaseJoinRow[];

	const adjustmentsByLease = listRentAdjustmentsByLeaseIds(rows.map((row) => row.id));
	return rows.map((row) => mapLeaseRow(row, adjustmentsByLease.get(row.id) ?? []));
}

/** Einzelner Mietvertrag inkl. Relationen (für Filter-Anzeigen). */
export function getLeaseWithDetails(id: string): LeaseWithDetails | null {
	return listLeasesWithDetails({ leaseId: id })[0] ?? null;
}

/** Einzelner Mietvertrag ohne Relationen (z. B. für Validierungen). */
export function getLease(id: string): Lease | null {
	const row = getDb().prepare(`SELECT ${LEASE_COLUMNS} FROM leases WHERE id = ?`).get(id) as Lease | undefined;
	return row ?? null;
}

/** Alle Mietverträge inkl. Mietverlauf (für das Fälligstellen von Zahlungen). */
export interface LeaseWithRentAdjustments extends Lease {
	rentAdjustments: RentAdjustment[];
}

export function listLeasesWithRentAdjustments(): LeaseWithRentAdjustments[] {
	const rows = getDb().prepare(`SELECT ${LEASE_COLUMNS} FROM leases ORDER BY start_date DESC`).all() as Lease[];
	const adjustmentsByLease = listRentAdjustmentsByLeaseIds(rows.map((row) => row.id));
	return rows.map((row) => ({ ...row, rentAdjustments: adjustmentsByLease.get(row.id) ?? [] }));
}

export function createLease(input: LeaseInput): Lease {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO leases (id, unit_id, tenant_id, start_date, end_date, cold_rent, service_charges, number_of_occupants, deposit, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.unitId,
			input.tenantId,
			input.startDate,
			input.endDate,
			input.coldRent,
			input.serviceCharges,
			input.numberOfOccupants,
			input.deposit,
			input.notes,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateLease(id: string, input: LeaseInput): void {
	getDb()
		.prepare(
			`UPDATE leases
			 SET unit_id = ?, tenant_id = ?, start_date = ?, end_date = ?, cold_rent = ?, service_charges = ?,
				 number_of_occupants = ?, deposit = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.unitId,
			input.tenantId,
			input.startDate,
			input.endDate,
			input.coldRent,
			input.serviceCharges,
			input.numberOfOccupants,
			input.deposit,
			input.notes,
			now(),
			id
		);
}

export function deleteLease(id: string): void {
	getDb().prepare("DELETE FROM leases WHERE id = ?").run(id);
}

// ============================================================
// Miet-/Nebenkosten-Änderungen (RentAdjustment)
// ============================================================
// Verlauf der vereinbarten Zahlungen über die Mietdauer (z. B.
// Mieterhöhungen) - Auswertung siehe src/lib/rent-history.ts.
// Einzigartigkeit (lease_id, valid_from) wird per Unique-Index
// durchgesetzt; Konflikte meldet die Server Action mit einer
// entsprechenden Fehlermeldung.

export interface RentAdjustmentInput {
	leaseId: string;
	validFrom: string;
	coldRent: string;
	serviceCharges: string;
	notes: string | null;
}

export function createRentAdjustment(input: RentAdjustmentInput): RentAdjustment {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO rent_adjustments (id, lease_id, valid_from, cold_rent, service_charges, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.leaseId, input.validFrom, input.coldRent, input.serviceCharges, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateRentAdjustment(id: string, input: RentAdjustmentInput): void {
	getDb()
		.prepare(
			`UPDATE rent_adjustments
			 SET lease_id = ?, valid_from = ?, cold_rent = ?, service_charges = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.leaseId, input.validFrom, input.coldRent, input.serviceCharges, input.notes, now(), id);
}

export function deleteRentAdjustment(id: string): void {
	getDb().prepare("DELETE FROM rent_adjustments WHERE id = ?").run(id);
}

// ============================================================
// Nachschlagen von Einheiten/Mietern (für Auswahllisten und Filter)
// ============================================================

export function listUnitsWithProperty(): UnitWithProperty[] {
	const rows = getDb()
		.prepare(
			`SELECT u.id AS unitId, ${UNIT_PROPERTY_COLUMNS}
			 FROM units u JOIN properties p ON p.id = u.property_id
			 ORDER BY u.label ASC`
		)
		.all() as (UnitPropertyJoinRow & { unitId: string })[];
	return rows.map((row) => mapUnitWithProperty(row.unitId, row));
}

export function getUnitWithProperty(id: string): UnitWithProperty | null {
	const row = getDb()
		.prepare(
			`SELECT u.id AS unitId, ${UNIT_PROPERTY_COLUMNS}
			 FROM units u JOIN properties p ON p.id = u.property_id
			 WHERE u.id = ?`
		)
		.get(id) as (UnitPropertyJoinRow & { unitId: string }) | undefined;
	return row ? mapUnitWithProperty(row.unitId, row) : null;
}

export function listTenants(): Tenant[] {
	return getDb()
		.prepare(
			`SELECT id, first_name AS firstName, last_name AS lastName, email, phone, notes,
				created_at AS createdAt, updated_at AS updatedAt
			 FROM tenants ORDER BY last_name ASC`
		)
		.all() as Tenant[];
}

export function getTenant(id: string): Tenant | null {
	const row = getDb()
		.prepare(
			`SELECT id, first_name AS firstName, last_name AS lastName, email, phone, notes,
				created_at AS createdAt, updated_at AS updatedAt
			 FROM tenants WHERE id = ?`
		)
		.get(id) as Tenant | undefined;
	return row ?? null;
}
