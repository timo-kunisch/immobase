import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Deposit, DepositStatus, DepositType } from "./types";

/**
 * Repository für Kautionskonten (Tabelle `deposits`).
 *
 * deposits.lease_id ist UNIQUE: Pro Mietvertrag existiert genau ein
 * Kautionskonto. Das Speichern aus dem Formular ist daher ein Upsert
 * (ON CONFLICT (lease_id) DO UPDATE).
 */

const DEPOSIT_COLUMNS = `
	id, lease_id AS leaseId, type, amount, status, received_date AS receivedDate,
	refunded_date AS refundedDate, refunded_amount AS refundedAmount, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface DepositInput {
	leaseId: string;
	type: DepositType;
	amount: string;
	status: DepositStatus;
	receivedDate: string | null;
	refundedDate: string | null;
	refundedAmount: string | null;
	notes: string | null;
}

export function getDepositByLeaseId(leaseId: string): Deposit | null {
	const row = getDb().prepare(`SELECT ${DEPOSIT_COLUMNS} FROM deposits WHERE lease_id = ?`).get(leaseId) as Deposit | undefined;
	return row ?? null;
}

/**
 * Legt das Kautionskonto zu einem Mietvertrag an bzw. aktualisiert es
 * (Upsert über den Unique-Index auf lease_id). Gibt die aktuelle Zeile
 * zurück.
 */
export function upsertDepositForLease(input: DepositInput): Deposit {
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO deposits (id, lease_id, type, amount, status, received_date, refunded_date, refunded_amount, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(lease_id) DO UPDATE SET
				type = excluded.type, amount = excluded.amount, status = excluded.status,
				received_date = excluded.received_date, refunded_date = excluded.refunded_date,
				refunded_amount = excluded.refunded_amount, notes = excluded.notes,
				updated_at = excluded.updated_at`
		)
		.run(
			newId(),
			input.leaseId,
			input.type,
			input.amount,
			input.status,
			input.receivedDate,
			input.refundedDate,
			input.refundedAmount,
			input.notes,
			timestamp,
			timestamp
		);
	// Der Upsert liefert je nach Pfad Insert oder Update - die Zeile erneut
	// lesen, um in beiden Fällen das vollständige Objekt zurückzugeben.
	return getDepositByLeaseId(input.leaseId) as Deposit;
}
