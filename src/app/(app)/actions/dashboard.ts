import { listCalendarEvents } from "@/data/calendar-events";
import {
	getDashboardCounts,
	listActiveLeasesForRent,
	listAllReserveFundBookings,
	listHousingChargeArrearAmounts,
	listLatestOpenTickets,
	listRentArrearAmounts,
} from "@/data/dashboard";
import { listLeasesWithDetails } from "@/data/leases";
import { listOwnerMeetings } from "@/data/meetings";
import { buildCalendarItems, toLocalDayKey, type CalendarItemKind } from "@/lib/calendar";
import { calculateReserveFundBalanceCents } from "@/lib/hoa-reserve";
import { centsToDecimalString } from "@/lib/money";
import { getRentForDate } from "@/lib/rent-history";

/**
 * Zentrale Datenabfrage für das Dashboard. Bewusst KEINE Server Action
 * (kein "use server"), da es sich um reines Lesen/Aggregieren handelt –
 * wird direkt aus der Dashboard-Server-Komponente aufgerufen.
 *
 * Die Datenbankzugriffe liegen im Repository src/data/dashboard.ts
 * (synchrones better-sqlite3); hier findet nur noch die fachliche
 * Auswertung (Leerstandsquote, aktuell gültige Mieten, Summen) statt.
 *
 * Das Dashboard bildet alle Fachbereiche ab (allgemeine Stammdaten,
 * Mietverwaltung, WEG-Verwaltung).
 */

/** Ein anstehender Termin auf der Startseite (aus der Kalender-Aggregation). */
export interface DashboardUpcomingEvent {
	kind: CalendarItemKind;
	/** Lokaler Tag "YYYY-MM-DD". */
	dayKey: string;
	/** Uhrzeit "HH:MM" bzw. null (ganztägig). */
	time: string | null;
	title: string;
	/** Zusatzinfo (z. B. "Liegenschaft – Einheit" oder WEG-Name). */
	subtitle: string | null;
	/** Linkziel (null bei manuellen Ereignissen -> /kalender). */
	href: string | null;
}

/**
 * Baut die anstehenden Termine (ab heute, chronologisch) aus derselben
 * Aggregation wie der Kalender (manuelle Ereignisse, Einzug/Auszug der
 * Mietverträge, Eigentümerversammlungen). `labels` enthält die lokalisierten
 * Titel-Präfixe der automatischen Termine (Muster wie /kalender).
 */
function getUpcomingEvents(labels: { leaseStart: string; leaseEnd: string; meeting: string }, limit: number, todayKey: string): DashboardUpcomingEvent[] {
	return buildCalendarItems({
		events: listCalendarEvents(),
		leases: listLeasesWithDetails(),
		meetings: listOwnerMeetings(),
		labels,
	})
		.filter((item) => item.dayKey >= todayKey)
		.slice(0, limit)
		.map(({ kind, dayKey, time, title, subtitle, href }) => ({ kind, dayKey, time, title, subtitle, href }));
}

export async function getDashboardData(labels: { leaseStart: string; leaseEnd: string; meeting: string }) {
	const now = new Date();

	const counts = getDashboardCounts(now);
	const activeLeasesWithAdjustments = listActiveLeasesForRent(now);
	const arrearAmounts = listRentArrearAmounts(now);
	const housingChargeArrearAmounts = listHousingChargeArrearAmounts(now);
	const latestOpenTickets = listLatestOpenTickets(5);
	const upcomingEvents = getUpcomingEvents(labels, 5, toLocalDayKey(now));

	const {
		propertiesCount,
		unitsCount,
		tenantsCount,
		openTicketsCount,
		occupiedUnitsCount,
		activeLeasesCount,
		draftBillingPeriodsCount,
		hoasCount,
		ownersCount,
		draftEconomicPlansCount,
		draftAnnualStatementsCount,
		documentsCount,
	} = counts;

	const vacantUnitsCount = Math.max(unitsCount - occupiedUnitsCount, 0);
	const vacancyRate = unitsCount > 0 ? (vacantUnitsCount / unitsCount) * 100 : 0;

	// Aktuell gültige Kaltmiete/Nebenkosten je Vertrag (berücksichtigt spätere
	// Mieterhöhungen/-senkungen über RentAdjustment), nicht einfach der
	// ursprüngliche Lease-Basiswert.
	const currentRents = activeLeasesWithAdjustments.map((lease) => getRentForDate(lease, lease.rentAdjustments, now));
	const coldRentSum = currentRents.reduce((sum, r) => sum + r.coldRent, 0);
	const serviceChargesSum = currentRents.reduce((sum, r) => sum + r.serviceCharges, 0);
	const totalRent = coldRentSum + serviceChargesSum;

	const rentArrears = arrearAmounts.reduce((sum, amount) => sum + Number(amount), 0);
	const housingChargeArrears = housingChargeArrearAmounts.reduce((sum, amount) => sum + Number(amount), 0);

	// Gesamt-Saldo der Erhaltungsrücklagen über alle WEGs (gleiche Berechnung
	// wie die Rücklage-Seite: Vorzeichen je Buchungsart, Stichtag heute).
	const reserveFundBalance = centsToDecimalString(calculateReserveFundBalanceCents(listAllReserveFundBookings(), now));

	return {
		propertiesCount,
		unitsCount,
		occupiedUnitsCount,
		vacantUnitsCount,
		vacancyRate,
		coldRentSum,
		serviceChargesSum,
		totalRent,
		tenantsCount,
		openTicketsCount,
		rentArrears,
		activeLeasesCount,
		draftBillingPeriodsCount,
		documentsCount,
		hoasCount,
		ownersCount,
		draftEconomicPlansCount,
		draftAnnualStatementsCount,
		housingChargeArrears,
		reserveFundBalance,
		latestOpenTickets,
		upcomingEvents,
	};
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
