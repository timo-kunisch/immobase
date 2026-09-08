import type { Migration } from "../migrate.ts";

/**
 * 0004_calendar_events - Manuell gepflegte Kalender-Ereignisse
 * (Modul /kalender). Zusätzlich zu diesen gespeicherten Ereignissen
 * blendet der Kalender automatisch Termine aus den Fachdaten ein
 * (Einzug/Auszug der Mietverträge, Eigentümerversammlungen) - die werden
 * zur Laufzeit berechnet (src/lib/calendar.ts) und NICHT hier gespeichert.
 *
 * `start_date`/`end_date` sind ISO-8601-Datumswerte auf Tagesebene
 * ("YYYY-MM-DD"); `end_date` ist null bei eintägigen Ereignissen.
 */
export const migration0004: Migration = {
	version: 4,
	name: "calendar_events",
	up: `
CREATE TABLE calendar_events (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	description text,
	start_date text NOT NULL,
	end_date text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);
CREATE INDEX calendar_events_start_date_idx ON calendar_events (start_date);
`,
	down: `
DROP TABLE IF EXISTS calendar_events;
`,
};
