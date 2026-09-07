import {
	getDashboardCounts,
	listActiveLeasesForRent,
	listRentArrearAmounts,
	listLatestOpenTickets,
} from "@/data/dashboard";
import { getRentForDate } from "@/lib/rent-history";

/**
 * Zentrale Datenabfrage für das Dashboard. Bewusst KEINE Server Action
 * (kein "use server"), da es sich um reines Lesen/Aggregieren handelt –
 * wird direkt aus der Dashboard-Server-Komponente aufgerufen.
 *
 * Die Datenbankzugriffe liegen im Repository src/data/dashboard.ts
 * (synchrones better-sqlite3); hier findet nur noch die fachliche
 * Auswertung (Leerstandsquote, aktuell gültige Mieten, Summen) statt.
 */
export async function getDashboardData() {
	const now = new Date();

	const counts = getDashboardCounts(now);
	const activeLeasesWithAdjustments = listActiveLeasesForRent(now);
	const arrearAmounts = listRentArrearAmounts(now);
	const latestOpenTickets = listLatestOpenTickets(5);

	const { propertiesCount, unitsCount, tenantsCount, openTicketsCount, occupiedUnitsCount } = counts;

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
		latestOpenTickets,
	};
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
