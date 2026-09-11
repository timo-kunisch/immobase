import type { Migration } from "../migrate.ts";

/**
 * Tickets ohne Pflicht-Liegenschaft: `tickets.property_id` wird optional
 * (NULL = allgemeines Ticket ohne Objektbezug, z. B. organisatorische
 * Aufgaben). Die Verknüpfung bleibt referenziell gesichert (FK restrict auf
 * properties), nur die Pflicht entfällt.
 *
 * SQLite kennt kein ALTER COLUMN - der NOT-NULL-Fallback erfordert daher
 * einen Tabellen-Neubau von `tickets`. Dabei ist besondere Sorgfalt nötig,
 * weil `ticket_messages` über ON DELETE CASCADE auf `tickets` zeigt: Ein
 * naives `DROP TABLE tickets` löst mit aktivierten Foreign Keys einen
 * impliziten DELETE FROM aus und KASKADIERT den kompletten
 * Kommunikationsverlauf weg (PRAGMA foreign_keys ist innerhalb der
 * Migrations-Transaktion wirkungslos, siehe migrate.ts). Der Neubau läuft
 * deshalb in vier sicheren Schritten:
 *
 * 1. Neue Tabelle unter anderem Namen anlegen und bestehende Zeilen
 *    kopieren (alle bisherigen property_id-Werte referenzieren gültige
 *    Liegenschaften - der FK bleibt erfüllt).
 * 2. Die alte Tabelle unter neuem Namen beiseitestellen (ticket_messages
 *    verfolgt die Umbenennung in seiner FK-Definition) und die neue Tabelle
 *    auf den Namen `tickets` bringen.
 * 3. `ticket_messages` per Neubau auf die neue `tickets`-Tabelle zeigen
 *    lassen - erst danach ist die alte Tabelle kinderlos.
 * 4. Die alte Tabelle löschen: Der implizite DELETE FROM trifft auf keine
 *    Kind-Tabelle mehr und löst keine Kaskade aus. Anschließend die
 *    tickets-Indizes neu anlegen (Index-Namen sind datenbankweit einmalig
 *    und wurden mit der alten Tabelle gelöscht).
 *
 * Das Down baut beide Tabellen mit property_id NOT NULL wieder auf. Es
 * schlägt bewusst mit einem Constraint-Fehler fehl, wenn noch Tickets ohne
 * Liegenschaft existieren (loud statt still: kein Datenverlust, kein
 * stillschweigendes Aufräumen).
 *
 * Hinweis: Die CREATE-Anweisungen stehen bewusst ohne Einrückung im SQL -
 * SQLite speichert den CREATE-Text wörtlich in sqlite_master und
 * npm run schema:dump übernimmt ihn 1:1 nach src/data/schema.sql.
 */
export const migration0015: Migration = {
	version: 15,
	name: "tickets_optional_property",
	up: `
CREATE TABLE tickets_migration15 (
	id text PRIMARY KEY NOT NULL,
	property_id text,
	unit_id text,
	title text NOT NULL,
	description text,
	status text DEFAULT 'OPEN' NOT NULL,
	contractor_notes text,
	resolved_at text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);
INSERT INTO tickets_migration15
	(id, property_id, unit_id, title, description, status, contractor_notes, resolved_at, created_at, updated_at)
	SELECT id, property_id, unit_id, title, description, status, contractor_notes, resolved_at, created_at, updated_at
	FROM tickets;

ALTER TABLE tickets RENAME TO tickets_migration15_old;
ALTER TABLE tickets_migration15 RENAME TO tickets;

CREATE TABLE ticket_messages_migration15 (
	id text PRIMARY KEY NOT NULL,
	ticket_id text,
	direction text NOT NULL,
	message_id text,
	imap_folder text,
	imap_uid integer,
	from_address text,
	to_addresses text,
	subject text,
	body_text text,
	author_user_id text,
	author_email text,
	created_at text NOT NULL,
	FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (author_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);
INSERT INTO ticket_messages_migration15
	(id, ticket_id, direction, message_id, imap_folder, imap_uid, from_address, to_addresses, subject, body_text, author_user_id, author_email, created_at)
	SELECT id, ticket_id, direction, message_id, imap_folder, imap_uid, from_address, to_addresses, subject, body_text, author_user_id, author_email, created_at
	FROM ticket_messages;
DROP TABLE ticket_messages;
ALTER TABLE ticket_messages_migration15 RENAME TO ticket_messages;
CREATE INDEX ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);
CREATE INDEX ticket_messages_message_id_idx ON ticket_messages (message_id);
CREATE INDEX ticket_messages_mailbox_idx ON ticket_messages (direction, ticket_id);
CREATE UNIQUE INDEX ticket_messages_imap_uq ON ticket_messages (imap_folder, imap_uid) WHERE imap_uid IS NOT NULL;

DROP TABLE tickets_migration15_old;

CREATE INDEX tickets_property_id_idx ON tickets (property_id);
CREATE INDEX tickets_unit_id_idx ON tickets (unit_id);
`,
	down: `
CREATE TABLE tickets_migration15_restore (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	unit_id text,
	title text NOT NULL,
	description text,
	status text DEFAULT 'OPEN' NOT NULL,
	contractor_notes text,
	resolved_at text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);
-- Schlägt mit Constraint-Fehler fehl, solange Tickets ohne Liegenschaft existieren.
INSERT INTO tickets_migration15_restore
	(id, property_id, unit_id, title, description, status, contractor_notes, resolved_at, created_at, updated_at)
	SELECT id, property_id, unit_id, title, description, status, contractor_notes, resolved_at, created_at, updated_at
	FROM tickets;

ALTER TABLE tickets RENAME TO tickets_migration15_old;
ALTER TABLE tickets_migration15_restore RENAME TO tickets;

CREATE TABLE ticket_messages_migration15_restore (
	id text PRIMARY KEY NOT NULL,
	ticket_id text,
	direction text NOT NULL,
	message_id text,
	imap_folder text,
	imap_uid integer,
	from_address text,
	to_addresses text,
	subject text,
	body_text text,
	author_user_id text,
	author_email text,
	created_at text NOT NULL,
	FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (author_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);
INSERT INTO ticket_messages_migration15_restore
	(id, ticket_id, direction, message_id, imap_folder, imap_uid, from_address, to_addresses, subject, body_text, author_user_id, author_email, created_at)
	SELECT id, ticket_id, direction, message_id, imap_folder, imap_uid, from_address, to_addresses, subject, body_text, author_user_id, author_email, created_at
	FROM ticket_messages;
DROP TABLE ticket_messages;
ALTER TABLE ticket_messages_migration15_restore RENAME TO ticket_messages;
CREATE INDEX ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);
CREATE INDEX ticket_messages_message_id_idx ON ticket_messages (message_id);
CREATE INDEX ticket_messages_mailbox_idx ON ticket_messages (direction, ticket_id);
CREATE UNIQUE INDEX ticket_messages_imap_uq ON ticket_messages (imap_folder, imap_uid) WHERE imap_uid IS NOT NULL;

DROP TABLE tickets_migration15_old;

CREATE INDEX tickets_property_id_idx ON tickets (property_id);
CREATE INDEX tickets_unit_id_idx ON tickets (unit_id);
`,
};
