/**
 * Auswertungslogik für Eigentumsverhältnisse (unitOwnerships) einer
 * WEG-Einheit - das WEG-Pendant zu src/lib/lease-status.ts (Mietverträge).
 *
 * Anders als bei Mietverträgen/rentAdjustments (ein Basiswert + spätere
 * Änderungen) sind Eigentumsverhältnisse bereits als eigenständige,
 * lückenlose(!) Zeiträume (startDate/endDate) modelliert - jeder
 * Eigentümerwechsel wird als neue Zeile mit eigenem startDate erfasst,
 * während die vorherige Zeile ein endDate erhält (siehe
 * src/app/(app)/weg/eigentuemer/actions.ts). Es gibt daher keine
 * "buildHistory aus Basis + Adjustments"-Funktion wie bei
 * src/lib/rent-history.ts - die Historie IST bereits die Liste der Zeilen.
 *
 * Hinweis: Die frühere Drizzle-Filterbedingung `activeOwnershipWhere` ist
 * mit dem Wegfall von Drizzle entfallen - die "aktuell laufenden"
 * Eigentumsverhältnisse werden jetzt entweder im Repository-Layer per SQL
 * (start_date <= ? AND (end_date IS NULL OR end_date >= ?)) oder aus einer
 * bereits geladenen Liste per findOwnershipForDate bestimmt.
 */

export type OwnershipStatusValue = "UPCOMING" | "ACTIVE" | "ENDED";

type OwnershipStatusFields = {
	startDate: string;
	endDate: string | null;
};

/** Leitet den Status eines Eigentumsverhältnisses anhand von Beginn/Ende ab. */
export function getOwnershipStatus(ownership: OwnershipStatusFields, date: Date = new Date()): OwnershipStatusValue {
	const start = new Date(ownership.startDate);
	const end = ownership.endDate ? new Date(ownership.endDate) : null;
	if (start > date) return "UPCOMING";
	if (end && end < date) return "ENDED";
	return "ACTIVE";
}

export const ownershipStatusLabels: Record<OwnershipStatusValue, string> = {
	ACTIVE: "Aktuell",
	UPCOMING: "Zukünftig",
	ENDED: "Beendet",
};

export const ownershipStatusStyles: Record<OwnershipStatusValue, string> = {
	ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	UPCOMING: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	ENDED: "bg-muted text-muted-foreground",
};

type OwnershipLike = {
	startDate: string;
	endDate: string | null;
};

/**
 * Findet aus einer Liste von Eigentumsverhältnissen einer Einheit dasjenige,
 * das zu einem bestimmten Datum gültig ist (oder null, falls die Einheit zu
 * diesem Zeitpunkt keinen erfassten Eigentümer hat - z. B. vor dem
 * allerersten erfassten Eigentumsverhältnis).
 */
export function findOwnershipForDate<T extends OwnershipLike>(ownerships: T[], date: Date = new Date()): T | null {
	for (const ownership of ownerships) {
		const start = new Date(ownership.startDate);
		const end = ownership.endDate ? new Date(ownership.endDate) : null;
		if (start <= date && (!end || end >= date)) {
			return ownership;
		}
	}
	return null;
}
