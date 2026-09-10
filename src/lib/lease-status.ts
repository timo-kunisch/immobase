/**
 * Der Status eines Mietvertrags wird ausschließlich aus startDate/endDate
 * abgeleitet - bewusst kein manuell zu pflegendes Feld, weil ein solches
 * in der Praxis nicht konsistent mit Mietbeginn/-ende aktualisiert wird.
 * Diese Datei kapselt die dafür nötige Logik, damit überall (Vertrags-,
 * Einheiten-, Finanzen- und Dashboard-Modul) dieselbe Regel gilt.
 */

export type LeaseStatusValue = "UPCOMING" | "ACTIVE" | "ENDED";

type LeaseStatusFields = {
	startDate: string;
	endDate: string | null;
};

/** Leitet den Status eines Mietvertrags anhand von Mietbeginn/-ende ab. */
export function getLeaseStatus(lease: LeaseStatusFields, date: Date = new Date()): LeaseStatusValue {
	const start = new Date(lease.startDate);
	const end = lease.endDate ? new Date(lease.endDate) : null;
	if (start > date) return "UPCOMING";
	if (end && end < date) return "ENDED";
	return "ACTIVE";
}

export const leaseStatusStyles: Record<LeaseStatusValue, string> = {
	ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	UPCOMING: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	ENDED: "bg-muted text-muted-foreground",
};

/**
 * SQL-Fragment (WHERE-Bedingung inkl. Parameter) für "aktuell laufende"
 * Mietverträge, d. h.
 * Mietbeginn liegt nicht in der Zukunft und Mietende (falls gesetzt) liegt
 * nicht in der Vergangenheit. Die Spalten sind bewusst ohne Tabellen-Alias
 * angegeben - bei JOINs ergänzt der Aufrufer das Alias selbst (z. B.
 * "l.start_date"). Für better-sqlite3-Prepared-Statements gedacht.
 */
export function activeLeaseWhere(date: Date = new Date()): { sql: string; params: string[] } {
	const iso = date.toISOString();
	return {
		sql: "(start_date <= ? AND (end_date IS NULL OR end_date >= ?))",
		params: [iso, iso],
	};
}
