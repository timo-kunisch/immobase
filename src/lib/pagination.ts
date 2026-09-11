/**
 * Gemeinsame Pagination-Konstanten und -Helfer für die Listen der App.
 *
 * Die Listen-Seiten paginieren seit der Umstellung auf die generische
 * DataTable (src/components/ui/data-table.tsx) clientseitig: Sortierung,
 * Filterung und Pagination laufen im Browser auf der vollständigen,
 * serverseitig vorgeladenen Zeilenmenge (Desktop-App mit lokaler
 * SQLite-Datenbank). Serverseitige Query-Param-Filter (`?propertyId=` …)
 * bleiben davon unberührt und wirken als Vorfilter.
 */

/** Standard-Seitengröße aller paginierten Listen. */
export const LIST_PAGE_SIZE = 50;

/** Eintrag der Seitennummern-Liste: Zahl oder Ellipsis-Platzhalter. */
export type PageNumberEntry = number | "ellipsis";

/**
 * Kompakte Seitennummern-Liste für die Pagination-Leiste: erste und letzte
 * Seite sowie das Umfeld der aktuellen Seite (±1), Lücken als "ellipsis".
 * Kurze Listen (<= 7 Seiten) werden vollständig ausgegeben.
 */
export function buildPageNumbers(page: number, totalPages: number): PageNumberEntry[] {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const candidates = new Set<number>([1, totalPages, page - 1, page, page + 1]);
	const sorted = [...candidates].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

	const entries: PageNumberEntry[] = [];
	let previous = 0;
	for (const value of sorted) {
		if (value - previous > 1) {
			entries.push("ellipsis");
		}
		entries.push(value);
		previous = value;
	}
	return entries;
}
