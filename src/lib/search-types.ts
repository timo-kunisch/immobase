/**
 * Client-sichere Typen und Konstanten der globalen Suche - geteilt zwischen
 * dem Repository (src/data/search.ts), der API-Route (src/app/api/search)
 * und der Client-Komponente (src/components/layout/global-search.tsx).
 * Bewusst KEINE Importe aus Server-Modulen (Muster wie
 * src/lib/ai/attachment-types.ts): Diese Datei wird auch im Browser-Bundle
 * verwendet.
 */

/**
 * Entitätsarten, die die Datenbank-Suche liefern kann. Die Gruppen-Labels
 * dazu liegen im i18n-Namespace "search" (`search.type.<art>`), die Auflösung
 * passiert clientseitig - das Repository liefert bewusst nur den
 * Diskriminator, damit der Server keine lokalisierten Texte bauen muss.
 */
export type SearchEntityType =
	| "property"
	| "unit"
	| "tenant"
	| "lease"
	| "ticket"
	| "document"
	| "owner"
	| "hoa"
	| "billingPeriod"
	| "economicPlan"
	| "annualStatement"
	| "meeting"
	| "resolution"
	| "knowledgeArticle"
	| "template"
	| "calendarEvent"
	| "account"
	| "bankTransaction"
	| "transaction"
	| "housingCharge"
	| "allocationKey"
	| "hoaAllocationKey"
	| "user"
	| "mailboxMessage";

/** Ein Ergebnis der globalen Suche - fertig für die Anzeige aufbereitet. */
export interface SearchRow {
	type: SearchEntityType;
	id: string;
	/** Hauptbezeichnung (z. B. Mietername, Ticket-Titel). */
	title: string;
	/** Ergänzende Kontextzeile (z. B. Liegenschaft, Zeitraum); optional. */
	subtitle: string | null;
	/** Navigationsziel: Detailseite, Listen-Anker oder gefilterte Liste. */
	href: string;
}

/** Antwort-Format der API-Route /api/search. */
export interface SearchResponse {
	results: SearchRow[];
}

/** Mindestlänge der Suchanfrage für die Datenbank-Suche (Seiten matchen ab 1). */
export const MIN_SEARCH_QUERY_LENGTH = 2;
