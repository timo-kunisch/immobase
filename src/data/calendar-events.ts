import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { CalendarEvent } from "./types";

/**
 * Repository für die manuell gepflegten Kalender-Ereignisse (Tabelle
 * `calendar_events`, Modul /kalender). Die automatisch eingeblendeten
 * Termine (Einzug/Auszug der Mietverträge, Eigentümerversammlungen)
 * gehören nicht hierher - sie werden aus den Fachdaten berechnet
 * (src/lib/calendar.ts).
 */

const CALENDAR_EVENT_COLUMNS = `
	id, title, description, start_date AS startDate, end_date AS endDate,
	created_at AS createdAt, updated_at AS updatedAt
`;

export interface CalendarEventInput {
	title: string;
	description: string | null;
	/** ISO-8601-Datum "YYYY-MM-DD". */
	startDate: string;
	/** ISO-8601-Datum "YYYY-MM-DD" oder null (eintägiges Ereignis). */
	endDate: string | null;
}

/**
 * Listet alle Ereignisse, die im Zeitraum [from, to] (jeweils
 * "YYYY-MM-DD", inklusive) sichtbar sind - also starten, enden oder den
 * Zeitraum überspannen. Ohne Zeitraum alle Ereignisse (chronologisch).
 */
export function listCalendarEvents(range?: { from: string; to: string }): CalendarEvent[] {
	if (range) {
		return getDb()
			.prepare(
				`SELECT ${CALENDAR_EVENT_COLUMNS} FROM calendar_events
				 WHERE start_date <= ? AND COALESCE(end_date, start_date) >= ?
				 ORDER BY start_date ASC, id ASC`
			)
			.all(range.to, range.from) as CalendarEvent[];
	}
	return getDb()
		.prepare(`SELECT ${CALENDAR_EVENT_COLUMNS} FROM calendar_events ORDER BY start_date ASC, id ASC`)
		.all() as CalendarEvent[];
}

export function getCalendarEvent(id: string): CalendarEvent | null {
	const row = getDb().prepare(`SELECT ${CALENDAR_EVENT_COLUMNS} FROM calendar_events WHERE id = ?`).get(id) as CalendarEvent | undefined;
	return row ?? null;
}

export function createCalendarEvent(input: CalendarEventInput): CalendarEvent {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO calendar_events (id, title, description, start_date, end_date, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.title, input.description, input.startDate, input.endDate, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateCalendarEvent(id: string, input: CalendarEventInput): void {
	getDb()
		.prepare(
			`UPDATE calendar_events
			 SET title = ?, description = ?, start_date = ?, end_date = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.title, input.description, input.startDate, input.endDate, now(), id);
}

export function deleteCalendarEvent(id: string): void {
	getDb().prepare("DELETE FROM calendar_events WHERE id = ?").run(id);
}
