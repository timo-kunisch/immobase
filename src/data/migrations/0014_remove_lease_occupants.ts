import type { Migration } from "../migrate.ts";

/**
 * Entfernt das Feld „Anzahl Personen im Haushalt" (`leases.number_of_occupants`)
 * aus der Mietverwaltung: Es war ausschließlich die Datenbasis des
 * Umlageschlüssels „Personen" (OCCUPANTS) der Nebenkostenabrechnung. Für
 * personenbasierte Umlagen stehen stattdessen die frei definierbaren
 * Umlageschlüssel (allocationKey „CUSTOM", Reiter „Umlageschlüssel" von
 * /abrechnung) zur Verfügung.
 *
 * - `cost_items.allocation_key`: Bestehende OCCUPANTS-Positionen werden auf
 *   den Standard-Schlüssel LIVING_SPACE umgestellt (Downgrade-Verlust: Welche
 *   Positionen ursprünglich „Personen" waren, ist danach nicht mehr
 *   rekonstruierbar - bewusst akzeptiert, Muster wie 0010/0013). Finalisierte
 *   Perioden sind davon nur anzeigewirksam: Ihre eingefrorenen Einzel-
 *   abrechnungen (tenant_statements/-lines) und erzeugten PDFs bleiben
 *   unverändert.
 * - `leases.number_of_occupants` fällt ersatzlos weg (keine FK-/Index-
 *   Spalte, daher einfaches DROP COLUMN, Muster wie 0012). Das Down legt
 *   die Spalte mit dem bisherigen Default 1 wieder an.
 */
export const migration0014: Migration = {
	version: 14,
	name: "remove_lease_occupants",
	up: `
		UPDATE cost_items SET allocation_key = 'LIVING_SPACE' WHERE allocation_key = 'OCCUPANTS';

		ALTER TABLE leases DROP COLUMN number_of_occupants;
	`,
	down: `
		ALTER TABLE leases ADD COLUMN number_of_occupants integer DEFAULT 1 NOT NULL;
	`,
};