import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { Account } from "./types";

/**
 * Repository für die Konten der Buchhaltung (Tabelle `accounts`) - der
 * liegenschaftsbezogene Kontenrahmen (z. B. "Gebäudeversicherung"), auf den
 * Banktransaktionen gebucht werden (siehe src/data/bank-transactions.ts).
 * Konventionen siehe src/data/properties.ts.
 */

const ACCOUNT_COLUMNS = `
	id, property_id AS propertyId, label, notes, created_at AS createdAt, updated_at AS updatedAt
`;

export interface AccountInput {
	propertyId: string;
	label: string;
	notes: string | null;
}

/** Konto inkl. abgeleiteter Buchungs-Statistik (Listenansicht /buchhaltung). */
export interface AccountWithStats extends Account {
	/** Summe der auf das Konto gebuchten Teilbeträge (signed wie die Banktransaktionen). */
	allocatedAmount: string;
	/** Anzahl der Buchungszeilen auf dieses Konto. */
	bookingCount: number;
}

/** Alle Konten einer Liegenschaft inkl. Buchungs-Summe/-Anzahl (ein einziger Grouped-Join). */
export function listAccountsWithStats(propertyId: string): AccountWithStats[] {
	const rows = getDb()
		.prepare(
			`SELECT a.id, a.property_id AS propertyId, a.label, a.notes,
			 		a.created_at AS createdAt, a.updated_at AS updatedAt,
			 		COALESCE(SUM(bta.amount), 0) AS allocatedAmount,
			 		COUNT(bta.id) AS bookingCount
			 FROM accounts a
			 LEFT JOIN bank_transaction_allocations bta ON bta.account_id = a.id
			 WHERE a.property_id = ?
			 GROUP BY a.id, a.property_id, a.label, a.notes, a.created_at, a.updated_at
			 ORDER BY a.label`
		)
		.all(propertyId) as (Account & { allocatedAmount: number | string; bookingCount: number })[];
	return rows.map((row) => ({
		...row,
		// SUM über TEXT-Geldspalten liefert REAL/Integer - auf Decimal-String
		// normieren (Cent-genau reicht für die Anzeige, gebucht wird exakt).
		allocatedAmount: Number(row.allocatedAmount).toFixed(2),
		bookingCount: Number(row.bookingCount),
	}));
}

export function getAccount(id: string): Account | null {
	const row = getDb().prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`).get(id) as Account | undefined;
	return row ?? null;
}

export function createAccount(input: AccountInput): Account {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO accounts (id, property_id, label, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.propertyId, input.label, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

/** Aktualisiert Bezeichnung/Notizen (propertyId eines Kontos ist unveränderlich). */
export function updateAccount(id: string, input: { label: string; notes: string | null }): void {
	getDb().prepare("UPDATE accounts SET label = ?, notes = ?, updated_at = ? WHERE id = ?").run(input.label, input.notes, now(), id);
}

/**
 * Löscht ein Konto. Seine Buchungszeilen werden per ON DELETE CASCADE der
 * Datenbank mitentfernt (die Banktransaktionen verlieren die Zuordnung);
 * die fachliche Sperre "Konto mit Buchungen nicht löschbar" liegt in der
 * Server Action / dem MCP-Werkzeug (Guard countAllocationsForAccount).
 */
export function deleteAccount(id: string): void {
	getDb().prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

/** Anzahl Buchungszeilen auf ein Konto (Guard gegen das Löschen bebuchter Konten). */
export function countAllocationsForAccount(accountId: string): number {
	const row = getDb()
		.prepare("SELECT COUNT(*) AS value FROM bank_transaction_allocations WHERE account_id = ?")
		.get(accountId) as { value: number };
	return row.value;
}
