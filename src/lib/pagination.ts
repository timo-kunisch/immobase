/**
 * Gemeinsame Pagination-Logik für die Listen-Seiten der App.
 *
 * Paginiert wird nur dort, wo Listen fachlich unbegrenzt wachsen und keine
 * eingehenden Zeilen-Anker (Querverlinkung via `tr:target`, z. B.
 * `/mieter#tenant-<id>`) existieren: Mieteingänge (/finanzen), Hausgeld
 * (/weg/hausgeld), Dokumente (/dokumente) und die Beschluss-Sammlung
 * (/weg/beschluesse). Stammdaten-Listen bleiben bewusst unpaginiert, damit
 * die Anchor-Navigation weiterhin jede Zeile direkt anspringen kann.
 *
 * Die Seitenauswahl läuft über den Query-Param `page` (1-basiert) als
 * vollständige Server-Navigation (Link-basiert, kein Client-State nötig).
 */

/** Standard-Seitengröße aller paginierten Listen. */
export const LIST_PAGE_SIZE = 50;

export interface PaginationState {
	/** Aktuelle Seite (1-basiert, in den gültigen Bereich geclamped). */
	page: number;
	/** Gesamtseitenzahl (mindestens 1, auch bei leerer Liste). */
	totalPages: number;
	/** Gesamtanzahl der Einträge (über alle Seiten). */
	totalItems: number;
	/** Seitengröße (für LIMIT). */
	limit: number;
	/** Zeilen-Offset der aktuellen Seite (für OFFSET bzw. Array-Slice). */
	offset: number;
}

/**
 * Wandelt den rohen `page`-Query-Param in einen gültigen Pagination-State
 * um. Ungültige (nicht numerische, negative) oder zu große Werte werden
 * geclamped (letztere auf die letzte Seite - relevant, wenn Einträge
 * zwischenzeitlich gelöscht wurden).
 */
export function resolvePagination(pageParam: string | undefined, totalItems: number, pageSize: number = LIST_PAGE_SIZE): PaginationState {
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const parsed = pageParam ? Number.parseInt(pageParam, 10) : Number.NaN;
	const requested = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
	const page = Math.min(Math.max(requested, 1), totalPages);
	return {
		page,
		totalPages,
		totalItems,
		limit: pageSize,
		offset: (page - 1) * pageSize,
	};
}

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
