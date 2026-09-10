/**
 * Namespace "dashboard" (Deutsch): Startseite des geschützten App-Bereichs
 * (Kennzahlen-Karten, neueste offene Tickets, Begrüßungs- und Hinweiskarten).
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const dashboard = {
	// Seitenkopf
	title: "Dashboard",
	description: "Kennzahlen von ImmoBase auf einen Blick.",
	// Kennzahlen-Karten
	"cards.properties.title": "Liegenschaften",
	"cards.properties.description": "{count} Mieter insgesamt",
	"cards.units.title": "Mieteinheiten",
	"cards.units.description": "{occupied} vermietet · {vacant} leer",
	"cards.vacancyRate.title": "Leerstandsquote",
	"cards.vacancyRate.description": "{vacant} von {total} Einheiten leer",
	"cards.totalRent.title": "Gesamtmiete / Monat",
	"cards.totalRent.description": "{baseRent} Kaltmiete + {serviceCharges} NK",
	"cards.openTickets.title": "Offene Tickets",
	"cards.openTickets.description": "Schäden & Instandhaltung",
	"cards.rentArrears.title": "Mietrückstände",
	"cards.rentArrears.description": "Fällige/überfällige Zahlungen",
	// Ticket-Status-Labels (nur die auf dem Dashboard vorkommenden Stände)
	// Karte "Neueste offene Tickets"
	"latestTickets.title": "Neueste offene Tickets",
	"latestTickets.allTickets": "Alle Tickets →",
	"latestTickets.empty": "Keine offenen Tickets – alles erledigt.",
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
