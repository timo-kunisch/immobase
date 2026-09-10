import type { Migration } from "../migrate.ts";

/**
 * Buchhaltung (einfache, liegenschaftsbezogene Kontenführung):
 *
 * - `accounts`: Kontenrahmen je Liegenschaft (z. B. "Gebäudeversicherung") -
 *   Ziel der Zuordnung (Buchung) von Banktransaktionen.
 * - `bank_transactions`: Tatsächliche Bewegungen auf dem Bankkonto der
 *   Liegenschaft (Betrag signed: positiv = Eingang/Gutschrift, negativ =
 *   Ausgang/Belastung).
 * - `bank_transaction_allocations`: Buchungszeilen, die einen Teilbetrag
 *   einer Banktransaktion entweder auf ein Konto (account_id) oder gegen
 *   eine fällige Sollstellung (transaction_id, "Mieteingänge") buchen.
 *   Eine Sollstellung gilt mit vollständiger Zuordnung als bezahlt
 *   (Status PAID inkl. paid_date aus dem Buchungsdatum, gepflegt im
 *   Repository src/data/bank-transactions.ts).
 *
 * Genau EINES von account_id/transaction_id ist je Buchungszeile gesetzt
 * (anwendungsseitig geprüft, Konvention: keine DB-CHECK-Constraints).
 * FK-Kaskaden: Liegenschafts-Löschung räumt die komplette Buchhaltung der
 * Liegenschaft mit weg; Konten-Löschen nimmt ihre Buchungszeilen mit
 * (fachlicher Guard "Konto mit Buchungen nicht löschbar" liegt in Action/MCP).
 */
export const migration0011: Migration = {
	version: 11,
	name: "bank_accounts",
	up: `
CREATE TABLE accounts (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	label text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX accounts_property_id_idx ON accounts (property_id);

CREATE TABLE bank_transactions (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	booking_date text NOT NULL,
	amount text NOT NULL,
	description text NOT NULL,
	partner text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX bank_transactions_property_id_idx ON bank_transactions (property_id);
CREATE INDEX bank_transactions_booking_date_idx ON bank_transactions (booking_date);

CREATE TABLE bank_transaction_allocations (
	id text PRIMARY KEY NOT NULL,
	bank_transaction_id text NOT NULL,
	account_id text,
	transaction_id text,
	amount text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX bank_transaction_allocations_bank_transaction_id_idx ON bank_transaction_allocations (bank_transaction_id);
CREATE INDEX bank_transaction_allocations_account_id_idx ON bank_transaction_allocations (account_id);
CREATE INDEX bank_transaction_allocations_transaction_id_idx ON bank_transaction_allocations (transaction_id);
`,
	down: `
DROP TABLE IF EXISTS bank_transaction_allocations;
DROP TABLE IF EXISTS bank_transactions;
DROP TABLE IF EXISTS accounts;
`,
};
