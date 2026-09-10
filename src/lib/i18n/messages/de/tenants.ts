/**
 * Namespace "tenants" (Deutsch): Mieter-Stammdaten - Listen-Seite,
 * Formular-Dialog und die Fehlertexte der zugehörigen Server Actions.
 * Wiederkehrende Feldbezeichnungen (Vorname, E-Mail, ...) kommen aus dem
 * Namespace "common".
 */
export const tenants = {
	title: "Mieter",
	description: "Alle Mieter im Überblick.",
	empty: "Noch keine Mieter angelegt.",
	// Tabellen-Spalten (Name/Aktionen über "common")
	"table.contact": "Kontakt",
	"table.linked": "Verknüpft",
	// Beschriftungen der CountLinkBadges in der Spalte "Verknüpft"
	"linked.leases": "Verträge",
	"linked.documents": "Dokumente",
	"linked.letters": "Schreiben",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"confirm.delete": "Mieter \"{name}\" wirklich löschen?",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"dialog.createTitle": "Neuer Mieter",
	"dialog.editTitle": "Mieter bearbeiten",
	"dialog.description": "Stammdaten des Mieters für die Vertragsverwaltung.",
	// Fehlertexte der Server Actions
	"errors.nameRequired": "Bitte geben Sie Vor- und Nachnamen an.",
	"errors.saveFailed": "Der Mieter konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Mietverträge.",
};
