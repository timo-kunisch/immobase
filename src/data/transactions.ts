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
import type { Lease, Tenant, Transaction, TransactionStatus } from "./types";

/**
 * Repository für Mieteingänge (Tabelle `transactions`).
 */

/**
 * SELECT-Fragment für den Transaktions-Stammjoin (Vertrag + Einheit +
 * Liegenschaft + Mieter). Tabellen-Aliase: tr/l/u/p/t.
 */
const TRANSACTION_JOIN_COLUMNS = `
	tr.id, tr.lease_id AS leaseId, tr.amount, tr.due_date AS dueDate, tr.paid_date AS paidDate,
	tr.purpose, tr.status, tr.created_at AS createdAt, tr.updated_at AS updatedAt,
	l.unit_id AS leaseUnitId, l.tenant_id AS leaseTenantId, l.start_date AS leaseStartDate, l.end_date AS leaseEndDate,
	l.cold_rent AS leaseColdRent, l.service_charges AS leaseServiceCharges, l.number_of_occupants AS leaseNumberOfOccupants,
	l.deposit AS leaseDeposit, l.notes AS leaseNotes, l.created_at AS leaseCreatedAt, l.updated_at AS leaseUpdatedAt,
	${UNIT_PROPERTY_COLUMNS},
	${TENANT_COLUMNS}
`;

interface TransactionJoinRow extends Transaction, UnitPropertyJoinRow, TenantJoinRow {
	leaseUnitId: string;
	leaseTenantId: string;
	leaseStartDate: string;
	leaseEndDate: string | null;
	leaseColdRent: string;
	leaseServiceCharges: string;
	leaseNumberOfOccupants: number;
	leaseDeposit: string | null;
	leaseNotes: string | null;
	leaseCreatedAt: string;
	leaseUpdatedAt: string;
}

function mapTransactionRow(row: TransactionJoinRow): TransactionWithLease {
	return {
		id: row.id,
		leaseId: row.leaseId,
		amount: row.amount,
		dueDate: row.dueDate,
		paidDate: row.paidDate,
		purpose: row.purpose,
		status: row.status,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		lease: {
			id: row.leaseId,
			unitId: row.leaseUnitId,
			tenantId: row.leaseTenantId,
			startDate: row.leaseStartDate,
			endDate: row.leaseEndDate,
			coldRent: row.leaseColdRent,
			serviceCharges: row.leaseServiceCharges,
			numberOfOccupants: row.leaseNumberOfOccupants,
			deposit: row.leaseDeposit,
			notes: row.leaseNotes,
			createdAt: row.leaseCreatedAt,
			updatedAt: row.leaseUpdatedAt,
			tenant: mapTenant(row.leaseTenantId, row),
			unit: mapUnitWithProperty(row.leaseUnitId, row),
		},
	};
}

/** Zahlung inkl. Mietvertrag, Mieter und Einheit/Liegenschaft. */
export interface TransactionWithLease extends Transaction {
	lease: Lease & {
		tenant: Tenant;
		unit: UnitWithProperty;
	};
}

export interface TransactionInput {
	leaseId: string;
	amount: string;
	dueDate: string;
	paidDate: string | null;
	purpose: string | null;
	status: TransactionStatus;
}

/** Listet Zahlungen (neueste Fälligkeit zuerst) inkl. Vertrags-Relationen. */
export function listTransactions(filter: { leaseId?: string } = {}): TransactionWithLease[] {
	const where = filter.leaseId ? "WHERE tr.lease_id = ?" : "";
	const params = filter.leaseId ? [filter.leaseId] : [];
	const rows = getDb()
		.prepare(
			`SELECT ${TRANSACTION_JOIN_COLUMNS} FROM transactions tr
			 JOIN leases l ON l.id = tr.lease_id
			 JOIN units u ON u.id = l.unit_id
			 JOIN properties p ON p.id = u.property_id
			 JOIN tenants t ON t.id = l.tenant_id
			 ${where}
			 ORDER BY tr.due_date DESC`
		)
		.all(...params) as TransactionJoinRow[];
	return rows.map(mapTransactionRow);
}

/** Einzelne Zahlung inkl. Vertrags-Relationen (für Detailabfragen). */
export function getTransaction(id: string): TransactionWithLease | null {
	return listTransactions().find((transaction) => transaction.id === id) ?? null;
}

export function createTransaction(input: TransactionInput): Transaction {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO transactions (id, lease_id, amount, due_date, paid_date, purpose, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.leaseId, input.amount, input.dueDate, input.paidDate, input.purpose, input.status, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateTransaction(id: string, input: TransactionInput): void {
	getDb()
		.prepare(
			`UPDATE transactions
			 SET lease_id = ?, amount = ?, due_date = ?, paid_date = ?, purpose = ?, status = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.leaseId, input.amount, input.dueDate, input.paidDate, input.purpose, input.status, now(), id);
}

export function deleteTransaction(id: string): void {
	getDb().prepare("DELETE FROM transactions WHERE id = ?").run(id);
}

/** Schnellaktion: Zahlung direkt aus der Tabelle als "bezahlt" markieren. */
export function markTransactionPaid(id: string): void {
	const timestamp = now();
	getDb().prepare("UPDATE transactions SET status = 'PAID', paid_date = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, id);
}

/**
 * Eine anzulegende fällige Zahlung. Die fachliche Ermittlung (welche
 * Verträge in welchem Monat laufen, gültiger Betrag aus dem Mietverlauf)
 * erfolgt in der Server Action; das Repository übernimmt die
 * Duplikatprüfung und das atomare Anlegen.
 */
export interface DueTransactionCandidate {
	leaseId: string;
	amount: string;
	/** Fälligkeitsdatum (ISO-8601). */
	dueDate: string;
	purpose: string;
	/** Monatsgrenzen (ISO-8601, [monthStart, monthEnd)) für die Duplikatprüfung. */
	monthStart: string;
	monthEnd: string;
}

/**
 * Legt die übergebenen fälligen Zahlungen an, sofern für denselben Vertrag
 * im jeweiligen Monat noch keine Zahlung existiert. Duplikatprüfung und
 * Inserts laufen in einer better-sqlite3-Transaktion (atomar).
 */
export function generateDueTransactions(candidates: DueTransactionCandidate[]): { created: number; skipped: number } {
	const db = getDb();
	const existsStmt = db.prepare("SELECT id FROM transactions WHERE lease_id = ? AND due_date >= ? AND due_date < ? LIMIT 1");
	const insertStmt = db.prepare(
		`INSERT INTO transactions (id, lease_id, amount, due_date, paid_date, purpose, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, NULL, ?, 'OPEN', ?, ?)`
	);

	let created = 0;
	let skipped = 0;
	db.transaction(() => {
		for (const candidate of candidates) {
			if (existsStmt.get(candidate.leaseId, candidate.monthStart, candidate.monthEnd)) {
				skipped += 1;
				continue;
			}
			const timestamp = now();
			insertStmt.run(newId(), candidate.leaseId, candidate.amount, candidate.dueDate, candidate.purpose, timestamp, timestamp);
			created += 1;
		}
	})();
	return { created, skipped };
}
