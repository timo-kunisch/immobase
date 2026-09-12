/**
 * Namespace "dashboard" (Deutsch): Startseite des geschützten App-Bereichs
 * (Kennzahlen-Karten aller Fachbereiche - Allgemein, Mietverwaltung,
 * WEG-Verwaltung -, neueste offene Tickets, anstehende Termine, Begrüßungs-
 * und Hinweiskarten). Die Sektions-Überschriften WIEDERVERWENDEN die
 * Sidebar-Gruppen aus dem nav-Namespace ("nav.group.*").
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const dashboard = {
	// Seitenkopf
	title: "Dashboard",
	description: "Kennzahlen von ImmoBase auf einen Blick.",
	// Kennzahlen-Karten: Allgemein
	"cards.properties.title": "Liegenschaften",
	"cards.properties.description": "{units} Einheiten · {hoas} WEGs",
	"cards.units.title": "Mieteinheiten",
	"cards.units.description": "{occupied} vermietet · {vacant} leer",
	"cards.openTickets.title": "Offene Tickets",
	"cards.openTickets.description": "Schäden & Instandhaltung",
	"cards.documents.title": "Dokumente",
	"cards.documents.description": "Uploads & erzeugte Schreiben",
	// Kennzahlen-Karten: Mietverwaltung
	"cards.tenants.title": "Mieter",
	"cards.tenants.description": "Stammdaten & Kontakte",
	"cards.activeLeases.title": "Aktive Mietverträge",
	"cards.activeLeases.description": "Laufende Mietverhältnisse",
	"cards.totalRent.title": "Gesamtmiete / Monat",
	"cards.totalRent.description": "{baseRent} Kaltmiete + {serviceCharges} NK",
	"cards.vacancyRate.title": "Leerstandsquote",
	"cards.vacancyRate.description": "{vacant} von {total} Einheiten leer",
	"cards.rentArrears.title": "Mietrückstände",
	"cards.rentArrears.description": "Fällige/überfällige Zahlungen",
	"cards.draftBillingPeriods.title": "Abrechnungen in Arbeit",
	"cards.draftBillingPeriods.description": "Nebenkostenabrechnungs-Entwürfe",
	// Kennzahlen-Karten: WEG-Verwaltung
	"cards.hoas.title": "WEGs",
	"cards.hoas.description": "Wohnungseigentümergemeinschaften",
	"cards.owners.title": "Eigentümer",
	"cards.owners.description": "Stammdaten der Eigentümer",
	"cards.housingChargeArrears.title": "Hausgeld-Rückstände",
	"cards.housingChargeArrears.description": "Fällige/überfällige Sollstellungen",
	"cards.reserveFund.title": "Erhaltungsrücklage",
	"cards.reserveFund.description": "Saldo über alle WEGs",
	"cards.draftEconomicPlans.title": "Wirtschaftspläne in Arbeit",
	"cards.draftEconomicPlans.description": "Entwürfe, noch nicht finalisiert",
	"cards.draftAnnualStatements.title": "Jahresabrechnungen in Arbeit",
	"cards.draftAnnualStatements.description": "Entwürfe, noch nicht finalisiert",
	// Ticket-Status-Labels (nur die auf dem Dashboard vorkommenden Stände)
	// Karte "Neueste offene Tickets"
	"latestTickets.title": "Neueste offene Tickets",
	"latestTickets.allTickets": "Alle Tickets →",
	"latestTickets.empty": "Keine offenen Tickets – alles erledigt.",
	// Karte "Anstehende Termine" (aus der Kalender-Aggregation)
	"upcoming.title": "Anstehende Termine",
	"upcoming.allEvents": "Alle Termine →",
	"upcoming.empty": "Keine anstehenden Termine.",
	// Begrüßungskarte, solange noch keine Liegenschaft existiert
	// (dreigeteilt, damit der Modulname im Text hervorgehoben werden kann)
	"welcome.textPrefix": "Willkommen! Legen Sie zunächst eine Liegenschaft unter",
	"welcome.propertiesLabel": "Objekte",
	"welcome.textSuffix": "an, um mit der Verwaltung zu beginnen.",
	// Hinweiskarte Priority-Support (externer Link help.immobase.app)
	"support.title": "Priority-Support direkt vom Entwickler",
	"support.description":
		"ImmoBase bleibt kostenlos und Open Source. Für Hausverwaltungen und Unternehmen, die garantierte Reaktionszeiten und persönliche Betreuung brauchen, gibt es kostenpflichtige Support-Pakete.",
	"support.learnMore": "Mehr erfahren",
};
