import type { Migration } from "../migrate.ts";

/**
 * Entfernt das Feld „Handwerker-Notizen" (`tickets.contractor_notes`)
 * ersatzlos aus der Mietverwaltung: Freitext-Notizen zum Handwerker gehören
 * in den Kommunikationsverlauf des Tickets (interne Notizen auf der
 * Detailseite, Tabelle `ticket_messages`), nicht an das Ticket selbst.
 *
 * Die Spalte ist nicht Teil von Indizes, Constraints oder Fremdschlüsseln -
 * daher genügt ein einfaches DROP COLUMN (Muster wie 0012/0014). Bestehende
 * Notizen werden mit der Spalte gelöscht (bewusst gewollt).
 *
 * Das Down legt die Spalte als nullable TEXT wieder an; die zuvor
 * vorhandenen Notizen sind dabei verloren (Downgrade-Verlust, bewusst
 * akzeptiert - Muster wie 0014).
 */
export const migration0016: Migration = {
	version: 16,
	name: "remove_ticket_contractor_notes",
	up: `
		ALTER TABLE tickets DROP COLUMN contractor_notes;
	`,
	down: `
		ALTER TABLE tickets ADD COLUMN contractor_notes text;
	`,
};
