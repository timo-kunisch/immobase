/**
 * Namespace "leases" (Deutsch): Mietverträge inkl. Miet-/Nebenkosten-
 * Änderungen (RentAdjustment) - Listen-Seite, Formular-/Verlauf-Dialoge,
 * Vertragsstatus-Labels und die Fehlertexte der zugehörigen Server Actions.
 * Wiederkehrende Feldbezeichnungen (Einheit, Mieter, Notizen, ...) kommen
 * aus dem Namespace "common".
 */
export const leases = {
	title: "Mietverträge",
	description: "Alle Mietverträge inkl. Kaltmiete und Nebenkosten.",
	empty: "Noch keine Mietverträge angelegt.",
	emptyFiltered: "Keine Mietverträge für diese Auswahl gefunden.",
	// Filter-Hinweiszeile über der Tabelle (Zurücksetzen über "common.resetFilters")
	"filter.filteredBy": "Gefiltert nach:",
	// Tabellen-Spalten (Einheit/Mieter/Status/Aktionen über "common")
	"table.period": "Zeitraum",
	"table.coldRentCurrent": "Kaltmiete (aktuell)",
	"table.serviceChargesCurrent": "Nebenkosten (aktuell)",
	// Zeitraum-Zelle ohne Mietende ("von – offen")
	"period.open": "offen",
	// Vertragsstatus (Ableitung aus Mietbeginn/-ende, siehe src/lib/lease-status.ts)
	"status.ACTIVE": "Aktiv",
	"status.UPCOMING": "Zukünftig",
	"status.ENDED": "Beendet",
	// Zeilen-Aktionen (Icon-Buttons, aria-label/title)
	"actions.finances": "Finanzen zu diesem Vertrag",
	"actions.letters": "Schreiben zu diesem Vertrag",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"dialog.createTitle": "Neuer Mietvertrag",
	"dialog.editTitle": "Mietvertrag bearbeiten",
	"dialog.description": "Verknüpft einen Mieter mit einer Mieteinheit inkl. Konditionen.",
	"fields.unit": "Mieteinheit",
	"fields.selectUnit": "Einheit auswählen",
	"fields.selectTenant": "Mieter auswählen",
	"fields.startDate": "Mietbeginn",
	"fields.endDate": "Mietende",
	"fields.coldRent": "Kaltmiete (€)",
	"fields.serviceCharges": "Nebenkosten (€)",
	"fields.deposit": "Kaution (€)",
	"fields.numberOfOccupants": "Anzahl Personen im Haushalt",
	"fields.numberOfOccupantsHint": "Grundlage für den Umlageschlüssel \"Personen\" in der Nebenkostenabrechnung.",
	// Miet-/Nebenkosten-Änderung (RentAdjustmentFormDialog)
	"adjustment.add": "Änderung hinterlegen",
	"adjustment.createTitle": "Miet-/Nebenkostenänderung",
	"adjustment.editTitle": "Änderung bearbeiten",
	"adjustment.description":
		"Ab dem gewählten Datum gilt die neue Kaltmiete/Nebenkosten. Der bisherige Betrag bleibt für den Zeitraum davor erhalten.",
	"adjustment.fields.validFrom": "Gültig ab",
	"adjustment.fields.notesPlaceholder": "z. B. Mieterhöhung nach § 558 BGB",
	// Verlauf-Dialog (RentHistoryDialog)
	"history.triggerHistory": "Verlauf der Miete/Nebenkosten",
	"history.triggerAdd": "Miet-/Nebenkostenänderung hinterlegen",
	"history.title": "Verlauf der vereinbarten Zahlungen",
	"history.description":
		"Übersicht aller Kaltmiete-/Nebenkostenbeträge über die Mietdauer inkl. späterer Änderungen (z. B. Mieterhöhungen).",
	"history.table.validUntil": "Gültig bis",
	"history.table.coldRent": "Kaltmiete",
	"history.table.serviceCharges": "Nebenkosten",
	"history.table.note": "Notiz",
	"history.ongoing": "laufend",
	"history.initialAmount": "Ursprünglicher Vertragsbetrag",
	// Lösch-Bestätigungen (ConfirmDeleteButton)
	"confirm.delete": "Diesen Mietvertrag wirklich löschen?",
	"confirm.deleteAdjustment": "Diese Änderung wirklich löschen?",
	// Fehlertexte der Server Actions
	"errors.requiredFields": "Bitte wählen Sie Einheit & Mieter aus und geben Sie Mietbeginn, Kaltmiete sowie Nebenkosten an.",
	"errors.saveFailed": "Der Mietvertrag konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Der Mietvertrag konnte nicht gelöscht werden.",
	"errors.adjustmentRequiredFields": "Bitte geben Sie Gültigkeitsdatum, Kaltmiete sowie Nebenkosten an.",
	"errors.leaseNotFound": "Der zugehörige Mietvertrag wurde nicht gefunden.",
	"errors.validFromAfterStart":
		"Das Gültigkeitsdatum muss nach dem Mietbeginn liegen (der Betrag zum Mietbeginn wird direkt im Vertrag gepflegt).",
	"errors.adjustmentSaveFailed": "Die Änderung konnte nicht gespeichert werden. Existiert für dieses Datum bereits ein Eintrag?",
	"errors.adjustmentDeleteFailed": "Die Änderung konnte nicht gelöscht werden.",
};
