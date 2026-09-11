import type { Migration } from "../migrate.ts";

/**
 * WEG-Jahresabrechnung: Angleichung an die überarbeitete Nebenkostenabrechnung
 * der Mietverwaltung.
 *
 * - `bank_transaction_allocations.housing_charge_id`: Buchungszeilen können
 *   ihren Teilbetrag statt auf ein Konto (account_id) oder eine Miet-Sollstellung
 *   (transaction_id) auch auf eine HAUSGELD-Sollstellung der WEG-Verwaltung
 *   buchen (Genau eines der drei Ziele je Zeile, anwendungsseitig geprüft).
 *   Vollständig zugeordnete Hausgeld-Sollstellungen gelten damit automatisch
 *   als bezahlt (PAID inkl. paid_date aus dem Buchungsdatum, gepflegt in
 *   src/data/bank-transactions.ts) - die Jahresabrechnung berücksichtigt
 *   ausschließlich tatsächlich geleistete Vorauszahlungen. Die Buchungskreise
 *   Miete (transactions) und WEG (housing_charges) bleiben getrennt: Jede
 *   Buchungszeile zielt auf genau einen Kreis, Miete-Buchungen berühren nie
 *   den Hausgeld-Status und umgekehrt.
 * - `hoa_cost_items.category` (Kostenart) entfällt - exakt wie `cost_items.category`
 *   in Migration 0010 für die Mietverwaltung: Die Bezeichnung (label) trägt die
 *   fachliche Information selbst, die Kategorie war nur noch eine redundante
 *   Zusatzauswahl (die Default-Vorbelegung für isApportionable läuft seitdem
 *   über eine explizite Nutzerentscheidung im Formular).
 *
 * Das Down baut beide Tabellen neu (SQLite verweigert DROP COLUMN auf Spalten
 * einer FK-Definition); die Kostenart wird dabei pauschal mit "OTHER"
 * wiederhergestellt (bewusst akzeptierter Downgrade-Verlust, Muster wie 0010).
 */
export const migration0013: Migration = {
	version: 13,
	name: "hoa_statement_banking",
	up: `
		ALTER TABLE bank_transaction_allocations
			ADD COLUMN housing_charge_id text REFERENCES housing_charges(id) ON UPDATE no action ON DELETE cascade;
		CREATE INDEX bank_transaction_allocations_housing_charge_id_idx ON bank_transaction_allocations (housing_charge_id);

		ALTER TABLE hoa_cost_items DROP COLUMN category;
	`,
	down: `
		DROP INDEX IF EXISTS bank_transaction_allocations_housing_charge_id_idx;

		-- Tabellen-Neubau statt DROP COLUMN: SQLite verweigert DROP COLUMN auf
		-- der Spalte einer FK-Definition (Muster wie in 0010_rental_custom_allocation_keys).
		PRAGMA foreign_keys = OFF;
		CREATE TABLE bank_transaction_allocations_migration13_restore (
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
		INSERT INTO bank_transaction_allocations_migration13_restore (id, bank_transaction_id, account_id, transaction_id, amount, created_at, updated_at)
			SELECT id, bank_transaction_id, account_id, transaction_id, amount, created_at, updated_at FROM bank_transaction_allocations;
		DROP TABLE bank_transaction_allocations;
		ALTER TABLE bank_transaction_allocations_migration13_restore RENAME TO bank_transaction_allocations;
		CREATE INDEX bank_transaction_allocations_bank_transaction_id_idx ON bank_transaction_allocations (bank_transaction_id);
		CREATE INDEX bank_transaction_allocations_account_id_idx ON bank_transaction_allocations (account_id);
		CREATE INDEX bank_transaction_allocations_transaction_id_idx ON bank_transaction_allocations (transaction_id);

		CREATE TABLE hoa_cost_items_migration13_restore (
			id text PRIMARY KEY NOT NULL,
			context text NOT NULL,
			economic_plan_id text,
			annual_statement_id text,
			category text DEFAULT 'OTHER' NOT NULL,
			label text NOT NULL,
			amount text NOT NULL,
			allocation_key text NOT NULL,
			direct_unit_id text,
			custom_allocation_key_id text,
			is_apportionable integer DEFAULT 1 NOT NULL,
			notes text,
			created_at text NOT NULL,
			updated_at text NOT NULL,
			FOREIGN KEY (economic_plan_id) REFERENCES economic_plans(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (annual_statement_id) REFERENCES annual_statements(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (direct_unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null,
			FOREIGN KEY (custom_allocation_key_id) REFERENCES hoa_custom_allocation_keys(id) ON UPDATE no action ON DELETE set null
		);
		INSERT INTO hoa_cost_items_migration13_restore
			(id, context, economic_plan_id, annual_statement_id, category, label, amount, allocation_key, direct_unit_id, custom_allocation_key_id, is_apportionable, notes, created_at, updated_at)
			SELECT id, context, economic_plan_id, annual_statement_id, 'OTHER', label, amount, allocation_key, direct_unit_id, custom_allocation_key_id, is_apportionable, notes, created_at, updated_at
			FROM hoa_cost_items;
		DROP TABLE hoa_cost_items;
		ALTER TABLE hoa_cost_items_migration13_restore RENAME TO hoa_cost_items;
		CREATE INDEX hoa_cost_items_economic_plan_id_idx ON hoa_cost_items (economic_plan_id);
		CREATE INDEX hoa_cost_items_annual_statement_id_idx ON hoa_cost_items (annual_statement_id);
		CREATE INDEX hoa_cost_items_direct_unit_id_idx ON hoa_cost_items (direct_unit_id);
		CREATE INDEX hoa_cost_items_custom_allocation_key_id_idx ON hoa_cost_items (custom_allocation_key_id);
		PRAGMA foreign_keys = ON;
	`,
};