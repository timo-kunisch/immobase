import type { Migration } from "../migrate.ts";

/**
 * Postfach: Ausgeblendete E-Mails. `ticket_messages.hidden` markiert
 * unzugeordnete eingehende Nachrichten, die aus der Postfach-Ansicht
 * ausgeblendet wurden (Alternative zum Löschen oder der Zuordnung zu
 * einem Ticket): Sie bleiben samt Dedup-Merkmal (IMAP-Ordner + UID)
 * erhalten, tauchen aber nicht mehr in der normalen Postfach-Liste auf
 * und können über den Bereich „Ausgeblendete E-Mails" wieder
 * eingeblendet werden.
 *
 * Fachlich relevant nur bei `direction = 'INBOUND' AND ticket_id IS NULL`;
 * beim Zuordnen zu einem Ticket wird das Flag zurückgesetzt, damit die
 * E-Mail nach dem Lösen der Zuordnung wieder sichtbar im Postfach landet.
 *
 * Die Spalte ist nicht Teil von Indizes, Constraints oder Fremdschlüsseln -
 * daher genügt ein einfaches ADD/DROP COLUMN (Muster wie 0016). Beim Down
 * geht der Ausblend-Zustand verloren (Downgrade-Verlust, bewusst
 * akzeptiert - die Nachrichten selbst bleiben erhalten).
 */
export const migration0018: Migration = {
	version: 18,
	name: "mailbox_hidden",
	up: `
		ALTER TABLE ticket_messages ADD COLUMN hidden integer DEFAULT 0 NOT NULL;
	`,
	down: `
		ALTER TABLE ticket_messages DROP COLUMN hidden;
	`,
};