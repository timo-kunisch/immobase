import type { Migration } from "../migrate.ts";

/**
 * Nebenkostenabrechnung: frei definierbare Umlageschlüssel (allocationKey
 * "CUSTOM", Muster der WEG-Verwaltung, siehe hoa_custom_allocation_keys) und
 * Wegfall der Kostenart-Spalte.
 *
 * - `custom_allocation_keys` + `custom_allocation_key_weights`: Je
 *   Liegenschaft frei definierbare Umlageschlüssel mit Gewicht je Einheit
 *   (z. B. "Anzahl Stellplätze"). Eine Kostenposition mit allocationKey
 *   "CUSTOM" verweist über `cost_items.custom_allocation_key_id` darauf
 *   (ON DELETE set null: Wird der Schlüssel gelöscht, bleibt die Position
 *   stehen - die Berechnung meldet dann keine Verteilungsgrundlage).
 * - `cost_items.category` (Kostenart nach § 2 BetrKV Nr. 1-17) entfällt: Die
 *   Bezeichnung (label) trägt die fachliche Information selbst (z. B.
 *   "Gebäudeversicherung"), die zusätzliche Kategorie-Auswahl war redundant.
 *
 * Das Down restauriert cost_items per Tabellen-Neubau, weil SQLite DROP
 * COLUMN auf der FK-Spalte custom_allocation_key_id nicht erlaubt; die
 * Kostenart wird dabei pauschal mit "OTHER" wiederhergestellt (die
 * Original-Kategorien sind nach dem Upgrade weg - bewusst akzeptierter
 * Verlust eines Downgrades, Kategorien sind reine Beschriftung).
 */
export const migration0010: Migration = {
	version: 10,
	name: "rental_custom_allocation_keys",
	up: `
CREATE TABLE custom_allocation_keys (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	label text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX custom_allocation_keys_property_id_idx ON custom_allocation_keys (property_id);

CREATE TABLE custom_allocation_key_weights (
	id text PRIMARY KEY NOT NULL,
	custom_allocation_key_id text NOT NULL,
	unit_id text NOT NULL,
	weight real NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (custom_allocation_key_id) REFERENCES custom_allocation_keys(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX custom_allocation_key_weights_unit_id_idx ON custom_allocation_key_weights (unit_id);
CREATE UNIQUE INDEX custom_allocation_key_weights_key_unit_key ON custom_allocation_key_weights (custom_allocation_key_id, unit_id);

ALTER TABLE cost_items DROP COLUMN category;
ALTER TABLE cost_items ADD COLUMN custom_allocation_key_id text REFERENCES custom_allocation_keys(id) ON UPDATE no action ON DELETE set null;
CREATE INDEX cost_items_custom_allocation_key_id_idx ON cost_items (custom_allocation_key_id);
`,
	down: `
DROP INDEX IF EXISTS cost_items_custom_allocation_key_id_idx;

-- Tabellen-Neubau statt DROP COLUMN: SQLite verweigert DROP COLUMN auf der
-- Spalte einer FK-Definition (Muster wie in 0001_init.ts, PRAGMA foreign_keys).
PRAGMA foreign_keys = OFF;
CREATE TABLE cost_items_migration10_restore (
	id text PRIMARY KEY NOT NULL,
	billing_period_id text NOT NULL,
	category text DEFAULT 'OTHER' NOT NULL,
	label text NOT NULL,
	amount text NOT NULL,
	allocation_key text NOT NULL,
	direct_unit_id text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (direct_unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);
INSERT INTO cost_items_migration10_restore (id, billing_period_id, category, label, amount, allocation_key, direct_unit_id, notes, created_at, updated_at)
	SELECT id, billing_period_id, 'OTHER', label, amount, allocation_key, direct_unit_id, notes, created_at, updated_at FROM cost_items;
DROP TABLE cost_items;
ALTER TABLE cost_items_migration10_restore RENAME TO cost_items;
CREATE INDEX cost_items_billing_period_id_idx ON cost_items (billing_period_id);
CREATE INDEX cost_items_direct_unit_id_idx ON cost_items (direct_unit_id);
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS custom_allocation_key_weights;
DROP TABLE IF EXISTS custom_allocation_keys;
`,
};
