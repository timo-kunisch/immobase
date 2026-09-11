import type { Migration } from "../migrate.ts";

/**
 * Vor- und Nachname für Benutzerkonten: Erlaubt die Anzeige des Namens
 * statt der E-Mail-Adresse als Bezeichnung (z. B. Sidebar, Admin-
 * Nutzerverwaltung, Aktivitätsprotokoll, Ticket-Verlauf). Bewusst
 * optional (NULL = kein Name hinterlegt, insbesondere für Altkonten;
 * die Anzeige fällt dann auf die E-Mail-Adresse zurück). Die Spalten
 * sind nicht Teil von Indizes, Constraints oder Fremdschlüsseln -
 * daher genügt ein einfaches ADD/DROP COLUMN (Muster wie 0018-0020).
 */
export const migration0021: Migration = {
	version: 21,
	name: "user_names",
	up: `
		ALTER TABLE users ADD COLUMN first_name text;
		ALTER TABLE users ADD COLUMN last_name text;
	`,
	down: `
		ALTER TABLE users DROP COLUMN first_name;
		ALTER TABLE users DROP COLUMN last_name;
	`,
};
