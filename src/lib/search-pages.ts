import type { MessageKey } from "@/lib/i18n/translator";

/**
 * Statischer Katalog aller Navigations- und Einstellungsseiten für die
 * GLOBALE SUCHE (Command-Palette). Diese Einträge brauchen keine Datenbank -
 * sie werden clientseitig gegen die lokalisierten Titel UND die
 * Schlüsselwörter gefiltert (daher client-sicher, kein Server-Import).
 *
 * Die Titel nutzen bestehende i18n-Schlüssel (Namespace "nav" bzw.
 * "settings"), damit nichts dupliziert wird. Die Schlüsselwörter sind
 * bewusst sprachneutral/deutsch (Technische Begriffe wie "smtp" sind in
 * beiden Sprachen identisch).
 */
export interface SearchPageEntry {
	titleKey: MessageKey;
	/** Optionale Unterzeile (z. B. übergeordneter Bereich bei Einstellungs-Reitern). */
	subtitleKey?: MessageKey;
	href: string;
	/** Nur für Administratoren (Einstellungen/Nutzerverwaltung sind admin-only). */
	adminOnly?: boolean;
	/** Zusätzliche Suchbegriffe (kleingeschrieben, werden per includes() gematcht). */
	keywords?: string[];
}

export const SEARCH_PAGE_ENTRIES: SearchPageEntry[] = [
	// --- Allgemein -------------------------------------------------------------
	{ titleKey: "nav.item.dashboard", href: "/", keywords: ["start", "übersicht", "home", "dashboard"] },
	{ titleKey: "nav.item.properties", href: "/liegenschaften", keywords: ["immobilie", "immobilien", "objekt", "objekte", "gebäude", "house", "building"] },
	{ titleKey: "nav.item.units", href: "/einheiten", keywords: ["wohnung", "wohnungen", "gewerbe", "mieteinheit", "unit", "apartment"] },
	{ titleKey: "nav.item.tickets", href: "/tickets", keywords: ["instandhaltung", "reparatur", "mangel", "mängel", "handwerker", "ticket", "maintenance"] },
	{ titleKey: "nav.item.mailbox", href: "/postfach", keywords: ["mail", "e-mail", "email", "imap", "posteingang", "eingang", "inbox"] },
	{ titleKey: "nav.item.documents", href: "/dokumente", keywords: ["dms", "datei", "dateien", "pdf", "upload", "dokument", "document", "files"] },
	{ titleKey: "nav.item.calendar", href: "/kalender", keywords: ["termin", "termine", "monat", "ereignis", "calendar", "appointment"] },
	{ titleKey: "nav.item.knowledge", href: "/wissen", keywords: ["wissensdatenbank", "artikel", "anleitung", "knowledge", "wiki"] },
	// --- Mietverwaltung ----------------------------------------------------------
	{ titleKey: "nav.item.tenants", href: "/mieter", keywords: ["mieterin", "vermieter", "vermietung", "tenant", "renter"] },
	{ titleKey: "nav.item.leases", href: "/vertraege", keywords: ["mietvertrag", "vertrag", "verträge", "lease", "contract", "miete"] },
	{ titleKey: "nav.item.finances", href: "/finanzen", keywords: ["mieteingang", "mieteingänge", "zahlung", "zahlungen", "sollstellung", "rückstand", "rückstände", "forderung", "finanzen", "finance", "payments"] },
	{ titleKey: "nav.item.accounting", href: "/buchhaltung", keywords: ["konto", "konten", "bank", "kontoauszug", "buchung", "buchungen", "kontenrahmen", "accounting", "banking"] },
	{ titleKey: "nav.item.billing", href: "/abrechnung", keywords: ["nebenkosten", "nk", "abrechnung", "umlage", "umlageschlüssel", "billing", "settlement"] },
	{ titleKey: "nav.item.templates", href: "/vorlagen", keywords: ["dokumentvorlage", "vorlage", "brief", "schreiben", "mahnung", "kuendigung", "kündigung", "template"] },
	// --- WEG-Verwaltung --------------------------------------------------------------
	{ titleKey: "nav.item.hoas", href: "/weg", keywords: ["weg", "wohnungseigentümer", "eigentümergemeinschaft", "hoa", "gemeinschaft"] },
	{ titleKey: "nav.item.owners", href: "/weg/eigentuemer", keywords: ["eigentümer", "eigentümerin", "miteigentümer", "owner"] },
	{ titleKey: "nav.item.ownerships", href: "/weg/eigentumsverhaeltnisse", keywords: ["eigentumsverhältnis", "mea", "miteigentumsanteil", "anteil", "anteile", "ownership"] },
	{ titleKey: "nav.item.allocationKeys", href: "/weg/verteilerschluessel", keywords: ["verteilerschlüssel", "verteilung", "schlüssel", "allocation"] },
	{ titleKey: "nav.item.economicPlan", href: "/weg/wirtschaftsplan", keywords: ["wirtschaftsplan", "hausgeldplan", "plan", "budget", "economic plan"] },
	{ titleKey: "nav.item.annualStatements", href: "/weg/jahresabrechnung", keywords: ["jahresabrechnung", "abrechnung", "abrechnungsspitze", "annual statement"] },
	{ titleKey: "nav.item.housingCharges", href: "/weg/hausgeld", keywords: ["hausgeld", "hausgeldforderung", "zahlung", "housing charge"] },
	{ titleKey: "nav.item.hoaBanking", href: "/weg/buchhaltung", keywords: ["weg", "konto", "konten", "bank", "kontoauszug", "buchung", "buchungen", "buchhaltung", "banking"] },
	{ titleKey: "nav.item.reserveFund", href: "/weg/ruecklage", keywords: ["ruecklage", "rücklage", "erhaltungsrücklage", "instandhaltungsrücklage", "reserve fund"] },
	{ titleKey: "nav.item.meetings", href: "/weg/versammlungen", keywords: ["versammlung", "eigentümerversammlung", "meeting", "protokoll"] },
	{ titleKey: "nav.item.resolutions", href: "/weg/beschluesse", keywords: ["beschluss", "beschlüsse", "beschluss-sammlung", "resolution"] },
	// --- Administration (nur Admins) ---------------------------------------------------
	{ titleKey: "nav.item.users", href: "/admin/users", adminOnly: true, keywords: ["benutzer", "nutzer", "freigabe", "rollen", "user", "accounts"] },
	{ titleKey: "nav.item.auditLog", href: "/admin/logs", adminOnly: true, keywords: ["aktivitätsprotokoll", "audit", "protokoll", "log", "logs", "verlauf"] },
	{ titleKey: "nav.item.settings", href: "/einstellungen", adminOnly: true, keywords: ["einstellungen", "settings", "konfiguration", "optionen", "preferences"] },
	// Einstellungs-Reiter (Hash-Deep-Links, siehe src/components/einstellungen/settings-tabs.tsx)
	{
		titleKey: "settings.tabs.allgemein",
		subtitleKey: "nav.item.settings",
		href: "/einstellungen#allgemein",
		adminOnly: true,
		keywords: ["sprache", "language", "absender", "absenderdaten", "briefkopf", "verbindung", "betriebsmodus", "mehrbenutzer", "host", "client", "general"],
	},
	{
		titleKey: "settings.tabs.datensicherung",
		subtitleKey: "nav.item.settings",
		href: "/einstellungen#datensicherung",
		adminOnly: true,
		keywords: ["backup", "sicherung", "export", "import", "zip", "imbak", "cloud", "dropbox", "archive"],
	},
	{
		titleKey: "settings.tabs.integrationen",
		subtitleKey: "nav.item.settings",
		href: "/einstellungen#integrationen",
		adminOnly: true,
		keywords: ["smtp", "mail", "e-mail", "imap", "letterxpress", "post", "postversand", "brief", "ki", "ai", "mcp", "integration", "integrationen"],
	},
	{
		titleKey: "settings.tabs.sicherheit",
		subtitleKey: "nav.item.settings",
		href: "/einstellungen#sicherheit",
		adminOnly: true,
		keywords: ["verschlüsselung", "encryption", "schlüssel", "wiederherstellungsschlüssel", "zurücksetzen", "reset", "gefahrenbereich", "security"],
	},
];
