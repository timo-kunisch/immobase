import { describe, expect, it } from "vitest";

import {
	buildCalendarItems,
	buildMonthGrid,
	formatMonthParam,
	groupItemsByDay,
	localTimeFromIso,
	normalizeDayKey,
	parseMonthParam,
	shiftMonth,
	toLocalDayKey,
} from "@/lib/calendar";
import type { LeaseWithDetails } from "@/data/leases";
import type { OwnerMeetingWithHoaName } from "@/data/meetings";
import type { CalendarEvent, Property, Tenant, Unit } from "@/data/types";

/**
 * Tests der reinen Kalender-Logik (src/lib/calendar.ts): Aggregation der
 * automatischen Termine (Einzug/Auszug/Versammlungen) mit den manuellen
 * Ereignissen sowie das Monatsraster. Keine Datenbank nötig.
 */

const TIMESTAMP = "2026-01-01T00:00:00.000Z";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: "evt1",
		title: "Wartung",
		description: null,
		startDate: "2026-03-10",
		endDate: null,
		startTime: null,
		endTime: null,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
		...overrides,
	};
}

function makeLease(overrides: { id?: string; startDate?: string; endDate?: string | null } = {}): LeaseWithDetails {
	const property: Property = {
		id: "prop1",
		name: "Testhaus",
		street: "Hauptstr. 1",
		zipCode: "12345",
		city: "Berlin",
		country: "Deutschland",
		notes: null,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
	};
	const unit: Unit = {
		id: "unit1",
		propertyId: property.id,
		label: "Whg 1",
		livingSpace: null,
		rooms: null,
		floor: null,
		coOwnershipShare: null,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
	};
	const tenant: Tenant = {
		id: "ten1",
		firstName: "Max",
		lastName: "Mustermann",
		email: null,
		phone: null,
		notes: null,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
	};
	return {
		id: overrides.id ?? "lease1",
		unitId: unit.id,
		tenantId: tenant.id,
		startDate: overrides.startDate ?? "2026-03-01",
		endDate: overrides.endDate !== undefined ? overrides.endDate : "2026-12-31",
		coldRent: "800.00",
		serviceCharges: "100.00",
		deposit: null,
		notes: null,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
		unit: { ...unit, property },
		tenant,
		rentAdjustments: [],
		depositAccount: null,
	};
}

function makeMeeting(overrides: { id?: string; meetingDate?: string | null; status?: OwnerMeetingWithHoaName["status"] } = {}): OwnerMeetingWithHoaName {
	return {
		id: overrides.id ?? "meet1",
		hoaId: "hoa1",
		title: "Ordentliche Eigentümerversammlung",
		type: "ORDINARY",
		status: overrides.status ?? "PLANNED",
		meetingDate: overrides.meetingDate !== undefined ? overrides.meetingDate : "2026-03-20T18:00:00.000Z",
		location: null,
		invitationSentAt: null,
		invitationPdfPath: null,
		invitationPdfFileSize: null,
		invitationPdfGeneratedAt: null,
		minutesText: null,
		minutesFinalizedAt: null,
		minutesPdfPath: null,
		minutesPdfFileSize: null,
		minutesPdfGeneratedAt: null,
		notes: null,
		createdAt: TIMESTAMP,
		updatedAt: TIMESTAMP,
		hoaName: "WEG Muster",
	};
}

describe("normalizeDayKey", () => {
	it("lässt Tageswerte unverändert und bildet ISO-Zeitstempel auf den lokalen Tag ab", () => {
		expect(normalizeDayKey("2026-03-10")).toBe("2026-03-10");
		expect(normalizeDayKey("2026-03-10T18:00:00.000Z")).toBe("2026-03-10");
		expect(normalizeDayKey(null)).toBeNull();
		expect(normalizeDayKey("kein-datum")).toBeNull();
	});
});

describe("localTimeFromIso", () => {
	it("extrahiert die lokale Uhrzeit aus ISO-Zeitstempeln; Tageswerte bleiben ganztägig", () => {
		// Lokale Uhrzeit vor/toISOString und zurück - unabhängig von der Laufzeit-Zeitzone.
		const iso = new Date(2026, 2, 20, 18, 30).toISOString();
		expect(localTimeFromIso(iso)).toBe("18:30");
		expect(localTimeFromIso("2026-03-20")).toBeNull();
		expect(localTimeFromIso("kein-datum")).toBeNull();
		expect(localTimeFromIso(null)).toBeNull();
	});
});

describe("buildCalendarItems", () => {
	it("trägt mehrtägige manuelle Ereignisse an jedem betroffenen Tag ein", () => {
		const items = buildCalendarItems({
			events: [makeEvent({ startDate: "2026-03-10", endDate: "2026-03-12" })],
			leases: [],
			meetings: [],
		});
		expect(items.map((item) => item.dayKey)).toEqual(["2026-03-10", "2026-03-11", "2026-03-12"]);
		expect(items.every((item) => item.kind === "MANUAL" && item.href === null)).toBe(true);
	});

	it("zeigt Uhrzeiten manuell gepflegter Ereignisse an (eintägig als Spanne, mehrtägig an Start-/Endtag)", () => {
		const single = buildCalendarItems({
			events: [makeEvent({ startDate: "2026-03-10", startTime: "18:00", endTime: "20:00" })],
			leases: [],
			meetings: [],
		});
		expect(single).toHaveLength(1);
		expect(single[0].time).toBe("18:00–20:00");

		const startOnly = buildCalendarItems({
			events: [makeEvent({ startDate: "2026-03-10", startTime: "18:00" })],
			leases: [],
			meetings: [],
		});
		expect(startOnly[0].time).toBe("18:00");

		const multi = buildCalendarItems({
			events: [makeEvent({ startDate: "2026-03-10", endDate: "2026-03-12", startTime: "18:00", endTime: "20:00" })],
			leases: [],
			meetings: [],
		});
		expect(multi.map((item) => item.time)).toEqual(["18:00", null, "20:00"]);
	});

	it("berechnet Einzug und Auszug aus den Mietverträgen", () => {
		const items = buildCalendarItems({ events: [], leases: [makeLease()], meetings: [] });
		expect(items).toHaveLength(2);

		const start = items.find((item) => item.kind === "LEASE_START");
		expect(start?.dayKey).toBe("2026-03-01");
		expect(start?.title).toBe("Einzug: Max Mustermann");
		expect(start?.subtitle).toBe("Testhaus – Whg 1");
		expect(start?.href).toBe("/vertraege#lease-lease1");

		const end = items.find((item) => item.kind === "LEASE_END");
		expect(end?.dayKey).toBe("2026-12-31");
		expect(end?.title).toBe("Auszug: Max Mustermann");
	});

	it("lässt unbefristete Verträge ohne Auszug-Termin", () => {
		const items = buildCalendarItems({ events: [], leases: [makeLease({ endDate: null })], meetings: [] });
		expect(items.map((item) => item.kind)).toEqual(["LEASE_START"]);
	});

	it("blendet Versammlungen ein, abgesagte aber nicht - mit lokaler Uhrzeit aus dem Termin", () => {
		const items = buildCalendarItems({
			events: [],
			leases: [],
			meetings: [makeMeeting({ id: "m1" }), makeMeeting({ id: "m2", status: "CANCELLED" }), makeMeeting({ id: "m3", meetingDate: null })],
		});
		expect(items).toHaveLength(1);
		expect(items[0].kind).toBe("MEETING");
		expect(items[0].dayKey).toBe("2026-03-20");
		expect(items[0].title).toBe("Versammlung: Ordentliche Eigentümerversammlung");
		expect(items[0].subtitle).toBe("WEG Muster");
		expect(items[0].href).toBe("/weg/versammlungen#meeting-m1");
		// Lokale Uhrzeit des ISO-Zeitstempels (unabhängig von der Laufzeit-Zeitzone).
		expect(items[0].time).toBe(localTimeFromIso("2026-03-20T18:00:00.000Z"));

		// Tageswerte (ohne Uhrzeit) bleiben ganztägig.
		const dateOnly = buildCalendarItems({
			events: [],
			leases: [],
			meetings: [makeMeeting({ id: "m4", meetingDate: "2026-03-25" })],
		});
		expect(dateOnly[0].time).toBeNull();
	});

	it("sortiert Einträge nach Tag und Art", () => {
		const items = buildCalendarItems({
			events: [makeEvent({ startDate: "2026-03-01" })],
			leases: [makeLease({ startDate: "2026-03-01", endDate: null })],
			meetings: [],
		});
		expect(items.map((item) => item.kind)).toEqual(["MANUAL", "LEASE_START"]);
	});

	it("sortiert innerhalb eines Tages ganztägige vor zeitlichen Terminen (chronologisch)", () => {
		const items = buildCalendarItems({
			events: [
				makeEvent({ id: "evt-abend", title: "Abendtermin", startDate: "2026-03-01", startTime: "20:00" }),
				makeEvent({ id: "evt-morgen", title: "Frühtermin", startDate: "2026-03-01", startTime: "08:00" }),
				makeEvent({ id: "evt-ganztag", title: "Ganztägig", startDate: "2026-03-01" }),
			],
			leases: [],
			meetings: [],
		});
		expect(items.map((item) => item.title)).toEqual(["Ganztägig", "Frühtermin", "Abendtermin"]);
	});
});

describe("groupItemsByDay", () => {
	it("gruppiert nach Tag", () => {
		const items = buildCalendarItems({
			events: [makeEvent({ startDate: "2026-03-10" })],
			leases: [makeLease({ startDate: "2026-03-10", endDate: null })],
			meetings: [],
		});
		const byDay = groupItemsByDay(items);
		expect(byDay.get("2026-03-10")).toHaveLength(2);
		expect(byDay.get("2026-03-11")).toBeUndefined();
	});
});

describe("buildMonthGrid", () => {
	it("liefert volle Wochen beginnend am Montag inklusive Fülltage", () => {
		// März 2026: 1. März ist ein Sonntag -> Woche beginnt am Montag, 23.02.
		const grid = buildMonthGrid(2026, 2);
		expect(grid).toHaveLength(42);
		expect(grid[0]).toEqual({ dayKey: "2026-02-23", dayOfMonth: 23, inMonth: false });
		expect(grid[6]).toEqual({ dayKey: "2026-03-01", dayOfMonth: 1, inMonth: true });
		expect(grid[grid.length - 1]).toEqual({ dayKey: "2026-04-05", dayOfMonth: 5, inMonth: false });
		expect(grid.filter((day) => day.inMonth)).toHaveLength(31);
	});

	it("beginnt eine Woche mit jedem Raster an einem Montag", () => {
		for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
			const grid = buildMonthGrid(2026, monthIndex);
			expect(grid.length % 7).toBe(0);
			const [year, month, day] = grid[0].dayKey.split("-").map(Number);
			expect(new Date(year, month - 1, day).getDay()).toBe(1);
		}
	});
});

describe("parseMonthParam / formatMonthParam / shiftMonth", () => {
	it("parst gültige Monats-Parameter und fällt sonst auf den aktuellen Monat zurück", () => {
		expect(parseMonthParam("2026-03")).toEqual({ year: 2026, monthIndex: 2 });
		// Ungültige/fehlende Werte -> Fallback (hier explizit übergeben).
		const fallback = new Date(2026, 0, 15);
		expect(parseMonthParam("2026-13", fallback)).toEqual({ year: 2026, monthIndex: 0 });
		expect(parseMonthParam("kaputt", fallback)).toEqual({ year: 2026, monthIndex: 0 });
		expect(parseMonthParam(undefined, fallback)).toEqual({ year: 2026, monthIndex: 0 });
	});

	it("formatiert und verschiebt Monate über Jahresgrenzen hinweg", () => {
		expect(formatMonthParam(2026, 2)).toBe("2026-03");
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
	});
});

describe("toLocalDayKey", () => {
	it("formatiert ohne UTC-Verschiebung", () => {
		expect(toLocalDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
		expect(toLocalDayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
	});
});
