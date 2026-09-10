/**
 * Namespace "properties" (Deutsch): Modul "Liegenschaften" - Listen-Seite,
 * Formular-Dialog (Anlegen/Bearbeiten) und Meldungen der Server Actions.
 */
export const properties = {
	title: "Liegenschaften",
	description: "Verwalten Sie Ihre Gebäude und Objekte.",
	empty: "Noch keine Liegenschaften angelegt.",
	// Tabellenköpfe
	"table.name": "Bezeichnung",
	"table.linked": "Verknüpft",
	// Beschriftungen der CountLinkBadges (verknüpfte Datensätze)
	"badge.units": "Einheiten",
	"badge.tickets": "Tickets",
	"badge.documents": "Dokumente",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"confirm.delete": "Liegenschaft \"{name}\" wirklich löschen?",
	// Formular-Dialog
	"actions.create": "Neue Liegenschaft",
	"dialog.createTitle": "Neue Liegenschaft",
	"dialog.editTitle": "Liegenschaft bearbeiten",
	"dialog.description": "Erfassen Sie die Stammdaten der Liegenschaft (Gebäude/Objekt).",
	"fields.name": "Bezeichnung",
	"fields.street": "Straße & Hausnummer",
	"fields.zipCode": "PLZ",
	"fields.city": "Stadt",
	"fields.country": "Land",
	"fields.countryDefault": "Deutschland",
	"placeholder.name": "z. B. Musterstraße 12",
	"placeholder.street": "Musterstraße 12",
	"placeholder.zipCode": "12345",
	"placeholder.city": "Musterstadt",
	"placeholder.notes": "Optionale interne Anmerkungen",
	// Fehlermeldungen der Server Actions
	"errors.requiredFields": "Bitte füllen Sie alle Pflichtfelder aus.",
	"errors.saveFailed": "Die Liegenschaft konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Einheiten.",
};
