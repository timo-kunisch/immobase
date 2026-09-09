import type { Migration } from "../migrate.ts";

/**
 * Ticket-Kommunikation ("Mini-Zendesk"): Alle Nachrichten eines Tickets
 * (eingehende E-Mails aus dem IMAP-Postfach, ausgehende E-Mail-Antworten
 * und interne Notizen) liegen in EINER Tabelle `ticket_messages` -
 * `ticket_id IS NULL` bedeutet "liegt noch im Postfach" (nur bei
 * direction = 'INBOUND' fachlich relevant). `imap_sync_state` merkt sich
 * pro IMAP-Ordner den Abgleichstand (UIDVALIDITY + zuletzt gesehene UID)
 * sowie den letzten Sync-Status für die Anzeige im Postfach.
 */
export const migration0006: Migration = {
	version: 6,
	name: "ticket_messages",
	up: `
CREATE TABLE ticket_messages (
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
CREATE INDEX ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);
CREATE INDEX ticket_messages_message_id_idx ON ticket_messages (message_id);
CREATE INDEX ticket_messages_mailbox_idx ON ticket_messages (direction, ticket_id);
-- Dedup: dieselbe IMAP-Nachricht (Ordner + UID) nie zweimal importieren
-- (partieller Unique-Index nur für importierte Nachrichten).
CREATE UNIQUE INDEX ticket_messages_imap_uq ON ticket_messages (imap_folder, imap_uid) WHERE imap_uid IS NOT NULL;

CREATE TABLE imap_sync_state (
	folder text PRIMARY KEY NOT NULL,
	uid_validity integer DEFAULT 0 NOT NULL,
	last_uid integer DEFAULT 0 NOT NULL,
	last_sync_at text,
	last_error text,
	last_new_count integer
);
`,
	down: `
DROP TABLE IF EXISTS imap_sync_state;
DROP TABLE IF EXISTS ticket_messages;
`,
};
