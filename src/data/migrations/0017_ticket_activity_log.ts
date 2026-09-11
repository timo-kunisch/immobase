import type { Migration } from "../migrate.ts";

/**
 * Ticket-Aktivitätsverlauf (`ticket_activity_log`): Protokolliert JEDE
 * fachliche Aktion auf einem Ticket (Anlegen, Bearbeiten, Statuswechsel,
 * Notiz bearbeiten/löschen, E-Mail zuordnen/lösen/neu zuordnen) mit Wer
 * und Wann - vollständig unabhängig vom globalen Aktivitätsprotokoll
 * (audit_log_entries, Admin-Sicht über alle Module): Hier geht es um die
 * nachvollziehbare Geschichte DES EINZELNEN Tickets, sichtbar für jeden
 * berechtigten Nutzer direkt im Ticket-Verlauf der Detailseite.
 *
 * - `action` = stabiler Enum-Schlüssel (TicketActivityAction, TS-Seite
 *   validiert), Labels/Formatierung erfolgt zur Laufzeit über i18n.
 * - `from_value`/`to_value` = alter/neuer Wert bei Wertänderungen
 *   (Statuswechsel: Ticket-Status-Enum).
 * - `detail` = freier Kontext (z. B. E-Mail-Betreff bei Zuordnungs-
 *   Aktionen oder Hinweis „aus E-Mail" beim Anlegen aus dem Postfach).
 * - `actor_user_id`/`actor_email`: handelnder Nutzer, E-Mail bewusst
 *   denormalisiert (lesbar nach Konto-Löschung; FK ON DELETE SET NULL).
 *   Beide NULL = System-Aktion ohne Nutzerkontext (z. B. MCP-Werkzeuge -
 *   siehe Abschnitt zu MCP in AGENTS.md: Token ohne Nutzerkontext).
 * - Append-only wie das Audit-Log: keine Update-/Delete-Operationen im
 *   Repository; Einträge verschwinden nur mit dem Ticket (ON DELETE
 *   CASCADE) bzw. beim Inhalts-Reset.
 */
export const migration0017: Migration = {
	version: 17,
	name: "ticket_activity_log",
	up: `
CREATE TABLE ticket_activity_log (
	id text PRIMARY KEY NOT NULL,
	ticket_id text NOT NULL,
	action text NOT NULL,
	from_value text,
	to_value text,
	detail text,
	actor_user_id text,
	actor_email text,
	created_at text NOT NULL,
	FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (actor_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX ticket_activity_log_ticket_idx ON ticket_activity_log (ticket_id, created_at);
`,
	down: `
DROP TABLE IF EXISTS ticket_activity_log;
`,
};
