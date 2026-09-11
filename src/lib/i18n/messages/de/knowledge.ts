/**
 * Namespace "knowledge" (Deutsch): Wissensdatenbank (/wissen) - Artikelliste
 * mit Suche, Artikel-Detailseite und der Artikel-Dialog.
 */
export const knowledge = {
	title: "Wissensdatenbank",
	description: "Richtlinien, Anweisungen und Erklärungen hinterlegen und nachschlagen.",
	// Suche (GET-Formular + Trefferanzeige)
	"search.placeholder": "Artikel durchsuchen…",
	"search.label": "Suche nach:",
	"search.reset": "Suche zurücksetzen",
	// Leer-Zustände der Artikelliste
	"empty.noArticles": "Noch keine Artikel hinterlegt.",
	"empty.noResults": "Keine Artikel gefunden.",
	// Tabellen-Spalten der Artikelliste
	"table.title": "Titel",
	"table.category": "Kategorie",
	"table.content": "Inhalt",
	"table.updatedAt": "Aktualisiert",
	// Karten- und Detail-Metadaten
	createdAt: "Erstellt: {date}",
	updatedAt: "Aktualisiert: {date}",
	"actions.read": "Lesen →",
	"actions.new": "Neuer Artikel",
	categoryLine: "Kategorie: {category}",
	articleFallback: "Wissensdatenbank-Artikel",
	"confirm.delete": "Artikel \"{title}\" wirklich löschen?",
	// Artikel-Dialog (Anlegen/Bearbeiten)
	"dialog.newTitle": "Neuer Artikel",
	"dialog.editTitle": "Artikel bearbeiten",
	"dialog.description": "Richtlinie, Anweisung oder Erklärung in der Wissensdatenbank ablegen.",
	"fields.title": "Titel *",
	"fields.titlePlaceholder": "z. B. Richtlinie für Mieterhöhungen",
	"fields.category": "Kategorie (optional)",
	"fields.categoryPlaceholder": "z. B. Abrechnung",
	"fields.content": "Inhalt *",
	"fields.contentPlaceholder": "Text des Artikels…",
	// Server Actions (Fehlermeldungen)
	"errors.titleAndContentRequired": "Bitte vergeben Sie einen Titel und füllen Sie den Inhalt aus.",
	"errors.saveFailed": "Der Artikel konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Der Artikel konnte nicht gelöscht werden.",
};
