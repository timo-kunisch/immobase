import type { LeaseWithDetails } from "@/data/leases";
import type { OwnerMeetingWithHoaName } from "@/data/meetings";
import type { CalendarEvent } from "@/data/types";

/**
 * Kalender-Aggregation (Modul /kalender): Baut die Anzeige-Liste des
 * Kalenders aus zwei Quellen -
 *
 * 1. manuell gepflegte Ereignisse (Tabelle `calendar_events`, kind "MANUAL")
 * 2. automatische Termine aus den Fachdaten (werden NICHT gespeichert,
 *    sondern bei jeder Anzeige frisch berechnet):
 *    - Einzug (Mietbeginn, kind "LEASE_START") und Auszug (Mietende,
 *      kind "LEASE_END") aller Mietverträge
 *    - Eigentümerversammlungen mit Termin (kind "MEETING"; abgesagte
 *      Versammlungen werden ausgeblendet)
 *
 * Reine Funktionen ohne Datenbankzugriff (die Daten lädt die Seite über
 * die Repositories und reicht sie hier durch) - daher mit vitest testbar.
 */

export type CalendarItemKind = "MANUAL" | "LEASE_START" | "LEASE_END" | "MEETING";

/** Ein darstellbarer Kalender-Eintrag an einem konkreten Tag. */
export interface CalendarItem {
	kind: CalendarItemKind;
	/** Lokaler Tag "YYYY-MM-DD". */
	dayKey: string;
	title: string;
	/** Zusatzinfo (z. B. "Liegenschaft – Einheit" oder WEG-Name). */
	subtitle: string | null;
	/** Linkziel für automatische Termine; null bei manuellen Ereignissen. */
	href: string | null;
	/** Bei kind "MANUAL": das zugrunde liegende Ereignis (für Bearbeiten/Löschen). */
	event: CalendarEvent | null;
}

/** Formatiert ein Date als lokalen Tag "YYYY-MM-DD" (ohne UTC-Verschiebung). */
export function toLocalDayKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Normalisiert einen gespeicherten Datumswert auf den lokalen Tag
 * "YYYY-MM-DD": Tageswerte ("YYYY-MM-DD") bleiben unverändert, ISO-
 * Zeitstempel (z. B. owner_meetings.meeting_date) werden in lokaler
 * Zeitzone auf den Tag abgebildet. Ungültige Werte liefern null.
 */
export function normalizeDayKey(value: string | null | undefined): string | null {
	if (!value) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return toLocalDayKey(date);
}

/** Addiert Tage auf einen "YYYY-MM-DD"-Schlüssel (lokale Zeitzone). */
function addDays(dayKey: string, days: number): string {
	const [year, month, day] = dayKey.split("-").map(Number);
	const date = new Date(year, month - 1, day + days);
	return toLocalDayKey(date);
}

/** Sortierreihenfolge der Termin-Arten innerhalb eines Tages. */
const KIND_ORDER: Record<CalendarItemKind, number> = {
	MANUAL: 0,
	LEASE_START: 1,
	LEASE_END: 2,
	MEETING: 3,
};

/**
 * Baut die vollständige Anzeige-Liste: Manuelle Ereignisse werden für
 * jeden Tag ihres Zeitraums (startDate bis endDate bzw. nur startDate)
 * je einmal eingetragen; die automatischen Termine erscheinen an ihrem
 * jeweiligen Tag mit Link in das Fachmodul.
 */
export function buildCalendarItems(input: {
	events: CalendarEvent[];
	leases: LeaseWithDetails[];
	meetings: OwnerMeetingWithHoaName[];
}): CalendarItem[] {
	const items: CalendarItem[] = [];

	for (const event of input.events) {
		const startDay = normalizeDayKey(event.startDate);
		if (!startDay) continue;
		const endDay = normalizeDayKey(event.endDate) ?? startDay;
		// Mehrtägige Ereignisse werden an jedem betroffenen Tag angezeigt.
		// (Schutz vor Endlos-Schleifen bei fehlerhaften Daten: max. 400 Tage.)
		for (let day = startDay, count = 0; day <= endDay && count < 400; day = addDays(day, 1), count += 1) {
			items.push({ kind: "MANUAL", dayKey: day, title: event.title, subtitle: null, href: null, event });
		}
	}

	for (const lease of input.leases) {
		const tenantName = `${lease.tenant.firstName} ${lease.tenant.lastName}`;
		const subtitle = `${lease.unit.property.name} – ${lease.unit.label}`;
		const startDay = normalizeDayKey(lease.startDate);
		if (startDay) {
			items.push({
				kind: "LEASE_START",
				dayKey: startDay,
				title: `Einzug: ${tenantName}`,
				subtitle,
				href: `/vertraege#lease-${lease.id}`,
				event: null,
			});
		}
		const endDay = normalizeDayKey(lease.endDate);
		if (endDay) {
			items.push({
				kind: "LEASE_END",
				dayKey: endDay,
				title: `Auszug: ${tenantName}`,
				subtitle,
				href: `/vertraege#lease-${lease.id}`,
				event: null,
			});
		}
	}

	for (const meeting of input.meetings) {
		// Abgesagte Versammlungen werden nicht eingeblendet.
		if (meeting.status === "CANCELLED") continue;
		const day = normalizeDayKey(meeting.meetingDate);
		if (!day) continue;
		items.push({
			kind: "MEETING",
			dayKey: day,
			title: `Versammlung: ${meeting.title}`,
			subtitle: meeting.hoaName,
			href: `/weg/versammlungen#meeting-${meeting.id}`,
			event: null,
		});
	}

	items.sort((a, b) => a.dayKey.localeCompare(b.dayKey) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title, "de"));
	return items;
}

/** Gruppiert Einträge nach Tag (Map: dayKey -> Einträge, bereits sortiert). */
export function groupItemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
	const byDay = new Map<string, CalendarItem[]>();
	for (const item of items) {
		const list = byDay.get(item.dayKey) ?? [];
		list.push(item);
		byDay.set(item.dayKey, list);
	}
	return byDay;
}

/** Ein Tag im Monatsraster (inkl. Fülltage aus Nachbarmonaten). */
export interface CalendarGridDay {
	dayKey: string;
	/** Tag im Monat (1-31). */
	dayOfMonth: number;
	/** false = Fülltag aus dem Vor-/Folgemonat. */
	inMonth: boolean;
}

/**
 * Berechnet das Monatsraster (Wochen beginnen am Montag): alle Tage des
 * Monats plus Fülltage aus den Nachbarmonaten bis zu vollen Wochen.
 */
export function buildMonthGrid(year: number, monthIndex: number): CalendarGridDay[] {
	const firstOfMonth = new Date(year, monthIndex, 1);
	// Montag = 0, ..., Sonntag = 6 (JS: Sonntag = 0).
	const leadingDays = (firstOfMonth.getDay() + 6) % 7;
	const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
	const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

	const grid: CalendarGridDay[] = [];
	for (let cell = 0; cell < totalCells; cell += 1) {
		const date = new Date(year, monthIndex, 1 - leadingDays + cell);
		grid.push({
			dayKey: toLocalDayKey(date),
			dayOfMonth: date.getDate(),
			inMonth: date.getMonth() === monthIndex,
		});
	}
	return grid;
}

/** Parst den ?month=-Parameter ("YYYY-MM"); ungültig/fehlend -> aktueller Monat. */
export function parseMonthParam(value: string | undefined, fallback: Date = new Date()): { year: number; monthIndex: number } {
	if (value) {
		const match = /^(\d{4})-(\d{2})$/.exec(value);
		if (match) {
			const year = Number(match[1]);
			const monthIndex = Number(match[2]) - 1;
			if (monthIndex >= 0 && monthIndex < 12) return { year, monthIndex };
		}
	}
	return { year: fallback.getFullYear(), monthIndex: fallback.getMonth() };
}

/** Formatiert Jahr/Monat als ?month=-Parameter ("YYYY-MM"). */
export function formatMonthParam(year: number, monthIndex: number): string {
	return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Verschiebt einen Monat um `delta` Monate (für die Blättern-Navigation). */
export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
	const date = new Date(year, monthIndex + delta, 1);
	return { year: date.getFullYear(), monthIndex: date.getMonth() };
}
