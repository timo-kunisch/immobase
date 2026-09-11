/**
 * Namespace "common": Sprachübergreifend geteilte, modulunabhängige
 * UI-Texte (Buttons, Feldbezeichnungen, Pagination, Lösch-Bestätigung).
 * Modul-spezifische Texte gehören in den jeweiligen Modul-Namespace.
 */
export const common = {
	appDescription: "Verwaltung von Liegenschaften, Mieteinheiten, Mietern und Mietverträgen",
	// Aktionen / Buttons
	save: "Speichern",
	cancel: "Abbrechen",
	delete: "Löschen",
	edit: "Bearbeiten",
	create: "Anlegen",
	add: "Hinzufügen",
	remove: "Entfernen",
	close: "Schließen",
	back: "Zurück",
	next: "Weiter",
	search: "Suchen",
	filter: "Filtern",
	resetFilters: "Filter zurücksetzen",
	all: "Alle",
	none: "Keine",
	yes: "Ja",
	no: "Nein",
	confirm: "Bestätigen",
	open: "Öffnen",
	download: "Herunterladen",
	upload: "Hochladen",
	select: "Auswählen",
	retry: "Erneut versuchen",
	send: "Senden",
	// Zustände
	loading: "Wird geladen…",
	pageLoading: "Seite wird geladen",
	saving: "Wird gespeichert…",
	error: "Fehler",
	success: "Erfolgreich",
	optional: "optional",
	required: "Pflichtfeld",
	// Feldbezeichnungen (modulübergreifend wiederkehrend)
	actions: "Aktionen",
	status: "Status",
	date: "Datum",
	amount: "Betrag",
	name: "Name",
	firstName: "Vorname",
	lastName: "Nachname",
	email: "E-Mail",
	phone: "Telefon",
	address: "Adresse",
	notes: "Notizen",
	description: "Beschreibung",
	details: "Details",
	total: "Gesamt",
	from: "Von",
	to: "Bis",
	year: "Jahr",
	today: "Heute",
	// Fachliche Basisbegriffe (in mehreren Modulen verwendet)
	property: "Liegenschaft",
	unit: "Einheit",
	tenant: "Mieter",
	owner: "Eigentümer",
	// Platzhalter in Selects
	pleaseSelect: "Bitte wählen…",
	// SearchableSelect (durchsuchbare Auswahllisten dynamischer Datenbestände)
	"searchableSelect.searchPlaceholder": "Suchen…",
	"searchableSelect.noResults": "Keine Treffer",
	// Lösch-Standarddialog (ConfirmDeleteButton)
	confirmDeleteDefault: "Diesen Eintrag wirklich unwiderruflich löschen?",
	// Pagination (PaginationBar)
	"pagination.aria": "Seitennavigation",
	"pagination.pageOf": "Seite {page} von {totalPages}",
	"pagination.entries.one": "{count} Eintrag",
	"pagination.entries.other": "{count} Einträge",
	"pagination.previous": "Vorherige Seite",
	"pagination.next": "Nächste Seite",
};
