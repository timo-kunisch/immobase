import type { Migration } from "../migrate.ts";

/**
 * 0012_calendar_event_times - Optionale Uhrzeiten für manuell gepflegte
 * Kalender-Ereignisse (Modul /kalender): `start_time`/`end_time` als
 * "HH:MM" (24h), jeweils null = ganztägig (bisheriger Standard aller
 * Ereignisse). Die automatischen Termine bleiben unverändert: Ein-/Auszug
 * ganztägig, Eigentümerversammlungen tragen ihre Uhrzeit bereits im
 * ISO-Zeitstempel `owner_meetings.meeting_date`.
 */
export const migration0012: Migration = {
	version: 12,
	name: "calendar_event_times",
	up: `
ALTER TABLE calendar_events ADD COLUMN start_time text;
ALTER TABLE calendar_events ADD COLUMN end_time text;
`,
	down: `
ALTER TABLE calendar_events DROP COLUMN start_time;
ALTER TABLE calendar_events DROP COLUMN end_time;
`,
};
